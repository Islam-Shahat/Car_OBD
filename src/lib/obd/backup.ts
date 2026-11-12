import type { AdapterInfo } from '../elm327/driver';
import type { ScanResult } from './scanTypes';

/**
 * Snapshot persisted before Service 04 is sent. The SQLite implementation
 * arrives with the data phase; the interface keeps the safety flow independent
 * of the storage engine.
 */
export interface ScanBackup {
  id: string;
  createdAt: string;
  adapter: AdapterInfo;
  result: ScanResult;
}

export interface ScanBackupRepository {
  /** Must resolve only after the backup is durable. */
  save(backup: ScanBackup): Promise<void>;
}
