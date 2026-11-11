export type ElmErrorCode =
  | 'timeout'
  | 'no-data'
  | 'unable-to-connect'
  | 'bus-init-error'
  | 'can-error'
  | 'buffer-full'
  | 'unknown-command'
  | 'adapter-error'
  | 'empty-response'
  | 'transport'
  | 'open-failed'
  | 'closed';

/** Every adapter/protocol failure surfaces as a typed error; nothing is swallowed. */
export class ElmError extends Error {
  readonly code: ElmErrorCode;
  readonly raw?: string;

  constructor(code: ElmErrorCode, message?: string, raw?: string) {
    super(message ?? code);
    this.name = 'ElmError';
    this.code = code;
    this.raw = raw;
  }
}

export function isElmError(error: unknown): error is ElmError {
  return error instanceof ElmError;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
