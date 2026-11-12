import type { ScanBackup, ScanBackupRepository } from '../obd/backup';

export const SCAN_BACKUP_STORAGE_KEY = 'obd-diagnose.scan-backups.v1';
const MAX_BACKUPS = 20;

function readExisting(): ScanBackup[] {
  const raw = window.localStorage.getItem(SCAN_BACKUP_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScanBackup[]) : [];
  } catch {
    // A corrupt history must not prevent saving the new safety backup.
    return [];
  }
}

function containsBackup(raw: string | null, id: string): boolean {
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return (
      Array.isArray(parsed) && parsed.some((entry) => (entry as { id?: string } | null)?.id === id)
    );
  } catch {
    return false;
  }
}

/**
 * Interim backup store until the SQLite repository arrives in the data phase.
 * Writes are verified before `save` resolves, so Mode 04 is never sent after a
 * silently failed backup.
 */
export class LocalStorageScanBackupRepository implements ScanBackupRepository {
  save(backup: ScanBackup): Promise<void> {
    const existing = readExisting().filter((entry) => entry.id !== backup.id);
    const next = [backup, ...existing].slice(0, MAX_BACKUPS);

    window.localStorage.setItem(SCAN_BACKUP_STORAGE_KEY, JSON.stringify(next));

    if (!containsBackup(window.localStorage.getItem(SCAN_BACKUP_STORAGE_KEY), backup.id)) {
      throw new Error('The scan backup could not be verified after writing');
    }
    return Promise.resolve();
  }
}
