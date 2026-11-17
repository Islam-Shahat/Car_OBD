import type { SqlExecutor } from './sql';

export interface Migration {
  version: number;
  description: string;
  statements: readonly string[];
  /**
   * Columns added to tables created by an earlier migration. SQLite has no
   * `ADD COLUMN IF NOT EXISTS`, so the runner checks `PRAGMA table_info` first
   * and the statement stays safe to retry after an interrupted migration.
   */
  addColumns?: readonly ColumnAddition[];
}

export interface ColumnAddition {
  table: string;
  column: string;
  /** Everything after the column name, e.g. `TEXT NOT NULL DEFAULT ''`. */
  definition: string;
}

/**
 * Versioned, idempotent migrations. Every statement can be re-run safely, so an
 * interrupted migration is retried on the next start instead of leaving a
 * half-created schema.
 *
 * SQLite stores `NULL` makes for generic codes; the unique expression index on
 * `(code, COALESCE(make, ''))` is what actually enforces one generic row per
 * code, because a plain UNIQUE(code, make) would allow unlimited NULL makes.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'core vehicles, catalog, DTCs, settings and remote config',
    statements: [
      `CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        catalog_id TEXT,
        make TEXT,
        model TEXT,
        year INTEGER,
        engine TEXT,
        vin TEXT,
        notes TEXT,
        make_text TEXT,
        model_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS vehicles_vin_idx ON vehicles(vin)`,
      `CREATE INDEX IF NOT EXISTS vehicles_catalog_idx ON vehicles(catalog_id)`,
      `CREATE INDEX IF NOT EXISTS vehicles_updated_idx ON vehicles(updated_at)`,
      `CREATE TABLE IF NOT EXISTS vehicle_catalog (
        id TEXT PRIMARY KEY,
        make TEXT NOT NULL,
        make_slug TEXT NOT NULL,
        model TEXT NOT NULL,
        aliases_ar TEXT NOT NULL DEFAULT '[]',
        aliases_en TEXT NOT NULL DEFAULT '[]',
        year_from INTEGER,
        year_to INTEGER,
        body_type TEXT,
        source_tier TEXT NOT NULL CHECK (source_tier IN ('cited', 'knowledge')),
        verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS vehicle_catalog_make_model_uq
        ON vehicle_catalog(make_slug, model)`,
      `CREATE INDEX IF NOT EXISTS vehicle_catalog_make_idx ON vehicle_catalog(make_slug)`,
      `CREATE TABLE IF NOT EXISTS dtc_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        make TEXT,
        description_ar TEXT NOT NULL,
        description_en TEXT NOT NULL,
        severity TEXT,
        possible_causes_ar TEXT NOT NULL DEFAULT '[]',
        possible_causes_en TEXT NOT NULL DEFAULT '[]',
        inspection_steps_ar TEXT NOT NULL DEFAULT '[]',
        inspection_steps_en TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL,
        source_version TEXT NOT NULL,
        translation_tier INTEGER NOT NULL CHECK (translation_tier IN (1, 2, 3)),
        needs_review INTEGER NOT NULL DEFAULT 1 CHECK (needs_review IN (0, 1)),
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS dtc_codes_code_idx ON dtc_codes(code)`,
      `CREATE INDEX IF NOT EXISTS dtc_codes_code_make_idx ON dtc_codes(code, make)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS dtc_codes_code_make_uq
        ON dtc_codes(code, COALESCE(make, ''))`,
      `CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS remote_config_cache (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        signature TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS remote_config_cache_fetched_idx
        ON remote_config_cache(fetched_at)`,
    ],
  },
  {
    version: 2,
    description: 'scan sessions, results, readiness, live data and backups',
    statements: [
      `CREATE TABLE IF NOT EXISTS scan_sessions (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        protocol TEXT,
        adapter_info TEXT,
        mil_status TEXT,
        overall_status TEXT,
        mode TEXT NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'pre_purchase')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS scan_sessions_vehicle_idx ON scan_sessions(vehicle_id)`,
      `CREATE INDEX IF NOT EXISTS scan_sessions_started_idx ON scan_sessions(started_at)`,
      `CREATE TABLE IF NOT EXISTS scan_results (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('stored', 'pending', 'permanent')),
        freeze_frame_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS scan_results_session_idx ON scan_results(session_id)`,
      `CREATE INDEX IF NOT EXISTS scan_results_code_idx ON scan_results(code)`,
      `CREATE TABLE IF NOT EXISTS readiness_snapshots (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phase TEXT NOT NULL CHECK (phase IN ('before_clear', 'after_clear', 'initial')),
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS readiness_snapshots_session_idx
        ON readiness_snapshots(session_id)`,
      `CREATE TABLE IF NOT EXISTS live_data_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        pid TEXT NOT NULL,
        value REAL,
        unit TEXT,
        ts TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS live_data_logs_session_ts_idx
        ON live_data_logs(session_id, ts)`,
      `CREATE TABLE IF NOT EXISTS scan_backups (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS scan_backups_created_idx ON scan_backups(created_at)`,
    ],
  },
  {
    version: 3,
    description: 'catalog search index',
    statements: [
      `CREATE INDEX IF NOT EXISTS vehicle_catalog_model_idx ON vehicle_catalog(model)`,
      `CREATE INDEX IF NOT EXISTS vehicle_catalog_make_model_idx
        ON vehicle_catalog(make_slug, model)`,
    ],
  },
  {
    version: 4,
    description: 'Arabic-normalized catalog search and make aliases',
    statements: [],
    addColumns: [
      {
        table: 'vehicle_catalog',
        column: 'make_aliases_ar',
        definition: `TEXT NOT NULL DEFAULT '[]'`,
      },
      { table: 'vehicle_catalog', column: 'search_text', definition: `TEXT NOT NULL DEFAULT ''` },
    ],
  },
  {
    version: 5,
    description: 'record where the DTC severity estimate came from',
    statements: [],
    addColumns: [
      {
        table: 'dtc_codes',
        column: 'severity_source',
        definition: `TEXT NOT NULL DEFAULT 'heuristic'`,
      },
    ],
  },
  {
    version: 6,
    description: 'user-mapped WMI to make associations',
    statements: [
      `CREATE TABLE IF NOT EXISTS wmi_user_map (
        wmi TEXT PRIMARY KEY,
        make_slug TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS wmi_user_map_make_idx ON wmi_user_map(make_slug)`,
    ],
  },
  {
    version: 7,
    description: 'allow multiple makes per WMI with last_used_at',
    statements: [
      `CREATE TABLE IF NOT EXISTS wmi_user_map_v2 (
        wmi TEXT NOT NULL,
        make_slug TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        PRIMARY KEY (wmi, make_slug)
      )`,
      `INSERT OR REPLACE INTO wmi_user_map_v2 (wmi, make_slug, source, created_at, last_used_at)
       SELECT wmi, make_slug, source, created_at, created_at FROM wmi_user_map`,
      `DROP TABLE wmi_user_map`,
      `ALTER TABLE wmi_user_map_v2 RENAME TO wmi_user_map`,
      `CREATE INDEX IF NOT EXISTS wmi_user_map_lookup_idx ON wmi_user_map(wmi, last_used_at DESC)`,
      `CREATE INDEX IF NOT EXISTS wmi_user_map_make_idx ON wmi_user_map(make_slug)`,
    ],
  },
  {
    version: 8,
    description: 'track session_type (real, emulator, demo, unknown) on scan_sessions',
    statements: [],
    addColumns: [
      {
        table: 'scan_sessions',
        column: 'session_type',
        definition: `TEXT NOT NULL DEFAULT 'unknown' CHECK (session_type IN ('real', 'emulator', 'demo', 'unknown'))`,
      },
    ],
  },
];

/** Creates the migration ledger and applies every migration not yet recorded. */
export async function migrate(
  db: SqlExecutor,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const appliedRows = await db.select<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  const applied = new Set(appliedRows.map((row) => Number(row.version)));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    for (const addition of migration.addColumns ?? []) {
      if (!/^[a-z_]+$/.test(addition.table) || !/^[a-z_]+$/.test(addition.column)) {
        throw new Error(`Unsafe column addition: ${addition.table}.${addition.column}`);
      }
      // A table from an older schema must exist before a column can be added.
      const columns = await db.select<{ name: string }>(`PRAGMA table_info(${addition.table})`);
      if (!columns.some((column) => column.name === addition.column)) {
        await db.execute(
          `ALTER TABLE ${addition.table} ADD COLUMN ${addition.column} ${addition.definition}`,
        );
      }
    }

    for (const statement of migration.statements) {
      await db.execute(statement);
    }

    await db.execute(
      `INSERT INTO schema_migrations (version, description, applied_at)
       VALUES ($1, $2, $3)`,
      [migration.version, migration.description, now()],
    );
  }
}
