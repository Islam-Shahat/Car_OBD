import catalogData from '../../data/vehicle-catalog.json';
import dtcData from '../../data/dtc-codes.json';
import { nowIso, stringifyJsonArray, type SqlExecutor, type SqlValue } from './sql';

export interface DtcSeedCode {
  code: string;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: string | null;
  causesEn: string[];
  causesAr: string[];
  stepsEn: string[];
  stepsAr: string[];
  tier: 1 | 2 | 3;
  needsReview: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface DtcSeedFile {
  source: string;
  sourceVersion: string;
  generatedAt: string;
  license?: string;
  codes: DtcSeedCode[];
}

export interface CatalogSeedEntry {
  /** Stable id from the catalog build; keeps vehicles.catalog_id valid. */
  id?: string;
  make: string;
  makeSlug: string;
  model: string;
  aliasesAr: string[];
  aliasesEn: string[];
  yearFrom: number | null;
  yearTo: number | null;
  bodyType: string | null;
  sourceTier: 'cited' | 'knowledge';
  verified: boolean;
}

export interface CatalogSeedFile {
  version: string;
  downloadedAt?: string;
  entries: CatalogSeedEntry[];
}

export const DTC_SEED_KEY = 'seed.dtc.version';
export const CATALOG_SEED_KEY = 'seed.vehicle_catalog.version';

const DEFAULT_DTC_SEED = dtcData as unknown as DtcSeedFile;
const DEFAULT_CATALOG_SEED = catalogData as unknown as CatalogSeedFile;

const DTC_COLUMNS = 19;
const CATALOG_COLUMNS = 14;
const ROWS_PER_INSERT = 40;

function placeholders(rows: number, columns: number, offset = 0): string {
  const values: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowValues: string[] = [];
    for (let column = 0; column < columns; column += 1) {
      rowValues.push(`$${offset + row * columns + column + 1}`);
    }
    values.push(`(${rowValues.join(', ')})`);
  }
  return values.join(', ');
}

async function settingValue(db: SqlExecutor, key: string): Promise<string | null> {
  const [row] = await db.select<{ value: string }>(
    'SELECT value FROM settings WHERE key = $1 AND deleted_at IS NULL',
    [key],
  );
  return row?.value ?? null;
}

async function writeSetting(
  db: SqlExecutor,
  key: string,
  value: string,
  at: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO settings (id, key, value, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $4, NULL)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       deleted_at = NULL`,
    [`seed-setting-${key}`, key, value, at],
  );
}

async function genericCodeCount(db: SqlExecutor): Promise<number> {
  const [row] = await db.select<{ count: number }>(
    'SELECT COUNT(*) AS count FROM dtc_codes WHERE make IS NULL AND deleted_at IS NULL',
  );
  return Number(row?.count ?? 0);
}

async function catalogCount(db: SqlExecutor): Promise<number> {
  const [row] = await db.select<{ count: number }>(
    'SELECT COUNT(*) AS count FROM vehicle_catalog WHERE deleted_at IS NULL',
  );
  return Number(row?.count ?? 0);
}

async function insertDtcSeed(
  db: SqlExecutor,
  seed: DtcSeedFile,
  at: string,
  idFactory: () => string,
): Promise<void> {
  for (let start = 0; start < seed.codes.length; start += ROWS_PER_INSERT) {
    const chunk = seed.codes.slice(start, start + ROWS_PER_INSERT);
    const params: SqlValue[] = [];
    for (const code of chunk) {
      params.push(
        idFactory(),
        code.code,
        null,
        code.descriptionAr,
        code.descriptionEn,
        code.severity,
        stringifyJsonArray(code.causesAr),
        stringifyJsonArray(code.causesEn),
        stringifyJsonArray(code.stepsAr),
        stringifyJsonArray(code.stepsEn),
        seed.source,
        seed.sourceVersion,
        code.tier,
        code.needsReview ? 1 : 0,
        code.reviewedBy ?? null,
        code.reviewedAt ?? null,
        at,
        at,
        null,
      );
    }

    await db.execute(
      `INSERT INTO dtc_codes (
        id, code, make, description_ar, description_en, severity,
        possible_causes_ar, possible_causes_en, inspection_steps_ar, inspection_steps_en,
        source, source_version, translation_tier, needs_review, reviewed_by, reviewed_at,
        created_at, updated_at, deleted_at
      ) VALUES ${placeholders(chunk.length, DTC_COLUMNS)}
      ON CONFLICT DO UPDATE SET
        description_ar = excluded.description_ar,
        description_en = excluded.description_en,
        severity = excluded.severity,
        possible_causes_ar = excluded.possible_causes_ar,
        possible_causes_en = excluded.possible_causes_en,
        inspection_steps_ar = excluded.inspection_steps_ar,
        inspection_steps_en = excluded.inspection_steps_en,
        source = excluded.source,
        source_version = excluded.source_version,
        translation_tier = excluded.translation_tier,
        needs_review = excluded.needs_review,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at,
        deleted_at = NULL`,
      params,
    );
  }

  const actual = await genericCodeCount(db);
  if (actual < seed.codes.length) {
    throw new Error(
      `DTC seed incomplete: expected at least ${seed.codes.length} generic rows, found ${actual}`,
    );
  }
}

async function insertCatalogSeed(
  db: SqlExecutor,
  seed: CatalogSeedFile,
  at: string,
  idFactory: () => string,
): Promise<void> {
  for (let start = 0; start < seed.entries.length; start += ROWS_PER_INSERT) {
    const chunk = seed.entries.slice(start, start + ROWS_PER_INSERT);
    const params: SqlValue[] = [];
    for (const entry of chunk) {
      params.push(
        entry.id ?? idFactory(),
        entry.make,
        entry.makeSlug,
        entry.model,
        stringifyJsonArray(entry.aliasesAr),
        stringifyJsonArray(entry.aliasesEn),
        entry.yearFrom,
        entry.yearTo,
        entry.bodyType,
        entry.sourceTier,
        entry.verified ? 1 : 0,
        at,
        at,
        null,
      );
    }

    await db.execute(
      `INSERT INTO vehicle_catalog (
        id, make, make_slug, model, aliases_ar, aliases_en, year_from, year_to,
        body_type, source_tier, verified, created_at, updated_at, deleted_at
      ) VALUES ${placeholders(chunk.length, CATALOG_COLUMNS)}
      ON CONFLICT DO UPDATE SET
        make = excluded.make,
        make_slug = excluded.make_slug,
        model = excluded.model,
        aliases_ar = excluded.aliases_ar,
        aliases_en = excluded.aliases_en,
        year_from = excluded.year_from,
        year_to = excluded.year_to,
        body_type = excluded.body_type,
        source_tier = excluded.source_tier,
        verified = excluded.verified,
        updated_at = excluded.updated_at,
        deleted_at = NULL`,
      params,
    );
  }

  const actual = await catalogCount(db);
  if (actual < seed.entries.length) {
    throw new Error(
      `Vehicle catalog seed incomplete: expected at least ${seed.entries.length} rows, found ${actual}`,
    );
  }
}

export interface SeedOptions {
  dtc?: DtcSeedFile;
  catalog?: CatalogSeedFile;
  now?: () => string;
  idFactory?: () => string;
}

export interface SeedResult {
  dtcInserted: boolean;
  catalogInserted: boolean;
  dtcCount: number;
  catalogCount: number;
}

/**
 * Seeds the reference tables. Existing rows are never overwritten: a reviewed
 * DTC or a verified catalog row survives every reseed. The seed version is
 * recorded only after the row count proves the insert landed.
 */
export async function seedDatabase(
  db: SqlExecutor,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const dtc = options.dtc ?? DEFAULT_DTC_SEED;
  const catalog = options.catalog ?? DEFAULT_CATALOG_SEED;
  const at = (options.now ?? nowIso)();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  let dtcInserted = false;
  const dtcVersion = await settingValue(db, DTC_SEED_KEY);
  if (dtcVersion !== dtc.sourceVersion || (await genericCodeCount(db)) < dtc.codes.length) {
    await insertDtcSeed(db, dtc, at, idFactory);
    await writeSetting(db, DTC_SEED_KEY, dtc.sourceVersion, at);
    dtcInserted = true;
  }

  let catalogInserted = false;
  const catalogVersion = await settingValue(db, CATALOG_SEED_KEY);
  if (catalogVersion !== catalog.version || (await catalogCount(db)) < catalog.entries.length) {
    await insertCatalogSeed(db, catalog, at, idFactory);
    await writeSetting(db, CATALOG_SEED_KEY, catalog.version, at);
    catalogInserted = true;
  }

  return {
    dtcInserted,
    catalogInserted,
    dtcCount: await genericCodeCount(db),
    catalogCount: await catalogCount(db),
  };
}
