import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify, signEd25519, verifyEd25519 } from '../src/lib/remoteConfig/crypto';
import { FALLBACK_REMOTE_CONFIG } from '../src/lib/remoteConfig/defaults';
import { RemoteConfigService } from '../src/lib/remoteConfig/remoteConfigService';
import type {
  RemoteConfigPayload,
  SignedRemoteConfigEnvelope,
} from '../src/lib/remoteConfig/types';
import { compareSemver } from '../src/lib/remoteConfig/version';
import { InMemoryRemoteConfigCacheRepository } from '../src/lib/db/inMemoryRepositories';
import { applyDtcPackUpdate } from '../src/lib/db/dtcPackUpdate';
import { createTestDatabase } from './helpers/sqlite';

// Test Ed25519 Keypair
const TEST_PUB_KEY = 'ZVRZNYrjEECIBwbxasdiuqIXMIIpVv2aD7YEcfNAwQs=';
const TEST_PRIV_KEY = 'MC4CAQAwBQYDK2VwBCIEIKObWeNVvoqvRSThXpxcQKvYNrlwUcZUBdjMBYYgSrxC';

async function createSignedEnvelope(
  config: RemoteConfigPayload,
  privKey: string = TEST_PRIV_KEY,
): Promise<SignedRemoteConfigEnvelope> {
  const canonical = canonicalJsonStringify(config);
  const signature = await signEd25519(privKey, canonical);
  return { config, signature };
}

describe('Ed25519 Cryptographic Verification and Canonical JSON', () => {
  it('correctly signs and verifies valid canonical payload', async () => {
    const config: RemoteConfigPayload = {
      app_enabled: true,
      min_version: '0.1.0',
      latest_version: '0.1.1',
      message: { ar: 'مرحبًا', en: 'Hello' },
      features: { clear_codes: true, live_data: true, pre_purchase_report: true },
      issued_at: '2026-11-15T12:00:00.000Z',
    };

    const envelope = await createSignedEnvelope(config);
    const isValid = await verifyEd25519(
      TEST_PUB_KEY,
      envelope.signature,
      canonicalJsonStringify(envelope.config),
    );
    expect(isValid).toBe(true);
  });

  it('rejects tampered config payloads', async () => {
    const config: RemoteConfigPayload = {
      app_enabled: false,
      min_version: '0.1.0',
      latest_version: '0.1.1',
      message: { ar: 'معطل', en: 'Disabled' },
      features: { clear_codes: false, live_data: false, pre_purchase_report: false },
      issued_at: '2026-11-15T12:00:00.000Z',
    };

    const envelope = await createSignedEnvelope(config);

    // Attacker tampers payload to re-enable app
    const tamperedConfig = { ...envelope.config, app_enabled: true };

    const isValid = await verifyEd25519(
      TEST_PUB_KEY,
      envelope.signature,
      canonicalJsonStringify(tamperedConfig),
    );
    expect(isValid).toBe(false);
  });

  it('rejects invalid or corrupted signatures', async () => {
    const config: RemoteConfigPayload = {
      app_enabled: true,
      min_version: '0.1.0',
      latest_version: '0.1.0',
      message: null,
      features: { clear_codes: true, live_data: true, pre_purchase_report: true },
      issued_at: '2026-11-15T12:00:00.000Z',
    };

    const envelope = await createSignedEnvelope(config);
    const corruptedSig =
      envelope.signature.substring(0, 10) + 'AAAA' + envelope.signature.substring(14);

    const isValid = await verifyEd25519(
      TEST_PUB_KEY,
      corruptedSig,
      canonicalJsonStringify(envelope.config),
    );
    expect(isValid).toBe(false);
  });
});

describe('RemoteConfigService: Sync, Anti-rollback, Caching, and In-Flight Safeguard', () => {
  it('fetches, verifies, and caches valid remote config from a mock endpoint', async () => {
    const repository = new InMemoryRemoteConfigCacheRepository();
    const config: RemoteConfigPayload = {
      app_enabled: true,
      min_version: '0.1.0',
      latest_version: '0.1.2',
      message: null,
      features: { clear_codes: true, live_data: true, pre_purchase_report: true },
      issued_at: '2026-11-15T14:00:00.000Z',
    };
    const envelope = await createSignedEnvelope(config);

    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const service = new RemoteConfigService({
      repository,
      publicKey: TEST_PUB_KEY,
      fetchFn: mockFetch as unknown as typeof fetch,
      currentVersion: '0.1.0',
    });

    const res = await service.sync();
    expect(res.status).toBe('success');
    expect(res.config.latest_version).toBe('0.1.2');
    expect(res.isUpdateAvailable).toBe(true);
    expect(res.isUpdateRequired).toBe(false);

    // Verify stored in SQLite cache
    const latestCache = await repository.latest();
    expect(latestCache).not.toBeNull();
    expect(latestCache?.signature).toBe(envelope.signature);
  });

  it('rejects older configs via anti-rollback mechanism', async () => {
    const repository = new InMemoryRemoteConfigCacheRepository();

    // Already cached newer config
    const newerConfig: RemoteConfigPayload = {
      app_enabled: true,
      min_version: '0.1.0',
      latest_version: '0.1.1',
      message: null,
      features: { clear_codes: true, live_data: true, pre_purchase_report: true },
      issued_at: '2026-11-15T15:00:00.000Z',
    };
    await repository.save({
      json: JSON.stringify(newerConfig),
      signature: 'dummy-sig',
      fetchedAt: '2026-11-15T15:00:00.000Z',
    });

    // Attacker replays older config
    const replayedOlderConfig: RemoteConfigPayload = {
      app_enabled: false,
      min_version: '0.1.0',
      latest_version: '0.1.0',
      message: { ar: 'قديم', en: 'Old' },
      features: { clear_codes: false, live_data: false, pre_purchase_report: false },
      issued_at: '2026-11-15T12:00:00.000Z', // 3 hours older
    };
    const envelope = await createSignedEnvelope(replayedOlderConfig);

    const mockFetch = () =>
      Promise.resolve(new Response(JSON.stringify(envelope), { status: 200 }));

    const service = new RemoteConfigService({
      repository,
      publicKey: TEST_PUB_KEY,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await service.sync();
    // Anti-rollback rejects older config and preserves the cached one
    expect(res.status).toBe('offline_cached');
    expect(res.config.issued_at).toBe('2026-11-15T15:00:00.000Z');
    expect(res.error).toContain('Anti-rollback rejection');
  });

  it('fails open on network outage using cached config, or default on clean start', async () => {
    const repository = new InMemoryRemoteConfigCacheRepository();

    const failingFetch = () => Promise.reject(new Error('Network error: ENOTFOUND'));

    const service = new RemoteConfigService({
      repository,
      publicKey: TEST_PUB_KEY,
      fetchFn: failingFetch as unknown as typeof fetch,
    });

    // 1. Clean start without cache -> fallback default
    const res1 = await service.sync();
    expect(res1.status).toBe('fallback_default');
    expect(res1.config.app_enabled).toBe(true);

    // 2. Once a config has been cached, network outage falls back to cache
    await repository.save({
      json: JSON.stringify({
        ...FALLBACK_REMOTE_CONFIG,
        latest_version: '0.1.5',
      }),
      signature: 'valid-sig',
      fetchedAt: '2026-11-15T16:00:00.000Z',
    });

    const res2 = await service.sync();
    expect(res2.status).toBe('offline_cached');
    expect(res2.config.latest_version).toBe('0.1.5');
  });

  it('defers applying changes when a diagnostic scan or clear is in-flight', async () => {
    const repository = new InMemoryRemoteConfigCacheRepository();
    const disabledConfig: RemoteConfigPayload = {
      app_enabled: false,
      min_version: '0.1.0',
      latest_version: '0.1.0',
      message: { ar: 'إيقاف طارئ', en: 'Emergency disable' },
      features: { clear_codes: false, live_data: false, pre_purchase_report: false },
      issued_at: '2026-11-15T17:00:00.000Z',
    };
    const envelope = await createSignedEnvelope(disabledConfig);

    const mockFetch = () =>
      Promise.resolve(new Response(JSON.stringify(envelope), { status: 200 }));

    const service = new RemoteConfigService({
      repository,
      publicKey: TEST_PUB_KEY,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    // In-flight operation active (isBusy: true)
    const res = await service.sync({ isBusy: true });
    expect(res.status).toBe('success');
    // Active config is NOT disabled yet
    expect(res.config.app_enabled).toBe(true);
    expect(res.pendingConfig?.app_enabled).toBe(false);

    // Once the operation completes, apply pending config
    const applied = service.applyPendingConfig();
    expect(applied?.app_enabled).toBe(false);
    expect(service.getActiveConfig().app_enabled).toBe(false);
    expect(service.getPendingConfig()).toBeNull();
  });
});

describe('Semver Comparison Helper', () => {
  it('correctly compares version tags', () => {
    expect(compareSemver('0.1.0', '0.1.1')).toBe(-1);
    expect(compareSemver('v0.1.1', '0.1.0')).toBe(1);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
    expect(compareSemver('0.1.0', '1.0.0')).toBe(-1);
    expect(compareSemver('1.2.0', '1.1.9')).toBe(1);
  });
});

describe('DTC Data Pack Atomic Update Hook', () => {
  it('applies signed data pack in a single transaction while preserving human reviews', async () => {
    const db = createTestDatabase();

    // Create minimal schema for dtc_codes and settings
    await db.execute(`
      CREATE TABLE dtc_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        make TEXT,
        description_en TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        severity TEXT,
        severity_source TEXT NOT NULL,
        possible_causes_en TEXT,
        possible_causes_ar TEXT,
        inspection_steps_en TEXT,
        inspection_steps_ar TEXT,
        source TEXT NOT NULL,
        source_version TEXT NOT NULL,
        translation_tier INTEGER NOT NULL,
        needs_review INTEGER NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE settings (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `);

    // Insert an existing human-reviewed code
    await db.execute(
      `INSERT INTO dtc_codes (
        id, code, make, description_en, description_ar, severity, severity_source,
        possible_causes_en, possible_causes_ar, inspection_steps_en, inspection_steps_ar,
        source, source_version, translation_tier, needs_review, reviewed_by, reviewed_at,
        created_at, updated_at
      ) VALUES (
        'dtc-p0133', 'P0133', NULL, 'Old EN', 'ترجمة بشرية معتمدة لحساس الأكسجين', 'medium', 'heuristic',
        '[]', '["سبب معتمد"]', '[]', '["خطوة معتمدة"]',
        'OBDex', '1.0', 1, 0, 'Expert Mechanic', '2026-11-10', '2026-11-10', '2026-11-10'
      )`,
    );

    // New versioned pack containing updated P0133 and new P0300
    const newPack = {
      version: '2.0.0',
      source: 'OBDex',
      sourceVersion: '2.0',
      generatedAt: '2026-11-15T00:00:00.000Z',
      codes: [
        {
          code: 'P0133',
          category: 'powertrain',
          descriptionEn: 'New Upstream O2 Slow Response',
          descriptionAr: 'ترجمة آلية جديدة سيتم تجاهلها لحفظ المراجعة',
          severity: 'high',
          severitySource: 'heuristic' as const,
          causesEn: ['New Cause EN'],
          causesAr: ['سبب جديد'],
          stepsEn: ['New Step EN'],
          stepsAr: ['خطوة جديدة'],
          tier: 1 as const,
          needsReview: true,
        },
        {
          code: 'P0300',
          category: 'powertrain',
          descriptionEn: 'Random Misfire',
          descriptionAr: 'احتراق عشوائي',
          severity: 'high',
          severitySource: 'heuristic' as const,
          causesEn: [],
          causesAr: [],
          stepsEn: [],
          stepsAr: [],
          tier: 1 as const,
          needsReview: true,
        },
      ],
    };

    const rawPackJson = JSON.stringify(newPack);
    const signature = await signEd25519(TEST_PRIV_KEY, rawPackJson);

    const result = await applyDtcPackUpdate(db, newPack, rawPackJson, signature, TEST_PUB_KEY);

    expect(result.appliedVersion).toBe('2.0.0');
    expect(result.totalCodes).toBe(2);
    expect(result.preservedReviews).toBe(1);

    // Verify human-reviewed translation was preserved
    const p0133 = (
      await db.select<{ description_ar: string; description_en: string; needs_review: number }>(
        "SELECT description_ar, description_en, needs_review FROM dtc_codes WHERE code = 'P0133'",
      )
    )[0];
    expect(p0133?.description_ar).toBe('ترجمة بشرية معتمدة لحساس الأكسجين');
    expect(p0133?.description_en).toBe('New Upstream O2 Slow Response');
    expect(p0133?.needs_review).toBe(0);

    // Verify new code was inserted
    const p0300 = (
      await db.select<{ code: string; description_en: string }>(
        "SELECT code, description_en FROM dtc_codes WHERE code = 'P0300'",
      )
    )[0];
    expect(p0300?.code).toBe('P0300');

    // Verify settings updated
    const packSetting = (
      await db.select<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'dtc_pack_version'",
      )
    )[0];
    expect(packSetting?.value).toBe('2.0.0');
  });
});
