import type { Elm327Driver } from '../elm327/driver';
import { ObdService, isOptionalReadError } from './obdService';
import type { PidReading } from './pids';

export interface LivePollerOptions {
  /** Initial list of PIDs to poll sequentially. */
  pids?: number[];
  /** Callback fired for each decoded PID reading. */
  onReading: (reading: PidReading) => void;
  /** Callback fired when an error occurs during polling. */
  onError?: (error: Error, pid: number) => void;
  /** Callback fired periodically with the current update rate (readings per second). */
  onRate?: (hz: number) => void;
}

/**
 * Calculates adaptive inter-command delay based on the number of polled PIDs.
 * Fewer PIDs: minimal delay to achieve highest refresh rate (e.g. 5–15+ Hz).
 * Many PIDs: throttled to prevent serial buffer overrun and bus saturation.
 */
export function calculatePollDelayMs(pidCount: number): number {
  if (pidCount <= 2) return 10;
  if (pidCount <= 4) return 15;
  if (pidCount <= 8) return 40;
  return 100;
}

/**
 * Sequential live telemetry poller for ELM327 OBD-II ports.
 *
 * Runs non-blocking asynchronous cycles without freezing the UI thread.
 * Pauses or stops cleanly when leaving the screen or starting a full scan/clear.
 */
export class LivePoller {
  private readonly service: ObdService;
  private pids: number[];
  private readonly onReading: (reading: PidReading) => void;
  private readonly onError?: (error: Error, pid: number) => void;
  private readonly onRate?: (hz: number) => void;

  private running = false;
  private paused = false;
  private cyclePromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;

  // Rate tracking
  private recentTimestamps: number[] = [];
  private rateIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private pauseWakeup?: () => void;

  constructor(driver: Elm327Driver, options: LivePollerOptions) {
    this.service = new ObdService(driver);
    this.pids = options.pids ? [...options.pids] : [];
    this.onReading = options.onReading;
    this.onError = options.onError;
    this.onRate = options.onRate;
  }

  get isRunning(): boolean {
    return this.running && !this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPids(pids: number[]): void {
    this.pids = [...pids];
  }

  start(): void {
    if (this.running) {
      if (this.paused) this.resume();
      return;
    }

    this.running = true;
    this.paused = false;
    this.abortController = new AbortController();
    this.recentTimestamps = [];

    if (this.onRate) {
      this.rateIntervalTimer = setInterval(() => {
        const now = Date.now();
        this.recentTimestamps = this.recentTimestamps.filter((ts) => now - ts < 1000);
        this.onRate?.(this.recentTimestamps.length);
      }, 500);
    }

    this.cyclePromise = this.pollLoop(this.abortController.signal);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.pauseWakeup?.();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    this.pauseWakeup?.();

    if (this.rateIntervalTimer) {
      clearInterval(this.rateIntervalTimer);
      this.rateIntervalTimer = null;
    }

    this.abortController?.abort();
    this.abortController = null;

    if (this.cyclePromise) {
      await this.cyclePromise.catch(() => undefined);
      this.cyclePromise = null;
    }
  }

  private async pollLoop(signal: AbortSignal): Promise<void> {
    let pidIndex = 0;

    while (this.running && !signal.aborted) {
      if (this.paused || this.pids.length === 0) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 50);
          this.pauseWakeup = () => {
            clearTimeout(timeout);
            resolve();
          };
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
        this.pauseWakeup = undefined;
        continue;
      }

      if (pidIndex >= this.pids.length) {
        pidIndex = 0;
      }

      const pid = this.pids[pidIndex];
      if (pid !== undefined) {
        try {
          const reading = await this.service.readPid(pid);
          if (!this.running || signal.aborted) break;

          this.recentTimestamps.push(Date.now());
          this.onReading(reading);
        } catch (error) {
          if (!this.running || signal.aborted) break;

          if (this.onError) {
            this.onError(error instanceof Error ? error : new Error(String(error)), pid);
          }

          // Serious connection error (not just optional NO DATA): pause or break
          if (!isOptionalReadError(error)) {
            // Give transport breathing room on error
            await this.delay(200, signal);
          }
        }
      }

      pidIndex += 1;
      const throttleMs = calculatePollDelayMs(this.pids.length);
      await this.delay(throttleMs, signal);
    }
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => resolve(), ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  }
}
