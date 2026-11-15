import { GITHUB_PAGES_CONFIG_URL } from '../projectUrls';
import type { RemoteConfigPayload } from './types';

/**
 * Embedded Ed25519 public key used to verify all incoming remote configurations.
 * Only configurations signed with the matching offline private key are accepted.
 */
export const DEFAULT_REMOTE_CONFIG_PUBLIC_KEY = 'ZVRZNYrjEECIBwbxasdiuqIXMIIpVv2aD7YEcfNAwQs=';

/**
 * Default static distribution endpoint hosted on GitHub Pages.
 */
export const DEFAULT_REMOTE_CONFIG_URL = GITHUB_PAGES_CONFIG_URL;

/**
 * The current application version.
 */
export const CURRENT_APP_VERSION = '0.9.0-rc.1';

/**
 * Fail-open default configuration used when offline on first launch
 * before any signed configuration has been cached in SQLite.
 */
export const FALLBACK_REMOTE_CONFIG: RemoteConfigPayload = {
  app_enabled: true,
  min_version: '0.1.0',
  latest_version: '0.1.0',
  message: null,
  features: {
    clear_codes: true,
    live_data: true,
    pre_purchase_report: true,
  },
  issued_at: '2026-01-01T00:00:00.000Z',
};
