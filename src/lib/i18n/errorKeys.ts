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
