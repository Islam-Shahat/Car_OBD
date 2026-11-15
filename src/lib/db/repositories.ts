import type { ScanBackup, ScanBackupRepository } from '../obd/backup';
import type {
  CatalogEntry,
  CatalogMake,
  DtcCode,
  DtcCounts,
  DtcLookup,
  LiveDataLog,
  LiveDataLogInput,
  ReadinessPhase,
  ReadinessSnapshot,
  RemoteConfigCacheEntry,
  RemoteConfigCacheInput,
  ScanResultInput,
  ScanResultRow,
  ScanSession,
  ScanSessionInput,
  ScanSessionUpdate,
  Setting,
  Vehicle,
  VehicleInput,
  VehicleUpdate,
} from './types';

export interface VehicleRepository {
  create(input: VehicleInput): Promise<Vehicle>;
  update(id: string, patch: VehicleUpdate): Promise<Vehicle | null>;
  get(id: string): Promise<Vehicle | null>;
  list(): Promise<Vehicle[]>;
  findByVin(vin: string): Promise<Vehicle | null>;
  softDelete(id: string): Promise<void>;
}

export interface VehicleCatalogRepository {
  makes(): Promise<CatalogMake[]>;
  search(query: string, makeSlug?: string | null): Promise<CatalogEntry[]>;
  get(id: string): Promise<CatalogEntry | null>;
  count(): Promise<number>;
}

export interface DtcReviewInput {
  descriptionAr: string;
  possibleCausesAr: string[];
  inspectionStepsAr: string[];
  reviewedBy: string;
  reviewedAt?: string;
}

export interface DtcRepository {
  /**
   * Make-aware lookup: selected make first, then the generic row, then the
   * unknown-code fallback. `make` is a normalized slug or null.
   */
  lookup(code: string, make?: string | null): Promise<DtcLookup>;
  get(code: string, make?: string | null): Promise<DtcCode | null>;
  counts(): Promise<DtcCounts>;
  /** All rows still awaiting review, Tier 1 first. */
  needsReview(): Promise<DtcCode[]>;
  applyReview(id: string, input: DtcReviewInput): Promise<boolean>;
}

export interface ScanRepository {
  createSession(input: ScanSessionInput): Promise<ScanSession>;
  updateSession(id: string, patch: ScanSessionUpdate): Promise<ScanSession | null>;
  getSession(id: string): Promise<ScanSession | null>;
  listSessions(vehicleId?: string | null): Promise<ScanSession[]>;
  addResults(sessionId: string, results: readonly ScanResultInput[]): Promise<void>;
  resultsFor(sessionId: string): Promise<ScanResultRow[]>;
  addReadiness(sessionId: string, phase: ReadinessPhase, data: unknown): Promise<ReadinessSnapshot>;
  readinessFor(sessionId: string): Promise<ReadinessSnapshot[]>;
  addLiveData(sessionId: string, logs: readonly LiveDataLogInput[]): Promise<void>;
  liveDataFor(sessionId: string): Promise<LiveDataLog[]>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<Setting>;
  delete(key: string): Promise<void>;
}

export interface RemoteConfigCacheRepository {
  latest(): Promise<RemoteConfigCacheEntry | null>;
  save(input: RemoteConfigCacheInput): Promise<RemoteConfigCacheEntry>;
}

export type { ScanBackup, ScanBackupRepository };

export interface Repositories {
  vehicles: VehicleRepository;
  catalog: VehicleCatalogRepository;
  dtc: DtcRepository;
  scans: ScanRepository;
  settings: SettingsRepository;
  remoteConfig: RemoteConfigCacheRepository;
  scanBackups: ScanBackupRepository;
}
