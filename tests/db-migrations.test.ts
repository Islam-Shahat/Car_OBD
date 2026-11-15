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
});
