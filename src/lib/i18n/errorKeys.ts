import type { ElmErrorCode } from '../elm327/errors';

/** Every failure the connection layer can surface, plus the unknown fallback. */
export type UiErrorCode = ElmErrorCode | 'disconnected' | 'ports-unavailable' | 'unknown';

/** Friendly, translated message for each adapter/protocol failure. */
export const ERROR_MESSAGE_KEYS = {
  timeout: 'errors.timeout',
  'no-data': 'errors.no-data',
  'unable-to-connect': 'errors.unable-to-connect',
  'bus-init-error': 'errors.bus-init-error',
  'can-error': 'errors.can-error',
  'buffer-full': 'errors.buffer-full',
  'unknown-command': 'errors.unknown-command',
  'adapter-error': 'errors.adapter-error',
  'empty-response': 'errors.empty-response',
  transport: 'errors.transport',
  'open-failed': 'errors.open-failed',
  closed: 'errors.closed',
  disconnected: 'errors.disconnected',
  'ports-unavailable': 'errors.ports-unavailable',
  unknown: 'errors.unknown',
} as const satisfies Record<UiErrorCode, string>;

export type ErrorMessageKey = (typeof ERROR_MESSAGE_KEYS)[UiErrorCode];

/**
 * Common SAE J1979 / ISO 14229 negative response codes. The map is intentionally
 * small: unknown NRCs fall back to a translated message that includes the code.
 */
export const NRC_MESSAGE_KEYS = {
  0x10: 'errors.nrc.generalReject',
  0x11: 'errors.nrc.serviceNotSupported',
  0x12: 'errors.nrc.subFunctionNotSupported',
  0x13: 'errors.nrc.incorrectLength',
  0x21: 'errors.nrc.busy',
  0x22: 'errors.nrc.conditionsNotCorrect',
  0x31: 'errors.nrc.requestOutOfRange',
  0x33: 'errors.nrc.securityDenied',
  0x78: 'errors.nrc.responsePending',
  0x7e: 'errors.nrc.serviceNotSupportedInSession',
  0x7f: 'errors.nrc.serviceNotSupportedInSession',
} as const satisfies Record<number, string>;

export type NrcMessageKey =
  (typeof NRC_MESSAGE_KEYS)[keyof typeof NRC_MESSAGE_KEYS] | 'errors.nrc.unknown';

/** Friendly message key for an NRC; every unknown code still gets a translated fallback. */
export function nrcMessageKey(nrc: number): NrcMessageKey {
  return NRC_MESSAGE_KEYS[nrc as keyof typeof NRC_MESSAGE_KEYS] ?? 'errors.nrc.unknown';
}
