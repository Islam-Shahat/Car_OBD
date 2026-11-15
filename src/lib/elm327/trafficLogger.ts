/**
 * Raw ELM327 traffic logger with in-memory ring buffer, automatic VIN redaction,
 * and support export capabilities.
 */

export interface TrafficLogEntry {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  content: string;
  durationMs?: number;
}

export interface TrafficLoggerOptions {
  maxEntries?: number;
  redactVin?: boolean;
}

const DEFAULT_MAX_ENTRIES = 1000;

// Standard 17-character VIN regex (excluding I, O, Q per ISO 3779)
const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

// Mode 09 PID 02 positive response prefix (hex)
const MODE_09_02_PREFIX = /\b49\s*02\b/i;

export class TrafficLogger {
  private static instance: TrafficLogger | null = null;

  private enabled = false;
  private maxEntries: number;
  private redactVinEnabled: boolean;
  private entries: TrafficLogEntry[] = [];
  private entryIdCounter = 0;

  constructor(options: TrafficLoggerOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.redactVinEnabled = options.redactVin ?? true;
  }

  static getInstance(): TrafficLogger {
    if (!TrafficLogger.instance) {
      TrafficLogger.instance = new TrafficLogger();
    }
    return TrafficLogger.instance;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isRedactVinEnabled(): boolean {
    return this.redactVinEnabled;
  }

  setRedactVinEnabled(enabled: boolean): void {
    this.redactVinEnabled = enabled;
  }

  clear(): void {
    this.entries = [];
  }

  getEntries(): readonly TrafficLogEntry[] {
    return this.entries;
  }

  logTx(command: string): void {
    if (!this.enabled) return;
    this.addEntry({
      id: `tx-${++this.entryIdCounter}`,
      timestamp: new Date().toISOString(),
      direction: 'TX',
      content: command.trim(),
    });
  }

  logRx(raw: string, durationMs?: number): void {
    if (!this.enabled) return;
    const sanitized = this.redactVinEnabled ? this.redact(raw) : raw;
    this.addEntry({
      id: `rx-${++this.entryIdCounter}`,
      timestamp: new Date().toISOString(),
      direction: 'RX',
      content: sanitized.trim(),
      durationMs: durationMs !== undefined ? Math.round(durationMs) : undefined,
    });
  }

  /**
   * Redacts 17-character VIN patterns and Mode 09 PID 02 hex payloads.
   */
  redact(text: string): string {
    let result = text.replace(VIN_REGEX, '[REDACTED_VIN]');

    // If Mode 09 PID 02 response lines are present, mask the hex payload
    if (MODE_09_02_PREFIX.test(result)) {
      result = result.replace(/(49\s*02(?:\s+[0-9A-Fa-f]{2})+)/gi, '49 02 [REDACTED_VIN_DATA]');
    }

    return result;
  }

  private addEntry(entry: TrafficLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  /**
   * Formats the log into an exportable text format suitable for support/troubleshooting.
   */
  exportLog(metadata?: { appVersion?: string; adapterInfo?: string }): string {
    const lines: string[] = [];
    lines.push('=== OBD DIAGNOSE - RAW ELM327 TRAFFIC LOG ===');
    lines.push(`Generated: ${new Date().toISOString()}`);
    if (metadata?.appVersion) lines.push(`App Version: ${metadata.appVersion}`);
    if (metadata?.adapterInfo) lines.push(`Adapter: ${metadata.adapterInfo}`);
    lines.push(`Total Entries: ${this.entries.length}`);
    lines.push(`VIN Redacted: ${this.redactVinEnabled ? 'YES' : 'NO'}`);
    lines.push('================================================\n');

    for (const entry of this.entries) {
      const dur = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : '';
      lines.push(`[${entry.timestamp}] ${entry.direction}${dur}: ${entry.content}`);
    }

    return lines.join('\n');
  }
}

export const trafficLogger = TrafficLogger.getInstance();
