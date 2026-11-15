import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '../src/lib/db/inMemoryRepositories';
import { migrate } from '../src/lib/db/migrations';
import type { Repositories } from '../src/lib/db/repositories';
import { seedDatabase } from '../src/lib/db/seed';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import type { CatalogEntry, DtcCode } from '../src/lib/db/types';
import type { DtcSeedCode } from '../src/lib/db/seed';
import type { ScanBackup } from '../src/lib/obd/backup';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

const NOW = '2026-11-14T10:00:00.000Z';
const SOURCE = 'OBDex';
const VERSION = 'test-commit';

function genericSeeds(): DtcSeedCode[] {
  return [
    {
      code: 'P0100',
      category: 'powertrain',
      descriptionEn: 'Mass or Volume Air Flow Sensor A Circuit',
      descriptionAr: 'دائرة حساس تدفق الهواء A.',
      severity: 'warning',
      severitySource: 'heuristic',
      causesEn: ['Sensor faulty'],
      causesAr: ['الحساس تالف'],
      stepsEn: ['Check the wiring'],
      stepsAr: ['افحص الأسلاك'],
      tier: 1,
      needsReview: true,
    },
    {
      code: 'P0101',
      category: 'powertrain',
      descriptionEn: 'Mass Air Flow Sensor Range/Performance',
      descriptionAr: 'نطاق/أداء حساس تدفق الهواء.',
      severity: null,
      severitySource: 'heuristic',
      causesEn: [],
      causesAr: [],
      stepsEn: [],
      stepsAr: [],
      tier: 2,
      needsReview: true,
    },
  ];
}

const CATALOG_SEED: CatalogEntry[] = [
  {
    id: 'catalog-corolla',
    make: 'Toyota',
    makeSlug: 'toyota',
    model: 'Corolla',
    makeAliasesAr: ['تويوتا', 'تيوتا'],
    aliasesAr: ['كورولا'],
    aliasesEn: [],
    yearFrom: null,
    yearTo: null,
    bodyType: 'sedan',
    sourceTier: 'knowledge',
    verified: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: 'catalog-elantra',
    make: 'Hyundai',
    makeSlug: 'hyundai',
    model: 'Elantra',
    makeAliasesAr: ['هيونداي', 'هونداي', 'هيوندي'],
    aliasesAr: ['إلنترا', 'النترا', 'لنترا'],
    aliasesEn: [],
    yearFrom: null,
    yearTo: null,
    bodyType: 'sedan',
    sourceTier: 'knowledge',
    verified: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
];

function genericRows(): DtcCode[] {
  return genericSeeds().map((row, index) => ({
    id: `dtc-${index + 1}`,
    code: row.code,
    make: null,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    severity: row.severity,
    severitySource: 'heuristic',
    possibleCausesAr: row.causesAr,
    possibleCausesEn: row.causesEn,
    inspectionStepsAr: row.stepsAr,
    inspectionStepsEn: row.stepsEn,
    source: SOURCE,
    sourceVersion: VERSION,
    translationTier: row.tier,
    needsReview: row.needsReview,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  }));
}

const SPECIFIC_DTC: DtcCode = {
  id: 'dtc-specific-p0100',
  code: 'P0100',
  make: 'toyota',
  descriptionAr: 'وصف خاص بتويوتا للكود P0100.',
  descriptionEn: 'Toyota-specific P0100 description.',
  severity: 'high',
  severitySource: 'heuristic',
  possibleCausesAr: ['سبب خاص'],
  possibleCausesEn: ['Maker-specific cause'],
  inspectionStepsAr: ['خطوة خاصة'],
  inspectionStepsEn: ['Maker-specific step'],
  source: SOURCE,
  sourceVersion: VERSION,
  translationTier: 1,
  needsReview: true,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

function sequentialIds(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

async function sqliteHarness(): Promise<{ repos: Repositories; close: () => void }> {
  const db: TestDatabase = createTestDatabase();
  await migrate(db);

  await seedDatabase(db, {
    now: () => NOW,
    idFactory: sequentialIds('dtc'),
    dtcPack: {
      version: 'test-pack-1',
      source: SOURCE,
      sourceVersion: VERSION,
      generatedAt: NOW,
      codes: genericSeeds(),
    },
    catalog: {
      version: 'test-1',
      entries: CATALOG_SEED.map((entry) => ({
        id: entry.id,
        make: entry.make,
        makeSlug: entry.makeSlug,
        model: entry.model,
        makeAliasesAr: entry.makeAliasesAr,
        aliasesAr: entry.aliasesAr,
        aliasesEn: entry.aliasesEn,
        yearFrom: entry.yearFrom,
        yearTo: entry.yearTo,
        bodyType: entry.bodyType,
        sourceTier: entry.sourceTier,
        verified: entry.verified,
      })),
    },
  });

  const columns = [
    'id',
    'code',
    'make',
    'description_ar',
    'description_en',
    'severity',
    'possible_causes_ar',
    'possible_causes_en',
    'inspection_steps_ar',
    'inspection_steps_en',
    'source',
    'source_version',
    'translation_tier',
    'needs_review',
    'reviewed_by',
    'reviewed_at',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  await db.execute(
    `INSERT INTO dtc_codes (${columns.join(', ')})
     VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`,
    [
      SPECIFIC_DTC.id,
      SPECIFIC_DTC.code,
      SPECIFIC_DTC.make,
      SPECIFIC_DTC.descriptionAr,
      SPECIFIC_DTC.descriptionEn,
      SPECIFIC_DTC.severity,
      JSON.stringify(SPECIFIC_DTC.possibleCausesAr),
      JSON.stringify(SPECIFIC_DTC.possibleCausesEn),
      JSON.stringify(SPECIFIC_DTC.inspectionStepsAr),
      JSON.stringify(SPECIFIC_DTC.inspectionStepsEn),
      SPECIFIC_DTC.source,
      SPECIFIC_DTC.sourceVersion,
      SPECIFIC_DTC.translationTier,
      SPECIFIC_DTC.needsReview ? 1 : 0,
      SPECIFIC_DTC.reviewedBy,
      SPECIFIC_DTC.reviewedAt,
      SPECIFIC_DTC.createdAt,
      SPECIFIC_DTC.updatedAt,
      SPECIFIC_DTC.deletedAt,
    ],
  );

  return {
    repos: createSqliteRepositories(db, {
      now: () => NOW,
      idFactory: sequentialIds('repo'),
    }),
    close: () => db.close(),
  };
}

function memoryHarness(): { repos: Repositories; close: () => void } {
  return {
    repos: createInMemoryRepositories(
      {
        dtc: [...genericRows(), SPECIFIC_DTC],
        catalog: CATALOG_SEED,
      },
      { now: () => NOW, idFactory: sequentialIds('repo') },
    ),
    close: () => undefined,
  };
}

const HARNESSES: ReadonlyArray<{
  name: string;
  create: () =>
    | Promise<{ repos: Repositories; close: () => void }>
    | { repos: Repositories; close: () => void };
}> = [
  { name: 'SQLite', create: sqliteHarness },
  { name: 'in-memory', create: memoryHarness },
];

for (const harness of HARNESSES) {
  describe(`${harness.name} repositories`, () => {
    let repos: Repositories;
    let close: () => void;

    beforeEach(async () => {
      const created = await harness.create();
      repos = created.repos;
      close = created.close;
    });

    afterEach(() => {
      close();
    });

    it('stores, finds, updates and soft-deletes vehicles', async () => {
      const created = await repos.vehicles.create({
        catalogId: 'catalog-corolla',
        make: 'Toyota',
        model: 'Corolla',
        year: 2018,
        vin: 'jtdepraej12345678',
      });

      expect(created.id).toBe('repo-1');
      expect(created.createdAt).toBe(NOW);
      expect(created.deletedAt).toBeNull();

      expect((await repos.vehicles.get(created.id))?.model).toBe('Corolla');
      expect((await repos.vehicles.findByVin('JTDEPRAEJ12345678'))?.id).toBe(created.id);
      expect(await repos.vehicles.findByVin('')).toBeNull();

      const updated = await repos.vehicles.update(created.id, { year: 2020, notes: 'family car' });
      expect(updated?.year).toBe(2020);
      expect(updated?.notes).toBe('family car');

      const second = await repos.vehicles.create({ makeText: 'تويوتا', modelText: 'كورولا' });
      expect(second.catalogId).toBeNull();
      expect((await repos.vehicles.list()).map((row) => row.id).sort()).toEqual(
        [created.id, second.id].sort(),
      );

      await repos.vehicles.softDelete(created.id);
      expect(await repos.vehicles.get(created.id)).toBeNull();
      expect((await repos.vehicles.list()).map((row) => row.id)).toEqual([second.id]);
    });

    it('searches the catalog in Arabic and English and exposes makes', async () => {
      const makes = await repos.catalog.makes();
      expect(makes).toEqual([
        {
          make: 'Hyundai',
          makeSlug: 'hyundai',
          count: 1,
          aliasesAr: ['هيونداي', 'هونداي', 'هيوندي'],
        },
        { make: 'Toyota', makeSlug: 'toyota', count: 1, aliasesAr: ['تويوتا', 'تيوتا'] },
      ]);

      expect((await repos.catalog.search('كورولا')).map((row) => row.model)).toEqual(['Corolla']);
      expect((await repos.catalog.search('النترا')).map((row) => row.model)).toEqual(['Elantra']);
      expect((await repos.catalog.search('corolla')).map((row) => row.model)).toEqual(['Corolla']);
      expect((await repos.catalog.search('COROLLA')).map((row) => row.model)).toEqual(['Corolla']);
      expect((await repos.catalog.search('', 'hyundai')).map((row) => row.model)).toEqual([
        'Elantra',
      ]);
      expect((await repos.catalog.get('catalog-corolla'))?.make).toBe('Toyota');
      expect(await repos.catalog.count()).toBe(2);
    });

    it('matches Arabic spellings after unifying alef, ya and ta marbuta', async () => {
      // Diacritics and stray spaces are decorative for matching.
      for (const spelling of ['كورولا', 'كُورُولَّا', '  كورولا  ']) {
        expect((await repos.catalog.search(spelling)).map((row) => row.model)).toEqual(['Corolla']);
      }
      // The same word with hamza forms and diacritics must behave identically.
      const variants = ['إلنترا', 'النترا', 'إِلِنْتِرَا', 'ألنترا'];
      for (const spelling of variants) {
        expect((await repos.catalog.search(spelling)).map((row) => row.model)).toEqual(['Elantra']);
      }
      // Make aliases are searchable without picking a make first.
      expect((await repos.catalog.search('هونداي')).map((row) => row.model)).toEqual(['Elantra']);
      expect((await repos.catalog.search('هيوندي')).map((row) => row.model)).toEqual(['Elantra']);
      expect((await repos.catalog.search('تيوتا')).map((row) => row.model)).toEqual(['Corolla']);
      // Whitespace inside an Arabic name is optional.
      expect((await repos.catalog.search(' elantra ')).map((row) => row.model)).toEqual([
        'Elantra',
      ]);
    });

    it('prefers a make-specific DTC, then the generic row, then the unknown fallback', async () => {
      const specific = await repos.dtc.lookup('p0100', 'toyota');
      expect(specific.kind).toBe('specific');
      expect(specific.code).toBe('P0100');
      expect(specific.record?.descriptionEn).toContain('Toyota-specific');

      const generic = await repos.dtc.lookup('P0100', 'hyundai');
      expect(generic.kind).toBe('generic');
      expect(generic.record?.id).toBe('dtc-1');

      const genericWithoutMake = await repos.dtc.lookup('P0100');
      expect(genericWithoutMake.kind).toBe('generic');

      const unknown = await repos.dtc.lookup('P9999', 'toyota');
      expect(unknown).toMatchObject({
        kind: 'unknown',
        code: 'P9999',
        category: 'powertrain',
        record: null,
      });

      const unknownBody = await repos.dtc.lookup('B1234');
      expect(unknownBody.category).toBe('body');
    });

    it('counts generic rows and reviews them tier 1 first', async () => {
      expect(await repos.dtc.counts()).toEqual({
        total: 2,
        tier1: 1,
        tier2: 1,
        needsReview: 2,
      });

      const pending = await repos.dtc.needsReview();
      expect(pending).toHaveLength(3);
      expect(pending.map((row) => row.translationTier)).toEqual([1, 1, 2]);

      const row = pending.find((entry) => entry.id === 'dtc-2');
      if (!row) throw new Error('Missing tier-1 row');
      const applied = await repos.dtc.applyReview(row.id, {
        descriptionAr: 'نص مُراجع.',
        possibleCausesAr: ['سبب مُراجع'],
        inspectionStepsAr: ['خطوة مُراجع'],
        reviewedBy: 'mechanic',
        reviewedAt: NOW,
      });

      expect(applied).toBe(true);
      const reviewed = await repos.dtc.get('P0101');
      expect(reviewed?.needsReview).toBe(false);
      expect(reviewed?.reviewedBy).toBe('mechanic');
      expect(reviewed?.descriptionAr).toBe('نص مُراجع.');
      expect((await repos.dtc.counts()).needsReview).toBe(1);

      expect(
        await repos.dtc.applyReview('missing-id', {
          descriptionAr: 'x',
          possibleCausesAr: [],
          inspectionStepsAr: [],
          reviewedBy: 'mechanic',
        }),
      ).toBe(false);
    });

    it('persists settings with upsert and soft delete', async () => {
      expect(await repos.settings.get('vehicle.selected.id')).toBeNull();
      await repos.settings.set('vehicle.selected.id', 'vehicle-1');
      await repos.settings.set('vehicle.selected.id', 'vehicle-2');
      expect(await repos.settings.get('vehicle.selected.id')).toBe('vehicle-2');

      await repos.settings.delete('vehicle.selected.id');
      expect(await repos.settings.get('vehicle.selected.id')).toBeNull();
    });

    it('stores sessions, results, readiness snapshots and live data', async () => {
      const session = await repos.scans.createSession({
        vehicleId: 'repo-1',
        startedAt: NOW,
        protocol: 'ISO 15765-4 CAN',
        mode: 'normal',
      });
      expect(session.id).toBeDefined();

      await repos.scans.addResults(session.id, [
        { code: 'P0100', type: 'stored' },
        { code: 'P0101', type: 'pending', freezeFrame: { frame: 0, dtc: null, readings: [] } },
      ]);
      const results = await repos.scans.resultsFor(session.id);
      expect(results.map((row) => row.code).sort()).toEqual(['P0100', 'P0101']);
      expect(results.find((row) => row.code === 'P0101')?.freezeFrame).toEqual({
        frame: 0,
        dtc: null,
        readings: [],
      });

      await repos.scans.addReadiness(session.id, 'before_clear', { mil: true });
      const readiness = await repos.scans.readinessFor(session.id);
      expect(readiness).toHaveLength(1);
      expect(readiness[0]?.phase).toBe('before_clear');

      await repos.scans.addLiveData(session.id, [
        { pid: '010C', value: 800, unit: 'rpm', ts: NOW },
        { pid: '010D', value: null, unit: 'km/h', ts: NOW },
      ]);
      const live = await repos.scans.liveDataFor(session.id);
      expect(live.map((row) => row.pid)).toEqual(['010C', '010D']);
      expect(live[1]?.value).toBeNull();

      const updated = await repos.scans.updateSession(session.id, { finishedAt: NOW });
      expect(updated?.finishedAt).toBe(NOW);
      expect((await repos.scans.listSessions('repo-1')).map((row) => row.id)).toEqual([session.id]);
      expect(await repos.scans.listSessions('other')).toEqual([]);
    });

    it('stores backups, verifies them on save and never prunes', async () => {
      const backup = (id: string): ScanBackup => ({
        id,
        createdAt: id,
        adapter: {
          identity: 'ELM327 v1.5',
          description: null,
          version: '1.5',
          protocol: '6',
          ecuPresent: true,
          likelyClone: false,
          limitedCommands: false,
          adapterTimeoutMs: 200,
        },
        stored: [],
        pending: [],
        permanent: [],
        freezeFrames: [],
        readiness: null,
        result: {} as ScanBackup['result'],
      });

      await repos.scanBackups.save(backup('backup-1'));
      await repos.scanBackups.save(backup('backup-2'));

      expect((await repos.scanBackups.list()).map((row) => row.id)).toEqual([
        'backup-2',
        'backup-1',
      ]);
      expect((await repos.scanBackups.get('backup-1'))?.id).toBe('backup-1');

      await repos.scanBackups.delete('backup-1');
      expect(await repos.scanBackups.get('backup-1')).toBeNull();
      expect((await repos.scanBackups.list()).map((row) => row.id)).toEqual(['backup-2']);
    });
  });
}
