import { migrate } from './migrations';
import type { Repositories } from './repositories';
import { createSqliteRepositories } from './sqliteRepositories';
import { seedDatabase, type SeedOptions, type SeedResult } from './seed';
import {
  browserKeyValueStore,
  migrateLegacyBackups,
  type LegacyMigrationResult,
} from './legacyBackups';
import type { SqlExecutor } from './sql';
import { TauriSqlExecutor } from './tauriSql';

/** SQLite file created under Tauri's app-data directory. */
export const DATABASE_PATH = 'sqlite:obd-diagnose.db';

export interface Storage {
  db: SqlExecutor;
  repositories: Repositories;
  seed: SeedResult;
  legacy: LegacyMigrationResult;
}

export interface OpenStorageOptions {
  seed?: SeedOptions;
  legacyStore?: ReturnType<typeof browserKeyValueStore>;
  migrateLegacy?: boolean;
}

/**
 * Runs the versioned migrations, seeds the reference data and imports the
 * interim localStorage backups. Every step is idempotent, so a failed start is
 * safe to retry.
 */
export async function openStorage(
  db: SqlExecutor,
  options: OpenStorageOptions = {},
): Promise<Storage> {
  await migrate(db);
  const seed = await seedDatabase(db, options.seed);
  const repositories = createSqliteRepositories(db);

  const legacy =
    options.migrateLegacy === false
      ? { migrated: 0, skipped: 0, error: null }
      : await migrateLegacyBackups(
          repositories.scanBackups,
          repositories.settings,
          options.legacyStore === undefined ? browserKeyValueStore() : options.legacyStore,
        );

  return { db, repositories, seed, legacy };
}

/** Opens the real app database through the Tauri SQL plugin. */
export async function openTauriStorage(): Promise<Storage> {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const database = await Database.load(DATABASE_PATH);
  return openStorage(new TauriSqlExecutor(database));
}
