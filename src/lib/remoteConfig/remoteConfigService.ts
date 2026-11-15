import type { RemoteConfigCacheRepository } from '../db/repositories';
import { canonicalJsonStringify, verifyEd25519 } from './crypto';
import {
  CURRENT_APP_VERSION,
  DEFAULT_REMOTE_CONFIG_PUBLIC_KEY,
  DEFAULT_REMOTE_CONFIG_URL,
  FALLBACK_REMOTE_CONFIG,
} from './defaults';
import type {
  RemoteConfigFetchStatus,
  RemoteConfigPayload,
  SignedRemoteConfigEnvelope,
} from './types';
import { compareSemver } from './version';

export interface RemoteConfigServiceOptions {
  repository?: RemoteConfigCacheRepository;
  publicKey?: string;
  endpointUrl?: string;
  currentVersion?: string;
  fetchFn?: typeof fetch;
}

export interface RemoteConfigResolution {
  config: RemoteConfigPayload;
  status: RemoteConfigFetchStatus;
  error: string | null;
  pendingConfig: RemoteConfigPayload | null;
  isUpdateRequired: boolean;
  isUpdateAvailable: boolean;
}

export class RemoteConfigService {
  private readonly repository?: RemoteConfigCacheRepository;
  private readonly publicKey: string;
  private readonly endpointUrl: string;
  private readonly currentVersion: string;
  private readonly fetchFn: typeof fetch;

  private activeConfig: RemoteConfigPayload = FALLBACK_REMOTE_CONFIG;
  private pendingConfig: RemoteConfigPayload | null = null;

  constructor(options: RemoteConfigServiceOptions = {}) {
    this.repository = options.repository;
    this.publicKey = options.publicKey ?? DEFAULT_REMOTE_CONFIG_PUBLIC_KEY;
    this.endpointUrl = options.endpointUrl ?? DEFAULT_REMOTE_CONFIG_URL;
    this.currentVersion = options.currentVersion ?? CURRENT_APP_VERSION;
    this.fetchFn =
      options.fetchFn ??
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : () => Promise.reject(new Error('fetch is not defined')));
  }

  getActiveConfig(): RemoteConfigPayload {
    return this.activeConfig;
  }

  getPendingConfig(): RemoteConfigPayload | null {
    return this.pendingConfig;
  }

  /**
   * Applies any staged config that was held back while a diagnostic operation was in-flight.
   */
  applyPendingConfig(): RemoteConfigPayload | null {
    if (!this.pendingConfig) return null;
    const applied = this.pendingConfig;
    this.activeConfig = applied;
    this.pendingConfig = null;
    return applied;
  }

  /**
   * Loads the cached configuration from SQLite if available.
   */
  async loadCachedConfig(): Promise<RemoteConfigPayload | null> {
    if (!this.repository) return null;
    try {
      const cached = await this.repository.latest();
      if (!cached) return null;
      const parsed = JSON.parse(cached.json) as RemoteConfigPayload;
      if (this.isValidConfigPayload(parsed)) {
        this.activeConfig = parsed;
        return parsed;
      }
    } catch {
      // Ignored: corrupt cache entry falls back gracefully
    }
    return null;
  }

  /**
   * Fetches the signed remote configuration from the CDN/server, verifies Ed25519 signature,
   * performs anti-rollback verification, and caches it in SQLite.
   */
  async sync(options: { isBusy?: boolean } = {}): Promise<RemoteConfigResolution> {
    const cachedConfig = await this.loadCachedConfig();

    try {
      const response = await this.fetchFn(this.endpointUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const envelope = (await response.json()) as SignedRemoteConfigEnvelope;
      if (!envelope || !envelope.config || typeof envelope.signature !== 'string') {
        throw new Error('Malformed signed remote config envelope');
      }

      // 1. Ed25519 Signature Verification
      const canonicalJson = canonicalJsonStringify(envelope.config);
      const isSignatureValid = await verifyEd25519(
        this.publicKey,
        envelope.signature,
        canonicalJson,
      );

      if (!isSignatureValid) {
        throw new Error('Invalid Ed25519 signature — remote config may be tampered or corrupted');
      }

      const newConfig = envelope.config;
      if (!this.isValidConfigPayload(newConfig)) {
        throw new Error('Remote config schema is invalid');
      }

      // 2. Anti-Rollback Check
      if (cachedConfig) {
        const cachedTime = Date.parse(cachedConfig.issued_at);
        const newTime = Date.parse(newConfig.issued_at);
        if (!isNaN(cachedTime) && !isNaN(newTime) && newTime < cachedTime) {
          throw new Error(
            `Anti-rollback rejection: incoming config timestamp (${newConfig.issued_at}) is older than cached (${cachedConfig.issued_at})`,
          );
        }
      }

      // 3. Save to SQLite Cache
      if (this.repository) {
        await this.repository.save({
          json: JSON.stringify(newConfig),
          signature: envelope.signature,
          fetchedAt: new Date().toISOString(),
        });
      }

      // 4. In-Flight Safety Check: Never interrupt active scan/clear
      if (options.isBusy) {
        this.pendingConfig = newConfig;
        return {
          config: this.activeConfig,
          status: 'success',
          error: null,
          pendingConfig: this.pendingConfig,
          isUpdateRequired: compareSemver(this.currentVersion, this.activeConfig.min_version) < 0,
          isUpdateAvailable:
            compareSemver(this.currentVersion, this.activeConfig.latest_version) < 0,
        };
      }

      this.activeConfig = newConfig;
      this.pendingConfig = null;

      return {
        config: this.activeConfig,
        status: 'success',
        error: null,
        pendingConfig: null,
        isUpdateRequired: compareSemver(this.currentVersion, this.activeConfig.min_version) < 0,
        isUpdateAvailable: compareSemver(this.currentVersion, this.activeConfig.latest_version) < 0,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Graceful offline fallback: use cached if available, else fail-open defaults
      const fallback = cachedConfig ?? this.activeConfig ?? FALLBACK_REMOTE_CONFIG;
      this.activeConfig = fallback;

      return {
        config: fallback,
        status: cachedConfig ? 'offline_cached' : 'fallback_default',
        error: errorMsg,
        pendingConfig: this.pendingConfig,
        isUpdateRequired: compareSemver(this.currentVersion, fallback.min_version) < 0,
        isUpdateAvailable: compareSemver(this.currentVersion, fallback.latest_version) < 0,
      };
    }
  }

  private isValidConfigPayload(val: unknown): val is RemoteConfigPayload {
    if (!val || typeof val !== 'object') return false;
    const obj = val as Record<string, unknown>;
    return (
      typeof obj['app_enabled'] === 'boolean' &&
      typeof obj['min_version'] === 'string' &&
      typeof obj['latest_version'] === 'string' &&
      typeof obj['issued_at'] === 'string' &&
      typeof obj['features'] === 'object' &&
      obj['features'] !== null
    );
  }
}
