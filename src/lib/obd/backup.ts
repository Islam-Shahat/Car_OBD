import type { AdapterInfo } from '../elm327/driver';
import type { Dtc } from './dtc';
import type { ReadinessStatus } from './readiness';
import type { FreezeFrame, ScanResult } from './scanTypes';

/**
 * Snapshot persisted before Service 04 is sent. The SQLite implementation
 * arrives with the data phase; the interface keeps the safety flow independent
 * of the storage engine.
 */
export interface ScanBackup {
  id: string;
  createdAt: string;
  adapter: AdapterInfo;
  /** Explicit copies for the Phase 4 history/readiness tables. */
  stored: Dtc[];
  pending: Dtc[];
  permanent: Dtc[];
  freezeFrames: FreezeFrame[];
  readiness: ReadinessStatus | null;
  result: ScanResult;
}

export interface ScanBackupRepository {
  /** True for SQLite on disk; false for ephemeral in-memory storage. */
  readonly isDurable?: boolean;
  /** Must resolve only after the backup is durable. */
  save(backup: ScanBackup): Promise<void>;
  list(): Promise<ScanBackup[]>;
  get(id: string): Promise<ScanBackup | null>;
  /** Soft delete only; backups are never pruned automatically. */
  delete(id: string): Promise<void>;
}
