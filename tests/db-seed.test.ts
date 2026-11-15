import { afterEach, describe, expect, it } from 'vitest';

import catalogData from '../src/data/vehicle-catalog.json';
import dtcData from '../src/data/dtc-codes.json';
import { migrate } from '../src/lib/db/migrations';
import { seedDatabase, type DtcSeedFile } from '../src/lib/db/seed';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

const NOW = '2026-11-14T10:00:00.000Z';

interface ShippedDtc {
  code: string;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: string | null;
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
  source: string;
  sourceVersion: string;
  license?: string;
  generatedAt: string;
  codes: ShippedDtc[];
}

const SHIPPED = dtcData as unknown as ShippedDtcFile;
const ARABIC = /[\u0600-\u06FF]/;

function seedFile(version: string, descriptionAr: string): DtcSeedFile {
  return {
    source: 'OBDex',
    sourceVersion: version,
    generatedAt: NOW,
    license: 'CC0-1.0',
    codes: [
      {
        code: 'P0100',
        category: 'powertrain',
        descriptionEn: 'Mass or Volume Air Flow Sensor A Circuit',
        descriptionAr,
        severity: 'warning',
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

describe('shipped DTC seed', () => {
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
});

describe('shipped vehicle catalog', () => {
  it('is a unique, unverified 33-make knowledge list with Arabic aliases', () => {
    expect(catalogData.version).toBe('2026-11-14.1');
    expect(catalogData.downloadedAt).toBe('2026-11-14');
    expect(catalogData.entries).toHaveLength(259);
    expect(new Set(catalogData.entries.map((entry) => entry.makeSlug)).size).toBe(33);
    expect(new Set(catalogData.entries.map((entry) => entry.id)).size).toBe(259);

    for (const entry of catalogData.entries) {
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(entry.model.trim().length).toBeGreaterThan(0);
      expect(entry.aliasesAr.length).toBeGreaterThan(0);
      expect(entry.sourceTier).toBe('knowledge');
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
      dtc: seedFile('v1', 'وصف أول.'),
      catalog: CATALOG,
    });
    expect(first).toMatchObject({
      dtcInserted: true,
      catalogInserted: true,
      dtcCount: 1,
      catalogCount: 1,
    });

    const second = await seedDatabase(db, {
      now: () => NOW,
      dtc: seedFile('v1', 'وصف أول.'),
      catalog: CATALOG,
    });
    expect(second).toMatchObject({ dtcInserted: false, catalogInserted: false });
  });

  it('upserts seed-owned rows on a version change but leaves vehicles alone', async () => {
    db = createTestDatabase();
    await migrate(db);

    await seedDatabase(db, { now: () => NOW, dtc: seedFile('v1', 'وصف أول.'), catalog: CATALOG });

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
      dtc: seedFile('v2', 'وصف محدّث.'),
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
