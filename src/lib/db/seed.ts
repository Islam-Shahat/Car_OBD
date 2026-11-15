import catalogData from '../../data/vehicle-catalog.json';
import { searchKey } from '../i18n/arabic';
import packManifest from '../../data/dtc-pack.manifest.json';
import { loadDtcPack, type DtcPackLoader, type DtcSeedFile } from './dtcPack';
import { nowIso, stringifyJsonArray, type SqlExecutor, type SqlValue } from './sql';

export type { DtcPackLoader, DtcSeedCode, DtcSeedFile } from './dtcPack';

export interface CatalogSeedEntry {
  /** Stable id from the catalog build; keeps vehicles.catalog_id valid. */
  id?: string;
  make: string;
  makeSlug: string;
  model: string;
  makeAliasesAr: string[];
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

/** Written only after the pack landed in full; it is the idempotency marker. */
export const DTC_PACK_VERSION_KEY = 'dtc_pack_version';
export const CATALOG_SEED_KEY = 'seed.vehicle_catalog.version';

const DEFAULT_CATALOG_SEED = catalogData as unknown as CatalogSeedFile;

const DTC_COLUMNS = 20;
const CATALOG_COLUMNS = 16;
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

/** A migrated catalog without a search key would be invisible to search. */
async function catalogMissingSearchKey(db: SqlExecutor): Promise<boolean> {
  const [row] = await db.select<{ count: number }>(
    "SELECT COUNT(*) AS count FROM vehicle_catalog WHERE deleted_at IS NULL AND search_text = ''",
  );
  return Number(row?.count ?? 0) > 0;
}

/**
 * One statement per chunk, inside the caller's transaction. Keeping 40 rows per
 * statement keeps the bind count under SQLite's legacy 999-variable limit.
 */
async function insertDtcPack(
  db: SqlExecutor,
  pack: DtcSeedFile,
  at: string,
  idFactory: () => string,
): Promise<void> {
  for (let start = 0; start < pack.codes.length; start += ROWS_PER_INSERT) {
    const chunk = pack.codes.slice(start, start + ROWS_PER_INSERT);
    const params: SqlValue[] = [];
    for (const code of chunk) {
      params.push(
        idFactory(),
        code.code,
        null,
        code.descriptionAr,
        code.descriptionEn,
        code.severity,
        code.severitySource,
        stringifyJsonArray(code.causesAr),
        stringifyJsonArray(code.causesEn),
        stringifyJsonArray(code.stepsAr),
        stringifyJsonArray(code.stepsEn),
        pack.source,
        pack.sourceVersion,
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
        id, code, make, description_ar, description_en, severity, severity_source,
        possible_causes_ar, possible_causes_en, inspection_steps_ar, inspection_steps_en,
        source, source_version, translation_tier, needs_review, reviewed_by, reviewed_at,
        created_at, updated_at, deleted_at
      ) VALUES ${placeholders(chunk.length, DTC_COLUMNS)}
      ON CONFLICT DO UPDATE SET
        description_ar = excluded.description_ar,
        description_en = excluded.description_en,
        severity = excluded.severity,
        severity_source = excluded.severity_source,
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
  if (actual < pack.codes.length) {
    throw new Error(
      `DTC seed incomplete: expected at least ${pack.codes.length} generic rows, found ${actual}`,
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
        stringifyJsonArray(entry.makeAliasesAr),
        stringifyJsonArray(entry.aliasesAr),
        stringifyJsonArray(entry.aliasesEn),
        entry.yearFrom,
        entry.yearTo,
        entry.bodyType,
        entry.sourceTier,
        entry.verified ? 1 : 0,
        searchKey(
          entry.make,
          entry.model,
          ...entry.makeAliasesAr,
          ...entry.aliasesAr,
          ...entry.aliasesEn,
        ),
        at,
        at,
        null,
      );
    }

    await db.execute(
      `INSERT INTO vehicle_catalog (
        id, make, make_slug, model, make_aliases_ar, aliases_ar, aliases_en, year_from,
        year_to, body_type, source_tier, verified, search_text, created_at, updated_at,
        deleted_at
      ) VALUES ${placeholders(chunk.length, CATALOG_COLUMNS)}
      ON CONFLICT DO UPDATE SET
        make = excluded.make,
        make_slug = excluded.make_slug,
        model = excluded.model,
        make_aliases_ar = excluded.make_aliases_ar,
        aliases_ar = excluded.aliases_ar,
        aliases_en = excluded.aliases_en,
        year_from = excluded.year_from,
        year_to = excluded.year_to,
        body_type = excluded.body_type,
        source_tier = excluded.source_tier,
        verified = excluded.verified,
        search_text = excluded.search_text,
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
  /** In-memory pack, used by tests and the import tooling. */
  dtcPack?: DtcSeedFile;
  /** Lazy loader; defaults to fetching the shipped static asset. */
  loadDtcPack?: DtcPackLoader;
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
 * Seeds the reference tables. The DTC pack is fetched only when its content
 * version is missing or the row count is short, and it is inserted in one
 * transaction. The version marker is written after the commit, so an
 * interrupted or failed seed is retried on the next start instead of leaving a
 * half-seeded database marked as done. The catalog upsert never touches
 * user-owned `vehicles` rows.
 */
export async function seedDatabase(
  db: SqlExecutor,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const catalog = options.catalog ?? DEFAULT_CATALOG_SEED;
  const at = (options.now ?? nowIso)();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  let dtcInserted = false;
  const packVersion = options.dtcPack?.version ?? packManifest.version;
  // The manifest count is a hint for the shipped pack only. A caller that
  // supplies its own loader or pack owns that check after the insert.
  const expectedCodes =
    options.dtcPack?.codes.length ?? (options.loadDtcPack ? null : packManifest.codeCount);
  const recordedVersion = await settingValue(db, DTC_PACK_VERSION_KEY);
  const short = expectedCodes !== null && (await genericCodeCount(db)) < expectedCodes;
  if (recordedVersion !== packVersion || short) {
    const pack = options.dtcPack ?? (await (options.loadDtcPack ?? loadDtcPack)());
    if (pack.version !== packVersion) {
      throw new Error(`The DTC pack changed while starting (${pack.version} != ${packVersion})`);
    }
    await db.transaction(async () => {
      await insertDtcPack(db, pack, at, idFactory);
    });
    await writeSetting(db, DTC_PACK_VERSION_KEY, pack.version, at);
    dtcInserted = true;
  }

  let catalogInserted = false;
  const catalogVersion = await settingValue(db, CATALOG_SEED_KEY);
  if (
    catalogVersion !== catalog.version ||
    (await catalogCount(db)) < catalog.entries.length ||
    (await catalogMissingSearchKey(db))
  ) {
    await db.transaction(async () => {
      await insertCatalogSeed(db, catalog, at, idFactory);
    });
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
