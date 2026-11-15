import { afterEach, describe, expect, it } from 'vitest';

import { createInMemoryRepositories } from '../src/lib/db/inMemoryRepositories';
import {
  LEGACY_BACKUP_MIGRATION_KEY,
  LEGACY_BACKUP_STORAGE_KEY,
  LEGACY_BACKUP_UNREADABLE_KEY,
  memoryKeyValueStore,
  migrateLegacyBackups,
} from '../src/lib/db/legacyBackups';
import { migrate } from '../src/lib/db/migrations';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { SqliteScanBackupRepository } from '../src/lib/db/sqliteRepositories';
import type { ScanBackup } from '../src/lib/obd/backup';
import { createTestDatabase, type TestDatabase } from './helpers/sqlite';

const NOW = '2026-11-14T10:00:00.000Z';

function legacyBackup(id: string): unknown {
  return {
    id,
    createdAt: id,
    adapter: {},
    stored: [],
    pending: [],
    permanent: [],
    freezeFrames: [],
    readiness: null,
    result: {},
  };
}

let db: TestDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('legacy localStorage backup migration', () => {
  it('moves every valid backup once, without duplication or pruning', async () => {
    db = createTestDatabase();
    await migrate(db);
    const repositories = createSqliteRepositories(db, { now: () => NOW });
    const store = memoryKeyValueStore({
      [LEGACY_BACKUP_STORAGE_KEY]: JSON.stringify([legacyBackup('old-1'), legacyBackup('old-2')]),
    });

    const first = await migrateLegacyBackups(
      repositories.scanBackups,
      repositories.settings,
      store,
    );
    expect(first).toEqual({ migrated: 2, skipped: 0, error: null });
    expect(store.getItem(LEGACY_BACKUP_STORAGE_KEY)).toBeNull();
    expect(await repositories.settings.get(LEGACY_BACKUP_MIGRATION_KEY)).toBe('done');
    expect((await repositories.scanBackups.list()).map((row) => row.id).sort()).toEqual([
      'old-1',
      'old-2',
    ]);

    // A stale copy of the old key must not create duplicates on later starts.
    store.setItem(LEGACY_BACKUP_STORAGE_KEY, JSON.stringify([legacyBackup('old-1')]));
    const second = await migrateLegacyBackups(
      repositories.scanBackups,
      repositories.settings,
      store,
    );
    expect(second).toEqual({ migrated: 0, skipped: 0, error: null });
    expect(await repositories.scanBackups.list()).toHaveLength(2);
  });

  it('keeps valid entries, preserves unreadable ones and reports the skip', async () => {
    db = createTestDatabase();
    await migrate(db);
    const repositories = createSqliteRepositories(db, { now: () => NOW });
    const store = memoryKeyValueStore({
      [LEGACY_BACKUP_STORAGE_KEY]: JSON.stringify([legacyBackup('old-1'), { not: 'a backup' }]),
    });

    const result = await migrateLegacyBackups(
      repositories.scanBackups,
      repositories.settings,
      store,
    );
    expect(result).toEqual({ migrated: 1, skipped: 1, error: null });
    expect(JSON.parse(store.getItem(LEGACY_BACKUP_UNREADABLE_KEY) ?? '[]')).toEqual([
      { not: 'a backup' },
    ]);
    expect(await repositories.scanBackups.list()).toHaveLength(1);
  });

  it('preserves corrupt legacy JSON aside instead of dropping it', async () => {
    db = createTestDatabase();
    await migrate(db);
    const repositories = createSqliteRepositories(db, { now: () => NOW });
    const store = memoryKeyValueStore({ [LEGACY_BACKUP_STORAGE_KEY]: 'not-json' });

    const result = await migrateLegacyBackups(
      repositories.scanBackups,
      repositories.settings,
      store,
    );
    expect(result).toEqual({ migrated: 0, skipped: 0, error: 'unreadable-legacy-json' });
    expect(store.getItem(LEGACY_BACKUP_UNREADABLE_KEY)).toBe('not-json');
    expect(store.getItem(LEGACY_BACKUP_STORAGE_KEY)).toBeNull();
  });

  it('leaves the legacy data in place when a save fails, so the next start retries', async () => {
    const { backups, settings } = createInMemoryRepositories();
    const failing = {
      save: () => Promise.reject(new Error('disk full')),
      list: backups.list.bind(backups),
      get: backups.get.bind(backups),
      delete: backups.delete.bind(backups),
    };
    const store = memoryKeyValueStore({
      [LEGACY_BACKUP_STORAGE_KEY]: JSON.stringify([legacyBackup('old-1')]),
    });

    await expect(migrateLegacyBackups(failing, settings, store)).rejects.toThrow('disk full');
    expect(store.getItem(LEGACY_BACKUP_STORAGE_KEY)).not.toBeNull();
    expect(await settings.get(LEGACY_BACKUP_MIGRATION_KEY)).toBeNull();
  });

  it('treats a backup that cannot be read back as failed', async () => {
    const repository = new SqliteScanBackupRepository(
      {
        execute: () => Promise.resolve({ rowsAffected: 1 }),
        select: <T>() => Promise.resolve([] as T[]),
        transaction: <T>(work: () => Promise<T>): Promise<T> => work(),
      },
      { now: () => NOW },
    );

    await expect(repository.save(legacyBackup('silent-write') as ScanBackup)).rejects.toThrow(
      'could not be verified',
    );
  });
});
