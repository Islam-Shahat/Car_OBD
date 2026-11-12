/** Failures that belong to the OBD service layer, not to the serial adapter. */
export type ObdErrorCode =
  | 'malformed-response'
  | 'service-rejected'
  | 'busy'
  | 'clear-refused'
  | 'clear-failed'
  | 'backup-failed';

export interface ObdErrorOptions {
  /** Negative response code reported by the ECU (ISO 14229 / SAE J1979). */
  nrc?: number;
  cause?: unknown;
}

export class ObdError extends Error {
  readonly code: ObdErrorCode;
  readonly nrc?: number;

  constructor(code: ObdErrorCode, message?: string, options: ObdErrorOptions = {}) {
    super(message ?? code, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ObdError';
    this.code = code;
    this.nrc = options.nrc;
  }
}

export function isObdError(error: unknown): error is ObdError {
  return error instanceof ObdError;
}

/**
 * The ECU answered, but rejected the service/sub-function. These codes are
 * normal for optional modes (07, 0A, 02) on cars that do not implement them.
 */
export function isUnsupportedServiceError(error: unknown): boolean {
  if (!isObdError(error) || error.code !== 'service-rejected') return false;
  return error.nrc === 0x11 || error.nrc === 0x12 || error.nrc === 0x22 || error.nrc === 0x31;
}
