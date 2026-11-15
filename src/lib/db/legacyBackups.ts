import type { ScanBackup, ScanBackupRepository } from '../obd/backup';
import type { SettingsRepository } from './repositories';

/** Key used by the interim localStorage store before SQLite existed. */
export const LEGACY_BACKUP_STORAGE_KEY = 'obd-diagnose.scan-backups.v1';
export const LEGACY_BACKUP_UNREADABLE_KEY = 'obd-diagnose.scan-backups.v1.unreadable';
export const LEGACY_BACKUP_MIGRATION_KEY = 'migration.local-backups.v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Returns null outside a browser/WebView; migration is then a no-op. */
export function browserKeyValueStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function memoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function isScanBackup(value: unknown): value is ScanBackup {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.result === 'object' &&
    record.result !== null &&
    Array.isArray(record.stored) &&
    Array.isArray(record.pending) &&
    Array.isArray(record.permanent)
  );
}

export interface LegacyMigrationResult {
  migrated: number;
  skipped: number;
  /** Set when the legacy JSON was unreadable and was preserved aside. */
  error: string | null;
}

/**
 * Imports the interim localStorage backups exactly once. Saving is keyed by
 * backup id, so a retry after a partial failure cannot duplicate entries; the
 * old key is removed only after every readable entry is durable in SQLite.
 * Entries that are not shaped like a backup are preserved under
 * `.unreadable` instead of being silently dropped.
 */
export async function migrateLegacyBackups(
  backups: ScanBackupRepository,
  settings: SettingsRepository,
  store: KeyValueStore | null,
): Promise<LegacyMigrationResult> {
  if (!store) return { migrated: 0, skipped: 0, error: null };
  if ((await settings.get(LEGACY_BACKUP_MIGRATION_KEY)) === 'done') {
    return { migrated: 0, skipped: 0, error: null };
  }

  const raw = store.getItem(LEGACY_BACKUP_STORAGE_KEY);
  if (!raw) {
    await settings.set(LEGACY_BACKUP_MIGRATION_KEY, 'done');
    return { migrated: 0, skipped: 0, error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    store.setItem(LEGACY_BACKUP_UNREADABLE_KEY, raw);
    store.removeItem(LEGACY_BACKUP_STORAGE_KEY);
    await settings.set(LEGACY_BACKUP_MIGRATION_KEY, 'done');
    return { migrated: 0, skipped: 0, error: 'unreadable-legacy-json' };
  }

  const entries = Array.isArray(parsed) ? parsed : [];
  const skipped: unknown[] = [];
  let migrated = 0;

  // A save failure throws before the marker/removal below, so the legacy data
  // stays in place and the next start retries instead of losing it.
  for (const entry of entries) {
    if (!isScanBackup(entry)) {
      skipped.push(entry);
      continue;
    }
    await backups.save(entry);
    migrated += 1;
  }

  if (skipped.length > 0) {
    store.setItem(LEGACY_BACKUP_UNREADABLE_KEY, JSON.stringify(skipped));
  }
  await settings.set(LEGACY_BACKUP_MIGRATION_KEY, 'done');
  store.removeItem(LEGACY_BACKUP_STORAGE_KEY);
  return { migrated, skipped: skipped.length, error: null };
}
