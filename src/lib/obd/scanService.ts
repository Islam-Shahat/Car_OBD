import type { AdapterInfo } from '../elm327/driver';
import { errorMessage } from '../elm327/errors';
import type { ScanBackup, ScanBackupRepository } from './backup';
import { uniqueDtcs, type Dtc, type DtcMode } from './dtc';
import { ObdError, isObdError } from './errors';
import { decodeMessages, hexByte, negativeResponse } from './frames';
import { CORE_PID_IDS } from './pids';
import { isOptionalReadError, ObdService, type CommandPort } from './obdService';
import type { ReadinessStatus } from './readiness';
import type { VinResult } from './vin';
import type {
  ClearResult,
  DtcModeSupport,
  ScanProgress,
  ScanProgressListener,
  ScanResult,
  ScanWarning,
} from './scanTypes';

export interface ScanServiceOptions {
  /** Injected in tests for deterministic timestamps. */
  now?: () => number;
  /** Injected in tests for deterministic backup identifiers. */
  idFactory?: () => string;
}

export interface ClearOptions {
  backupRepository: ScanBackupRepository;
  /** Must be `true`; the UI only sets it after the explicit confirmation step. */
  confirm: boolean;
  onProgress?: ScanProgressListener;
}

/** Freeze frames beyond this index are almost never implemented; cap the scan. */
const MAX_FREEZE_FRAMES = 5;

function defaultIdFactory(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emit(listener: ScanProgressListener | undefined, progress: ScanProgress): void {
  if (!listener) return;
  try {
    listener(progress);
  } catch {
    // Progress is best-effort: a UI callback must never abort a diagnostic scan.
    return;
  }
}

function handledAsWarning(
  error: unknown,
  warnings: ScanWarning[],
  warning: Omit<ScanWarning, 'detail'>,
): boolean {
  if (isOptionalReadError(error)) {
    warnings.push({ ...warning, detail: errorMessage(error) });
    return true;
  }
  if (isObdError(error) && error.code === 'malformed-response') {
    warnings.push({
      code: 'malformed-response',
      pid: warning.pid,
      mode: warning.mode,
      detail: errorMessage(error),
    });
    return true;
  }
  return false;
}

/**
 * One diagnostic session: full structured scans, a single-operation lock, and
 * the only safe path to Service 04 (backup -> confirm -> clear -> rescan).
 */
export class ScanService {
  private readonly port: CommandPort;
  private readonly adapter: AdapterInfo;
  private readonly service: ObdService;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private busy = false;

  constructor(port: CommandPort, adapter: AdapterInfo, options: ScanServiceOptions = {}) {
    this.port = port;
    this.adapter = adapter;
    this.service = new ObdService(port);
    this.now = options.now ?? (() => Date.now());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  runFullScan(onProgress?: ScanProgressListener): Promise<ScanResult> {
    return this.exclusive(() => this.scan(onProgress));
  }

  /**
   * Safety order is enforced here, not in the UI:
   * backup must resolve before `04`; the ECU must confirm `44`; the scan is
   * repeated to report returning codes. Concurrent scans/clears are refused.
   */
  clearStoredCodes(options: ClearOptions): Promise<ClearResult> {
    return this.exclusive(async () => {
      if (!options.confirm) {
        throw new ObdError('clear-refused', 'Explicit confirmation is required before clearing');
      }

      const before = await this.scan(options.onProgress);
      if (before.stored.length === 0 && before.pending.length === 0) {
        throw new ObdError('clear-refused', 'There are no stored or pending codes to clear');
      }

      const backup: ScanBackup = {
        id: this.idFactory(),
        createdAt: new Date(this.now()).toISOString(),
        adapter: this.adapter,
        result: before,
      };

      emit(options.onProgress, { step: 'backup', completed: 0, total: 1 });
      try {
        await options.backupRepository.save(backup);
      } catch (error) {
        throw new ObdError(
          'backup-failed',
          `The backup could not be saved: ${errorMessage(error)}`,
          { cause: error },
        );
      }
      emit(options.onProgress, { step: 'backup', completed: 1, total: 1 });

      emit(options.onProgress, { step: 'clear', completed: 0, total: 1 });
      let response;
      try {
        response = await this.port.send('04');
      } catch (error) {
        throw new ObdError(
          'clear-failed',
          `Mode 04 did not complete; the ECU may or may not have cleared its codes: ${errorMessage(error)}`,
          { cause: error },
        );
      }

      const messages = decodeMessages(response.lines);
      const negative = negativeResponse(messages);
      if (negative) {
        throw new ObdError(
          'clear-failed',
          `The ECU rejected Mode 04 with NRC 0x${hexByte(negative.nrc)}`,
          { nrc: negative.nrc },
        );
      }
      if (!messages.some((message) => message.bytes[0] === 0x44)) {
        throw new ObdError('clear-failed', 'The ECU did not confirm Mode 04 with a 44 answer');
      }
      emit(options.onProgress, { step: 'clear', completed: 1, total: 1 });

      emit(options.onProgress, { step: 'verify', completed: 0, total: 1 });
      let after: ScanResult | null = null;
      let verificationError: string | null = null;
      try {
        after = await this.scan(options.onProgress, false);
      } catch (error) {
        // The clear already happened; report it instead of pretending it failed.
        verificationError = errorMessage(error);
      }
      emit(options.onProgress, { step: 'verify', completed: 1, total: 1 });
      emit(options.onProgress, { step: 'done', completed: 1, total: 1 });

      return {
        backupId: backup.id,
        clearedAt: new Date(this.now()).toISOString(),
        before,
        after,
        verificationError,
        returningCodes: after ? uniqueDtcs([...after.stored, ...after.pending]) : [],
      };
    });
  }

  private async exclusive<T>(task: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new ObdError('busy', 'Another diagnostic operation is already running');
    }

    this.busy = true;
    try {
      return await task();
    } finally {
      this.busy = false;
    }
  }

  private async scan(
    onProgress?: ScanProgressListener,
    includeFreezeFrames = true,
  ): Promise<ScanResult> {
    const started = this.now();
    const warnings: ScanWarning[] = [];
    const modeSupport: DtcModeSupport = {
      stored: false,
      pending: false,
      permanent: false,
      freezeFrame: false,
    };

    emit(onProgress, { step: 'pids', completed: 0, total: 1 });
    let groupsSeen = 0;
    const supported = await this.service.readSupportedPids(() => {
      groupsSeen += 1;
      emit(onProgress, { step: 'pids', completed: groupsSeen, total: groupsSeen + 1 });
    });
    emit(onProgress, {
      step: 'pids',
      completed: Math.max(groupsSeen, 1),
      total: Math.max(groupsSeen, 1),
    });
    warnings.push(...supported.warnings);
    const supportedSet = new Set(supported.pids);

    emit(onProgress, { step: 'status', completed: 0, total: 1 });
    let status: ReadinessStatus | null = null;
    if (supportedSet.has(0x01)) {
      try {
        status = await this.service.readStatus();
      } catch (error) {
        if (!handledAsWarning(error, warnings, { code: 'pid-no-data', pid: 0x01 })) {
          throw error;
        }
      }
    } else if (supported.pids.length > 0) {
      warnings.push({
        code: 'pid-no-data',
        pid: 0x01,
        detail: 'PID 0x01 is not set in the supported-PID bitmap',
      });
    }
    emit(onProgress, { step: 'status', completed: 1, total: 1 });

    const modeEntries: readonly { mode: DtcMode; key: 'stored' | 'pending' | 'permanent' }[] = [
      { mode: 3, key: 'stored' },
      { mode: 7, key: 'pending' },
      { mode: 10, key: 'permanent' },
    ];
    const codesByMode = new Map<DtcMode, Dtc[]>();

    emit(onProgress, { step: 'dtc', completed: 0, total: modeEntries.length });
    for (const [index, entry] of modeEntries.entries()) {
      try {
        codesByMode.set(entry.mode, await this.service.readDtcGroup(entry.mode));
        modeSupport[entry.key] = true;
      } catch (error) {
        if (!handledAsWarning(error, warnings, { code: 'mode-unsupported', mode: entry.mode })) {
          throw error;
        }
      }
      emit(onProgress, {
        step: 'dtc',
        completed: index + 1,
        total: modeEntries.length,
      });
    }

    const stored = codesByMode.get(3) ?? [];
    const pending = codesByMode.get(7) ?? [];
    const permanent = codesByMode.get(10) ?? [];

    if (status && modeSupport.stored && status.mil.dtcCount !== stored.length) {
      warnings.push({
        code: 'dtc-count-mismatch',
        reported: status.mil.dtcCount,
        received: stored.length,
      });
    }

    emit(onProgress, { step: 'vin', completed: 0, total: 1 });
    let vin: VinResult | null = null;
    try {
      vin = await this.service.readVin();
      if (vin.applicable && !vin.valid) {
        warnings.push({
          code: 'vin-invalid',
          detail: `check digit ${vin.checkDigit}, expected ${vin.expectedCheckDigit}`,
        });
      }
    } catch (error) {
      if (!handledAsWarning(error, warnings, { code: 'vin-unavailable' })) {
        throw error;
      }
    }
    emit(onProgress, { step: 'vin', completed: 1, total: 1 });

    const livePids = CORE_PID_IDS.filter((pid) => supportedSet.has(pid));
    const live: ScanResult['live'] = [];
    if (livePids.length > 0) {
      emit(onProgress, { step: 'live', completed: 0, total: livePids.length });
      for (const [index, pid] of livePids.entries()) {
        try {
          live.push(await this.service.readPid(pid));
        } catch (error) {
          if (!handledAsWarning(error, warnings, { code: 'pid-no-data', pid })) {
            throw error;
          }
        }
        emit(onProgress, {
          step: 'live',
          completed: index + 1,
          total: livePids.length,
        });
      }
    }

    const freezeFrames: ScanResult['freezeFrames'] = [];
    if (includeFreezeFrames && stored.length > 0) {
      const frameCount = Math.min(stored.length, MAX_FREEZE_FRAMES);
      let freezeWarningAdded = false;
      emit(onProgress, { step: 'freeze', completed: 0, total: frameCount });

      for (let frame = 0; frame < frameCount; frame += 1) {
        try {
          freezeFrames.push(await this.service.readFreezeFrame(frame));
          modeSupport.freezeFrame = true;
        } catch (error) {
          if (isOptionalReadError(error)) {
            if (!freezeWarningAdded) {
              warnings.push({
                code: 'freeze-frame-unavailable',
                mode: 2,
                detail: `frame ${frame}: ${errorMessage(error)}`,
              });
              freezeWarningAdded = true;
            }
          } else if (isObdError(error) && error.code === 'malformed-response') {
            warnings.push({
              code: 'malformed-response',
              detail: `frame ${frame}: ${errorMessage(error)}`,
            });
          } else {
            throw error;
          }
        }
        emit(onProgress, { step: 'freeze', completed: frame + 1, total: frameCount });
      }
    }

    const finished = this.now();
    return {
      adapter: this.adapter,
      protocol: this.adapter.protocol,
      vin,
      status,
      stored,
      pending,
      permanent,
      modeSupport,
      freezeFrames,
      live,
      supportedPids: supported.pids,
      warnings,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: Math.max(0, finished - started),
    };
  }
}
