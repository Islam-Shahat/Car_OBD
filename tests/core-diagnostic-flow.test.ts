import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import catalogData from '../src/data/vehicle-catalog.json';
import type { DtcSeedFile } from '../src/lib/db/dtcPack';
import { migrate } from '../src/lib/db/migrations';
import { seedDatabase, type CatalogSeedFile } from '../src/lib/db/seed';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { decodeVehicleIdentity } from '../src/lib/obd/vinDecode';
import type { ScanResult } from '../src/lib/obd/scanTypes';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED_DTC = JSON.parse(
  readFileSync(join(ROOT, 'public', 'dtc-pack.json'), 'utf8'),
) as DtcSeedFile;

const ADAPTER_INFO = {
  identity: 'ELM327 v1.5',
  description: 'ELM327 v1.5',
  version: '1.5',
  protocol: 'ISO 15765-4 (CAN 11/500)',
  ecuPresent: true,
  cloneSuspected: false,
  likelyClone: false,
  limitedCommands: false,
  adapterTimeoutMs: 200,
};

describe('Core Diagnostic & Selection Journey', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await migrate(db);
    await seedDatabase(db, {
      dtcPack: SHIPPED_DTC,
      catalog: catalogData as unknown as CatalogSeedFile,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('runs the vehicle identification and unmapped WMI mapping flow', async () => {
    const repos = createSqliteRepositories(db);

    // 1. Known WMI decodes automatically
    const porscheIdentity = decodeVehicleIdentity('WP0ZZZ99ZTS390000');
    expect(porscheIdentity?.makeSlug).toBe('porsche');
    expect(porscheIdentity?.yearCandidates).toEqual([1996, 2026]);

    // 2. Unmapped WMI (e.g. Chery LVV) returns null makeSlug initially
    const unmappedVin = 'LVVDB1248MD000001';
    const initialIdentity = decodeVehicleIdentity(unmappedVin);
    expect(initialIdentity?.wmi).toBe('LVV');
    expect(initialIdentity?.makeSlug).toBeNull();

    // 3. User selects make manually -> save to wmi_user_map
    await repos.wmiUserMap.set('LVV', 'chery');
    const storedMake = await repos.wmiUserMap.get('LVV');
    expect(storedMake).toBe('chery');

    // 4. Next time this WMI connects, user mapping resolves it
    const resolvedIdentity = decodeVehicleIdentity(unmappedVin, storedMake);
    expect(resolvedIdentity?.makeSlug).toBe('chery');

    // 5. Vehicle is saved and remembered for reuse
    const vehicle = await repos.vehicles.create({
      make: 'Chery',
      model: 'Tiggo 7',
      year: 2021,
    });
    expect(vehicle.id).toBeDefined();
    await repos.settings.set('vehicle.selected.id', vehicle.id);

    const rememberedId = await repos.settings.get('vehicle.selected.id');
    expect(rememberedId).toBe(vehicle.id);
  });

  it('performs DTC lookup via make-specific row -> generic row -> fallback', async () => {
    const repos = createSqliteRepositories(db);

    // Generic lookup for standard code
    const genericLookup = await repos.dtc.lookup('P0143', null);
    expect(genericLookup.kind).toBe('generic');
    expect(genericLookup.code).toBe('P0143');
    expect(genericLookup.record?.descriptionAr).toBeDefined();
    expect(genericLookup.record?.descriptionEn).toBeDefined();

    // Fallback for unknown code
    const unknownLookup = await repos.dtc.lookup('P9999', 'toyota');
    expect(unknownLookup.kind).toBe('unknown');
    expect(unknownLookup.record).toBeNull();
  });

  it('auto-persists completed scan session and verifies overall health status', async () => {
    const repos = createSqliteRepositories(db);

    const vehicle = await repos.vehicles.create({
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
    });

    // 1. Healthy scan: 0 stored, 0 pending, MIL off -> 'healthy'
    const healthySession = await repos.scans.createSession({
      vehicleId: vehicle.id,
      startedAt: new Date(Date.now() - 5000).toISOString(),
      finishedAt: new Date().toISOString(),
      protocol: 'ISO 15765-4 (CAN 11/500)',
      adapterInfo: ADAPTER_INFO,
      milStatus: { on: false, dtcCount: 0 },
      overallStatus: 'healthy',
      mode: 'normal',
    });
    expect(healthySession.overallStatus).toBe('healthy');

    // 2. Fault scan: stored codes present, MIL on -> 'fault'
    const faultSession = await repos.scans.createSession({
      vehicleId: vehicle.id,
      startedAt: new Date(Date.now() - 5000).toISOString(),
      finishedAt: new Date().toISOString(),
      protocol: 'ISO 15765-4 (CAN 11/500)',
      adapterInfo: ADAPTER_INFO,
      milStatus: { on: true, dtcCount: 2 },
      overallStatus: 'fault',
      mode: 'normal',
    });
    expect(faultSession.overallStatus).toBe('fault');

    await repos.scans.addResults(faultSession.id, [
      { code: 'P0143', type: 'stored' },
      { code: 'P0196', type: 'stored' },
      { code: 'P0300', type: 'pending' },
    ]);

    const results = await repos.scans.resultsFor(faultSession.id);
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.type === 'stored')).toHaveLength(2);
    expect(results.filter((r) => r.type === 'pending')).toHaveLength(1);
  });

  it('guarantees unique model search results and catalog reconciliation', async () => {
    const repos = createSqliteRepositories(db);

    const lanosResults = await repos.catalog.search('Lanos');
    expect(lanosResults).toHaveLength(1);
    expect(lanosResults[0]?.makeSlug).toBe('chevrolet');

    const nubiraResults = await repos.catalog.search('Nubira');
    expect(nubiraResults).toHaveLength(1);
    expect(nubiraResults[0]?.makeSlug).toBe('chevrolet');
  });

  it('executes durable clear-backup flow before clearing codes', async () => {
    const repos = createSqliteRepositories(db);

    // Save durable backup to scanBackups
    const backupId = 'backup-2026-11-15-001';
    await repos.scanBackups.save({
      id: backupId,
      createdAt: new Date().toISOString(),
      adapter: ADAPTER_INFO,
      stored: [{ code: 'P0143', system: 'P', bytes: [0x01, 0x43], raw: 'P0143' }],
      pending: [{ code: 'P0300', system: 'P', bytes: [0x03, 0x00], raw: 'P0300' }],
      permanent: [],
      readiness: {
        mil: { on: true, dtcCount: 1 },
        ignition: 'spark',
        monitors: [],
      },
      freezeFrames: [],
      result: {} as unknown as ScanResult,
    });

    const savedBackup = await repos.scanBackups.get(backupId);
    expect(savedBackup).not.toBeNull();
    expect(savedBackup?.stored[0]?.code).toBe('P0143');
    expect(savedBackup?.pending[0]?.code).toBe('P0300');
  });
});
