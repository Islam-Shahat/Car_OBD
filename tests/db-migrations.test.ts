import { afterEach, describe, expect, it } from 'vitest';

import { MIGRATIONS, migrate } from '../src/lib/db/migrations';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

let db: TestDatabase | null = null;

function newDatabase(): TestDatabase {
  db = createTestDatabase();
  return db;
}

afterEach(() => {
  db?.close();
  db = null;
});

async function tableNames(database: TestDatabase): Promise<string[]> {
  const rows = await database.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function indexNames(database: TestDatabase): Promise<string[]> {
  const rows = await database.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function columnNames(database: TestDatabase, table: string): Promise<string[]> {
  const rows = await database.select<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
}

/** Applies migrations 1..version the way an older release left the file. */
async function applyThrough(database: TestDatabase, version: number): Promise<void> {
  await database.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );
  for (const migration of MIGRATIONS.filter((entry) => entry.version <= version)) {
    for (const addition of migration.addColumns ?? []) {
      const columns = await database.select<{ name: string }>(
        `PRAGMA table_info(${addition.table})`,
      );
      if (!columns.some((col) => col.name === addition.column)) {
        await database.execute(
          `ALTER TABLE ${addition.table} ADD COLUMN ${addition.column} ${addition.definition}`,
        );
      }
    }
    for (const statement of migration.statements) await database.execute(statement);
    await database.execute(
      'INSERT INTO schema_migrations (version, description, applied_at) VALUES ($1, $2, $3)',
      [migration.version, migration.description, '2026-01-01T00:00:00.000Z'],
    );
  }
}

const CORE_TABLES = [
  'dtc_codes',
  'live_data_logs',
  'readiness_snapshots',
  'remote_config_cache',
  'scan_backups',
  'scan_results',
  'scan_sessions',
  'schema_migrations',
  'settings',
  'vehicle_catalog',
  'vehicles',
  'wmi_user_map',
];

describe('database migrations', () => {
  it('creates the full schema and indexes on a fresh database', async () => {
    const database = newDatabase();
    await migrate(database);

    expect(await tableNames(database)).toEqual(CORE_TABLES);

    const indexes = await indexNames(database);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'dtc_codes_code_idx',
        'dtc_codes_code_make_uq',
        'scan_sessions_vehicle_idx',
        'live_data_logs_session_ts_idx',
        'vehicle_catalog_make_model_uq',
        'vehicles_vin_idx',
      ]),
    );

    const ledger = await database.select<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    expect(ledger.map((row) => Number(row.version))).toEqual(
      MIGRATIONS.map((migration) => migration.version),
    );
    expect(await columnNames(database, 'vehicle_catalog')).toEqual(
      expect.arrayContaining(['make_aliases_ar', 'search_text']),
    );
    expect(await columnNames(database, 'dtc_codes')).toContain('severity_source');
  });

  it('is idempotent: a second start changes nothing', async () => {
    const database = newDatabase();
    await migrate(database);
    await migrate(database);

    const ledger = await database.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM schema_migrations',
    );
    expect(Number(ledger[0]?.count)).toBe(MIGRATIONS.length);
  });

  it('upgrades an existing version-1 database without losing rows', async () => {
    const database = newDatabase();
    const first = MIGRATIONS[0];
    if (!first) throw new Error('Missing migration 1');

    await database.execute(
      `CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,
    );
    for (const statement of first.statements) await database.execute(statement);
    await database.execute(
      'INSERT INTO schema_migrations (version, description, applied_at) VALUES ($1, $2, $3)',
      [first.version, first.description, '2026-01-01T00:00:00.000Z'],
    );
    await database.execute(
      `INSERT INTO settings (id, key, value, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, NULL)`,
      ['existing-setting', 'kept', 'yes', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
    );

    expect(await tableNames(database)).not.toContain('scan_sessions');

    await migrate(database);

    expect(await tableNames(database)).toContain('scan_sessions');
    const kept = await database.select<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1',
      ['kept'],
    );
    expect(kept[0]?.value).toBe('yes');

    const ledger = await database.select<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    expect(ledger.map((row) => Number(row.version))).toEqual(
      MIGRATIONS.map((migration) => migration.version),
    );
  });

  it('upgrades a version-3 database with user data to the current schema', async () => {
    const database = newDatabase();
    await applyThrough(database, 3);

    // Rows a real install would already hold: one vehicle, one catalog row,
    // one generic DTC and one setting.
    await database.execute(
      `INSERT INTO vehicles (id, catalog_id, make, model, year, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      ['vehicle-1', 'catalog-1', 'Toyota', 'Corolla', 2019, '2026-01-01T00:00:00.000Z'],
    );
    await database.execute(
      `INSERT INTO vehicle_catalog
        (id, make, make_slug, model, aliases_ar, aliases_en, source_tier, verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [
        'catalog-1',
        'Toyota',
        'toyota',
        'Corolla',
        '["كورولا"]',
        '[]',
        'knowledge',
        0,
        '2026-01-01T00:00:00.000Z',
      ],
    );
    await database.execute(
      `INSERT INTO dtc_codes
        (id, code, make, description_ar, description_en, source, source_version,
         translation_tier, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $8)`,
      ['dtc-1', 'P0100', 'وصف', 'Description', 'OBDex', 'test', 1, '2026-01-01T00:00:00.000Z'],
    );
    await database.execute(
      `INSERT INTO settings (id, key, value, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)`,
      ['setting-1', 'seed.vehicle_catalog.version', 'old', '2026-01-01T00:00:00.000Z'],
    );

    await migrate(database);

    expect(await columnNames(database, 'vehicle_catalog')).toEqual(
      expect.arrayContaining(['make_aliases_ar', 'search_text']),
    );
    expect(await columnNames(database, 'dtc_codes')).toContain('severity_source');

    const [catalog] = await database.select<{
      make_aliases_ar: string;
      search_text: string;
      model: string;
    }>('SELECT make_aliases_ar, search_text, model FROM vehicle_catalog WHERE id = $1', [
      'catalog-1',
    ]);
    expect(catalog).toEqual({ make_aliases_ar: '[]', search_text: '', model: 'Corolla' });

    const [dtc] = await database.select<{ severity_source: string; code: string }>(
      'SELECT severity_source, code FROM dtc_codes WHERE id = $1',
      ['dtc-1'],
    );
    expect(dtc).toEqual({ severity_source: 'heuristic', code: 'P0100' });

    const [vehicle] = await database.select<{ make: string; year: number }>(
      'SELECT make, year FROM vehicles WHERE id = $1',
      ['vehicle-1'],
    );
    expect(vehicle).toEqual({ make: 'Toyota', year: 2019 });

    const [setting] = await database.select<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1',
      ['seed.vehicle_catalog.version'],
    );
    expect(setting?.value).toBe('old');

    // Re-running after the upgrade must not try to add the columns twice.
    await migrate(database);
    expect(await columnNames(database, 'vehicle_catalog')).toEqual(
      expect.arrayContaining(['make_aliases_ar', 'search_text']),
    );
  });

  it('produces an identical schema on a fresh database vs a database upgraded from version 7, and marks existing sessions as unknown', async () => {
    const freshDb = createTestDatabase();
    const upgradedDb = createTestDatabase();
    try {
      await migrate(freshDb);

      await applyThrough(upgradedDb, 7);
      // Insert a legacy session before Migration 8 existed (origin was not recorded)
      await upgradedDb.execute(
        `INSERT INTO scan_sessions (id, started_at, mode, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        ['legacy-session-1', '2026-11-10T10:00:00.000Z', 'normal', '2026-11-10T10:00:00.000Z'],
      );

      await migrate(upgradedDb);

      expect(await tableNames(upgradedDb)).toEqual(await tableNames(freshDb));
      expect(await indexNames(upgradedDb)).toEqual(await indexNames(freshDb));

      for (const table of CORE_TABLES) {
        const freshInfo = await freshDb.select<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }>(`PRAGMA table_info(${table})`);
        const upgradedInfo = await upgradedDb.select<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }>(`PRAGMA table_info(${table})`);
        expect(upgradedInfo).toEqual(freshInfo);
      }

      const [legacyRow] = await upgradedDb.select<{ session_type: string }>(
        'SELECT session_type FROM scan_sessions WHERE id = $1',
        ['legacy-session-1'],
      );
      expect(legacyRow?.session_type).toBe('unknown');
    } finally {
      freshDb.close();
      upgradedDb.close();
    }
  });
});
