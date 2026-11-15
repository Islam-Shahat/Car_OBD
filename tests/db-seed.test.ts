import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import catalogData from '../src/data/vehicle-catalog.json';
import manifest from '../src/data/dtc-pack.manifest.json';
import { migrate } from '../src/lib/db/migrations';
import { seedDatabase, type DtcSeedFile } from '../src/lib/db/seed';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-11-14T10:00:00.000Z';

interface ShippedDtc {
  code: string;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: string | null;
  severitySource: string;
  causesEn: string[];
  causesAr: string[];
  stepsEn: string[];
  stepsAr: string[];
  tier: number;
  needsReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface ShippedDtcFile {
  version: string;
  source: string;
  sourceVersion: string;
  license?: string;
  generatedAt: string;
  codes: ShippedDtc[];
}

// Read instead of importing: the 4.5 MB pack is not part of the app bundle and
// must not be type-checked as a literal.
const SHIPPED = JSON.parse(
  readFileSync(join(ROOT, 'public', 'dtc-pack.json'), 'utf8'),
) as ShippedDtcFile;
const ARABIC = /[\u0600-\u06FF]/;

function seedFile(version: string, descriptionAr: string): DtcSeedFile {
  return {
    version,
    source: 'OBDex',
    sourceVersion: 'test-source',
    generatedAt: NOW,
    license: 'CC0-1.0',
    codes: [
      {
        code: 'P0100',
        category: 'powertrain',
        descriptionEn: 'Mass or Volume Air Flow Sensor A Circuit',
        descriptionAr,
        severity: 'warning',
        severitySource: 'heuristic',
        causesEn: ['Sensor faulty'],
        causesAr: ['الحساس تالف'],
        stepsEn: ['Check the wiring'],
        stepsAr: ['افحص الأسلاك'],
        tier: 1,
        needsReview: true,
        reviewedBy: null,
        reviewedAt: null,
      },
    ],
  };
}

const CATALOG = {
  version: 'catalog-1',
  entries: [
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
      bodyType: 'sedan' as const,
      sourceTier: 'knowledge' as const,
      verified: false,
    },
  ],
};

let db: TestDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('shipped DTC pack', () => {
  it('contains every generic row with English and Arabic text', () => {
    expect(SHIPPED.source).toBe('OBDex');
    expect(SHIPPED.sourceVersion).toMatch(/^[0-9a-f]{40}$/);
    expect(SHIPPED.license).toBe('CC0-1.0');
    expect(SHIPPED.generatedAt).toBe('2026-11-14');
    expect(SHIPPED.codes).toHaveLength(9533);
    expect(new Set(SHIPPED.codes.map((row) => row.code)).size).toBe(9533);
    expect(SHIPPED.codes.filter((row) => row.tier === 1)).toHaveLength(402);
    expect(SHIPPED.codes.filter((row) => row.tier === 2)).toHaveLength(9131);

    const categories = new Set(['powertrain', 'body', 'chassis', 'network']);
    for (const row of SHIPPED.codes) {
      expect(row.code).toMatch(/^[PCBU][0-9A-F]{4}$/);
      expect(categories.has(row.category)).toBe(true);
      expect(row.descriptionEn.trim().length).toBeGreaterThan(0);
      expect(row.descriptionAr.trim().length).toBeGreaterThan(0);
      expect(ARABIC.test(row.descriptionAr)).toBe(true);
      expect([1, 2]).toContain(row.tier);
    }
  });

  it('matches the manifest so the app knows when to re-seed', () => {
    expect(manifest.version).toBe(SHIPPED.version);
    expect(manifest.version).toMatch(/^[0-9a-f]{16}$/);
    expect(manifest.codeCount).toBe(SHIPPED.codes.length);
    expect(manifest.sourceVersion).toBe(SHIPPED.sourceVersion);
    expect(manifest.license).toBe(SHIPPED.license);
  });

  it('gives Tier 1 causes and steps, keeps Tier 2 description-only, and leaves all unreviewed', () => {
    for (const row of SHIPPED.codes) {
      if (row.tier === 1) {
        expect(row.causesEn.length).toBeGreaterThan(0);
        expect(row.causesAr.length).toBeGreaterThan(0);
        expect(row.stepsEn.length).toBeGreaterThan(0);
        expect(row.stepsAr.length).toBeGreaterThan(0);
      } else {
        expect(row.causesEn).toEqual([]);
        expect(row.causesAr).toEqual([]);
        expect(row.stepsEn).toEqual([]);
        expect(row.stepsAr).toEqual([]);
      }
      expect(row.needsReview).toBe(true);
      expect(row.reviewedBy).toBeNull();
      expect(row.reviewedAt).toBeNull();
    }
  });

  it('stores the severity estimate with its provenance', () => {
    expect(SHIPPED.codes.every((row) => row.severitySource === 'heuristic')).toBe(true);
    expect(new Set(SHIPPED.codes.map((row) => row.severity))).toEqual(
      new Set(['info', 'warning', 'high']),
    );
  });

  it('never states a verdict about safety or a definite repair in Tier 1 text', () => {
    const bannedAr = [
      'آمن للقيادة',
      'غير آمن',
      'لا تقود',
      'توقف عن القيادة',
      'يجب استبدال',
      'يجب إصلاح',
      'يعني أن',
      'السيارة سليمة',
    ];
    const bannedEn = [/^replace\b/i, /must be replaced/i, /safe to drive/i, /do not drive/i];
    for (const row of SHIPPED.codes.filter((entry) => entry.tier === 1)) {
      const arabic = [...row.causesAr, ...row.stepsAr];
      for (const text of arabic) {
        for (const banned of bannedAr) expect(text).not.toContain(banned);
      }
      const english = [...row.causesEn, ...row.stepsEn];
      for (const text of english) {
        for (const banned of bannedEn) expect(text).not.toMatch(banned);
      }
    }
  });
});

describe('shipped vehicle catalog', () => {
  it('is a unique, unverified list reconciled with Appendix C', () => {
    expect(catalogData.version).toBe('2026-11-15.appendix-c');
    expect(catalogData.downloadedAt).toBe('2026-11-15');
    expect(catalogData.entries).toHaveLength(377);
    expect(new Set(catalogData.entries.map((entry) => entry.makeSlug)).size).toBe(46);
    expect(new Set(catalogData.entries.map((entry) => entry.id)).size).toBe(377);
    const cited = catalogData.entries.filter((entry) => entry.sourceTier === 'cited');
    const knowledge = catalogData.entries.filter((entry) => entry.sourceTier === 'knowledge');
    expect(cited).toHaveLength(51);
    expect(knowledge).toHaveLength(326);

    for (const entry of catalogData.entries) {
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(entry.model.trim().length).toBeGreaterThan(0);
      expect(entry.aliasesAr.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.makeAliasesAr)).toBe(true);
      expect(['cited', 'knowledge']).toContain(entry.sourceTier);
      expect(entry.verified).toBe(false);
      expect(entry.yearFrom).toBeNull();
      expect(entry.yearTo).toBeNull();
    }
  });
});

describe('seed runner', () => {
  it('inserts once, reports the counts, and skips the same version', async () => {
    db = createTestDatabase();
    await migrate(db);

    const first = await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v1', 'وصف أول.'),
      catalog: CATALOG,
    });
    expect(first).toMatchObject({
      dtcInserted: true,
      catalogInserted: true,
      dtcCount: 1,
      catalogCount: 1,
    });

    let loads = 0;
    const second = await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v1', 'وصف أول.'),
      loadDtcPack: () => {
        loads += 1;
        return Promise.resolve(seedFile('v1', 'وصف أول.'));
      },
      catalog: CATALOG,
    });
    expect(second).toMatchObject({ dtcInserted: false, catalogInserted: false });
    expect(loads).toBe(0);
  });

  it('loads the pack lazily only when the version is new', async () => {
    db = createTestDatabase();
    await migrate(db);

    let loads = 0;
    const load = (): Promise<DtcSeedFile> => {
      loads += 1;
      // A custom loader must answer the version the bundled manifest promises;
      // the shipped loader validates that and so does the seed runner.
      return Promise.resolve(seedFile(manifest.version, 'وصف أول.'));
    };

    await seedDatabase(db, { now: () => NOW, loadDtcPack: load, catalog: CATALOG });
    expect(loads).toBe(1);

    await seedDatabase(db, { now: () => NOW, loadDtcPack: load, catalog: CATALOG });
    expect(loads).toBe(1);

    const changed = (): Promise<DtcSeedFile> => {
      loads += 1;
      return Promise.resolve(seedFile('v2', 'وصف ثانٍ.'));
    };
    await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v2', 'وصف ثانٍ.'),
      loadDtcPack: changed,
      catalog: CATALOG,
    });
    expect(loads).toBe(1);
  });

  it('rolls the pack back and keeps the old marker when inserting fails', async () => {
    db = createTestDatabase();
    await migrate(db);
    await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v1', 'وصف أول.'),
      catalog: CATALOG,
    });

    const broken: DtcSeedFile = {
      ...seedFile('v2', 'وصف ثانٍ.'),
      codes: [
        {
          ...seedFile('v2', 'وصف ثانٍ.').codes[0]!,
          // A NOT NULL violation inside the chunk: the transaction must undo
          // the whole chunk, not leave half of it behind.
          code: null as unknown as string,
          descriptionAr: 'نص ثانٍ.',
        },
      ],
    };
    await expect(
      seedDatabase(db, {
        now: () => NOW,
        dtcPack: broken,
        catalog: CATALOG,
      }),
    ).rejects.toThrow();

    const rows = await db.select<{ count: number }>('SELECT COUNT(*) AS count FROM dtc_codes');
    expect(Number(rows[0]?.count)).toBe(1);
    const marker = await db.select<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'dtc_pack_version'",
    );
    expect(marker[0]?.value).toBe('v1');
  });

  it('upserts seed-owned rows on a version change but leaves vehicles alone', async () => {
    db = createTestDatabase();
    await migrate(db);

    await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v1', 'وصف أول.'),
      catalog: CATALOG,
    });

    const repositories = createSqliteRepositories(db, { now: () => NOW });
    const vehicle = await repositories.vehicles.create({
      catalogId: 'catalog-corolla',
      make: 'Toyota',
      model: 'Corolla',
      year: 2019,
      notes: 'my car',
    });

    const changedCatalog = {
      ...CATALOG,
      version: 'catalog-2',
      entries: [
        {
          ...(CATALOG.entries[0] as (typeof CATALOG.entries)[number]),
          bodyType: 'hatchback' as const,
        },
      ],
    };
    const result = await seedDatabase(db, {
      now: () => NOW,
      dtcPack: seedFile('v2', 'وصف محدّث.'),
      catalog: changedCatalog,
    });
    expect(result.dtcInserted).toBe(true);
    expect(result.catalogInserted).toBe(true);

    const [dtc] = await db.select<{ description_ar: string; reviewed_by: string | null }>(
      'SELECT description_ar, reviewed_by FROM dtc_codes WHERE code = $1 AND make IS NULL',
      ['P0100'],
    );
    expect(dtc?.description_ar).toBe('وصف محدّث.');

    const [catalog] = await db.select<{ body_type: string; verified: number }>(
      'SELECT body_type, verified FROM vehicle_catalog WHERE id = $1',
      ['catalog-corolla'],
    );
    expect(catalog).toEqual({ body_type: 'hatchback', verified: 0 });

    expect(await repositories.vehicles.get(vehicle.id)).toEqual(vehicle);
  });
});
