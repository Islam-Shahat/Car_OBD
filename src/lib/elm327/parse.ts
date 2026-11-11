import type { ElmErrorCode } from './errors';

const SEARCHING_LINE = /^SEARCHING(\.+)?$/i;
const BUS_INIT_OK_LINE = /^BUS INIT:?\s*\.*\s*OK$/i;

export interface ElmFailurePattern {
  pattern: RegExp;
  code: ElmErrorCode;
}

/** Tokens an ELM327-compatible adapter uses to reject a request or report a bus fault. */
export const ELM_FAILURE_PATTERNS: readonly ElmFailurePattern[] = [
  { pattern: /^NO DATA$/i, code: 'no-data' },
  { pattern: /^UNABLE TO CONNECT$/i, code: 'unable-to-connect' },
  { pattern: /^BUS INIT:?.*ERROR$/i, code: 'bus-init-error' },
  { pattern: /^CAN ERROR$/i, code: 'can-error' },
  { pattern: /^BUFFER FULL$/i, code: 'buffer-full' },
  { pattern: /^\?$/, code: 'unknown-command' },
  {
    pattern: /^(STOPPED|ERROR|DATA ERROR|<DATA ERROR>|<RX ERROR>)$/i,
    code: 'adapter-error',
  },
];

function compareForm(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** The adapter echoes the command while echo is still on (before `ATE0` takes effect). */
export function isEchoLine(line: string, command: string): boolean {
  return compareForm(line) === compareForm(command);
}

/**
 * Splits a raw adapter response into meaningful lines:
 * drops CR/LF noise, the command echo, the `>` prompt, `SEARCHING...` progress and
 * `BUS INIT: ...OK` chatter. Multi-frame payload lines (`0: ...`, `1: ...`) are kept.
 */
export function normalizeResponse(raw: string, command: string): string[] {
  const lines: string[] = [];

  for (const rawLine of raw.replace(/\r/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (line.length === 0 || line === '>') continue;
    if (isEchoLine(line, command)) continue;
    if (SEARCHING_LINE.test(line)) continue;
    if (BUS_INIT_OK_LINE.test(line)) continue;

    lines.push(line);
  }

  return lines;
}

export function classifyElmFailure(lines: readonly string[]): ElmErrorCode | null {
  for (const line of lines) {
    for (const failure of ELM_FAILURE_PATTERNS) {
      if (failure.pattern.test(line)) {
        return failure.code;
      }
    }
  }
  return null;
}
