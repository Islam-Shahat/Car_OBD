import { assessAdapter } from './adapter';
import { ElmError, errorMessage, isElmError, type ElmErrorCode } from './errors';
import { classifyElmFailure, normalizeResponse } from './parse';
import { trafficLogger } from './trafficLogger';
import type { Transport } from './transport';

export interface ElmResponse {
  command: string;
  /** Cleaned lines: echo/prompt/progress removed, multi-frame lines preserved. */
  lines: string[];
  raw: string;
}

export interface AdapterInfo {
  identity: string;
  description: string | null;
  version: string | null;
  protocol: string | null;
  ecuPresent: boolean;
  likelyClone: boolean;
  limitedCommands: boolean;
  adapterTimeoutMs: number;
}

export interface DriverTiming {
  /** Per-command timeout. */
  timeoutMs: number;
  /** `ATZ` needs longer than a normal command. */
  resetTimeoutMs: number;
  /** Ceiling for the adaptive timeout. */
  maxTimeoutMs: number;
  /** Protocol search + first `0100` can take many seconds on older buses. */
  ecuTimeoutMs: number;
  adaptiveTiming: boolean;
  /** Target value for `ATST`, in milliseconds. */
  adapterTimeoutMs: number;
}

export type Elm327Options = Partial<DriverTiming>;

const DEFAULT_TIMING: DriverTiming = {
  timeoutMs: 3000,
  resetTimeoutMs: 6000,
  maxTimeoutMs: 12000,
  ecuTimeoutMs: 20000,
  adaptiveTiming: true,
  adapterTimeoutMs: 200,
};

const ECU_ABSENT_CODES: ReadonlySet<ElmErrorCode> = new Set([
  'no-data',
  'unable-to-connect',
  'bus-init-error',
  'can-error',
  'empty-response',
  'timeout',
]);

const TOLERATED_INIT_CODES: ReadonlySet<ElmErrorCode> = new Set([
  'unknown-command',
  'adapter-error',
  'empty-response',
]);

const LATENCY_SAMPLES = 5;

interface PendingResponse {
  resolve: (raw: string) => void;
  reject: (error: ElmError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * ELM327 driver: one command in flight at a time, `>`-prompt framing, adaptive
 * host-side timeout on top of `ATST`, and typed failures for every adapter token.
 */
export class Elm327Driver {
  private readonly transport: Transport;
  private readonly timing: DriverTiming;
  private readonly detachData: () => void;
  private readonly detachClosed: () => void;

  private queue: Promise<unknown> = Promise.resolve();
  private buffer = '';
  private pending: PendingResponse | null = null;
  private latencies: number[] = [];
  private closed = false;
  private closedReason: string | null = null;
  private initialized = false;

  constructor(transport: Transport, options: Elm327Options = {}) {
    this.transport = transport;
    this.timing = { ...DEFAULT_TIMING, ...options };
    this.detachData = transport.onData((chunk) => this.handleData(chunk));
    this.detachClosed = transport.onClosed((reason) => this.handleClosed(reason));
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  /**
   * Init sequence: `ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`, optional `ATST`/`ATAT1`,
   * `ATSP0`, then `0100` as an ECU check and `ATDP` for the detected protocol.
   */
  async initialize(): Promise<AdapterInfo> {
    if (this.initialized) {
      throw new ElmError('adapter-error', 'The adapter is already initialized');
    }
    if (this.closed) {
      throw new ElmError('closed', this.closedReason ?? 'The serial port is closed');
    }

    await this.send('ATZ');
    await this.send('ATE0');
    await this.send('ATL0');
    await this.send('ATS0');
    await this.send('ATH0');

    let limitedCommands = false;

    const identityResponse = await this.trySend('ATI');
    if (!identityResponse) limitedCommands = true;

    const descriptionResponse = await this.trySend('AT@1');
    if (!descriptionResponse) limitedCommands = true;

    let adapterTimeoutMs = this.timing.adapterTimeoutMs;
    const stValue = Math.min(0xff, Math.max(0x02, Math.round(adapterTimeoutMs / 4)));
    const stResponse = await this.trySend(
      `ATST${stValue.toString(16).toUpperCase().padStart(2, '0')}`,
    );
    if (stResponse) {
      adapterTimeoutMs = stValue * 4;
    } else {
      limitedCommands = true;
    }

    // Adaptive timing both on the adapter (best effort) and in this driver.
    await this.trySend('ATAT1');

    await this.send('ATSP0');

    let ecuPresent = false;
    try {
      await this.send('0100', { timeoutMs: this.timing.ecuTimeoutMs });
      ecuPresent = true;
    } catch (error) {
      if (!isElmError(error) || !ECU_ABSENT_CODES.has(error.code)) {
        throw error;
      }
    }

    const protocolResponse = await this.trySend('ATDP');

    const identity = identityResponse?.lines.join(' ').trim() ?? '';
    const description = descriptionResponse?.lines.join(' ').trim() ?? '';
    const assessment = assessAdapter(identity);
    const protocol = protocolResponse?.lines.join(' ').trim() ?? '';

    this.initialized = true;

    return {
      identity: identity.length > 0 ? identity : 'Unknown adapter',
      description: description.length > 0 ? description : null,
      version: assessment.version,
      protocol: protocol.length > 0 ? protocol : null,
      ecuPresent,
      likelyClone: assessment.likelyClone,
      limitedCommands,
      adapterTimeoutMs,
    };
  }

  send(command: string, options: { timeoutMs?: number } = {}): Promise<ElmResponse> {
    return this.enqueue(() => this.executeCommand(command, options.timeoutMs));
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failPending(new ElmError('closed', 'The serial port was closed'));
    this.detachData();
    this.detachClosed();
    await this.transport.close();
  }

  private trySend(command: string): Promise<ElmResponse | null> {
    return this.send(command).catch((error: unknown) => {
      if (isElmError(error) && TOLERATED_INIT_CODES.has(error.code)) {
        return null;
      }
      throw error;
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async executeCommand(command: string, timeoutOverride?: number): Promise<ElmResponse> {
    if (this.closed) {
      throw new ElmError('closed', this.closedReason ?? 'The serial port is closed');
    }

    this.buffer = '';
    const timeoutMs = timeoutOverride ?? this.effectiveTimeoutMs(command);
    const startedAt = performance.now();

    trafficLogger.logTx(command);
    try {
      await this.transport.write(`${command}\r`);
    } catch (error) {
      throw isElmError(error) ? error : new ElmError('transport', errorMessage(error));
    }

    const raw = this.buffer.includes('>') ? this.takeBuffer() : await this.waitForPrompt(timeoutMs);
    trafficLogger.logRx(raw, performance.now() - startedAt);

    // Adaptive timing should learn from normal commands only; resets and the
    // first protocol search intentionally use longer fixed timeouts.
    if (timeoutOverride === undefined) {
      this.recordLatency(performance.now() - startedAt);
    }

    const lines = normalizeResponse(raw, command);
    const failure = classifyElmFailure(lines);
    if (failure !== null) {
      throw new ElmError(failure, `Adapter rejected ${command}: ${lines.join(' ')}`, raw);
    }
    if (lines.length === 0) {
      throw new ElmError('empty-response', `Empty response to ${command}`, raw);
    }

    return { command, lines, raw };
  }

  private effectiveTimeoutMs(command: string): number {
    if (command.toUpperCase() === 'ATZ') {
      return this.timing.resetTimeoutMs;
    }

    const base = this.timing.timeoutMs;
    if (!this.timing.adaptiveTiming || this.latencies.length === 0) {
      return base;
    }

    const average = this.latencies.reduce((sum, value) => sum + value, 0) / this.latencies.length;
    return Math.min(this.timing.maxTimeoutMs, Math.max(base, Math.round(average * 3 + 250)));
  }

  private recordLatency(durationMs: number): void {
    this.latencies.push(durationMs);
    if (this.latencies.length > LATENCY_SAMPLES) {
      this.latencies.shift();
    }
  }

  private waitForPrompt(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.buffer = '';
        // Ask the adapter for a fresh prompt so the next command starts clean.
        void this.transport.write('\r').catch(() => undefined);
        reject(new ElmError('timeout', `No response within ${timeoutMs} ms`));
      }, timeoutMs);

      this.pending = { resolve, reject, timer };
    });
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;

    const pending = this.pending;
    if (pending && this.buffer.includes('>')) {
      this.pending = null;
      clearTimeout(pending.timer);
      pending.resolve(this.takeBuffer());
    }
  }

  private handleClosed(reason: string | null): void {
    this.closed = true;
    this.closedReason = reason;
    this.failPending(new ElmError('closed', reason ?? 'The serial port closed'));
  }

  private failPending(error: ElmError): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private takeBuffer(): string {
    const raw = this.buffer;
    this.buffer = '';
    return raw;
  }
}
