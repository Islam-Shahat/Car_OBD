/*
 * The in-memory implementation is intentionally synchronous; the async
 * signatures exist only to match the repository interfaces.
 */
/* eslint-disable @typescript-eslint/require-await */
import type { ScanBackup } from '../obd/backup';
import { dtcCategory, normalizeDtcCode } from '../obd/dtc';
import type {
  DtcRepository,
  DtcReviewInput,
  RemoteConfigCacheRepository,
  Repositories,
  ScanRepository,
  SettingsRepository,
  VehicleCatalogRepository,
  VehicleRepository,
} from './repositories';
import { nowIso } from './sql';
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

export interface InMemoryOptions {
  now?: () => string;
  idFactory?: () => string;
}

type Clock = Required<InMemoryOptions>;

function clock(options: InMemoryOptions = {}): Clock {
  return {
    now: options.now ?? nowIso,
    idFactory: options.idFactory ?? (() => crypto.randomUUID()),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeMake(make: string | null | undefined): string | null {
  const value = make?.trim().toLowerCase();
  return value ? value : null;
}

export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly rows = new Map<string, Vehicle>();
  private readonly clock: Clock;

  constructor(rows: readonly Vehicle[] = [], options: InMemoryOptions = {}) {
    this.clock = clock(options);
    for (const row of rows) this.rows.set(row.id, clone(row));
  }

  async create(input: VehicleInput): Promise<Vehicle> {
    const at = this.clock.now();
    const row: Vehicle = {
      id: this.clock.idFactory(),
      catalogId: input.catalogId ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      engine: input.engine ?? null,
      vin: input.vin ?? null,
      notes: input.notes ?? null,
      makeText: input.makeText ?? null,
      modelText: input.modelText ?? null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    this.rows.set(row.id, row);
    return clone(row);
  }

  async update(id: string, patch: VehicleUpdate): Promise<Vehicle | null> {
    const row = this.rows.get(id);
    if (!row || row.deletedAt) return null;
    const next: Vehicle = { ...row, ...patch, updatedAt: this.clock.now() };
    this.rows.set(id, next);
    return clone(next);
  }

  async get(id: string): Promise<Vehicle | null> {
    const row = this.rows.get(id);
    return row && !row.deletedAt ? clone(row) : null;
  }

  async list(): Promise<Vehicle[]> {
    return [...this.rows.values()]
      .filter((row) => !row.deletedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  async findByVin(vin: string): Promise<Vehicle | null> {
    const wanted = vin.trim().toUpperCase();
    if (!wanted) return null;
    const row = [...this.rows.values()].find(
      (entry) => !entry.deletedAt && entry.vin?.toUpperCase() === wanted,
    );
    return row ? clone(row) : null;
  }

  async softDelete(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, { ...row, deletedAt: this.clock.now(), updatedAt: this.clock.now() });
  }
}

export class InMemoryVehicleCatalogRepository implements VehicleCatalogRepository {
  private readonly rows: CatalogEntry[];

  constructor(rows: readonly CatalogEntry[] = []) {
    this.rows = rows.filter((row) => !row.deletedAt).map(clone);
  }

  async makes(): Promise<CatalogMake[]> {
    const grouped = new Map<string, CatalogMake>();
    for (const row of this.rows) {
      const current = grouped.get(row.makeSlug);
      if (current) current.count += 1;
      else grouped.set(row.makeSlug, { make: row.make, makeSlug: row.makeSlug, count: 1 });
    }
    return [...grouped.values()].sort((left, right) => left.make.localeCompare(right.make));
  }

  async search(query: string, makeSlug?: string | null): Promise<CatalogEntry[]> {
    const needle = query.trim().toLowerCase();
    const slug = normalizeMake(makeSlug);
    return this.rows
      .filter((row) => !slug || row.makeSlug === slug)
      .filter((row) => {
        if (!needle) return true;
        return [row.make, row.model, ...row.aliasesAr, ...row.aliasesEn].some((value) =>
          value.toLowerCase().includes(needle),
        );
      })
      .sort(
        (left, right) =>
          left.make.localeCompare(right.make) || left.model.localeCompare(right.model),
      )
      .map(clone);
  }

  async get(id: string): Promise<CatalogEntry | null> {
    const row = this.rows.find((entry) => entry.id === id);
    return row ? clone(row) : null;
  }

  async count(): Promise<number> {
    return this.rows.length;
  }
}

export class InMemoryDtcRepository implements DtcRepository {
  private readonly rows: DtcCode[];
  private readonly clock: Clock;

  constructor(rows: readonly DtcCode[] = [], options: InMemoryOptions = {}) {
    this.rows = rows.map(clone);
    this.clock = clock(options);
  }

  private find(code: string, make: string | null): DtcCode | undefined {
    const wanted = normalizeDtcCode(code);
    return this.rows.find(
      (row) =>
        !row.deletedAt && row.code === wanted && normalizeMake(row.make) === normalizeMake(make),
    );
  }

  async lookup(code: string, make?: string | null): Promise<DtcLookup> {
    const normalized = normalizeDtcCode(code);
    const slug = normalizeMake(make);
    const specific = slug ? this.find(normalized, slug) : undefined;
    const generic = this.find(normalized, null);
    const record = specific ?? generic ?? null;
    return {
      kind: record ? (specific ? 'specific' : 'generic') : 'unknown',
      code: normalized,
      category: dtcCategory(normalized),
      record: record ? clone(record) : null,
    };
  }

  async get(code: string, make?: string | null): Promise<DtcCode | null> {
    const row = this.find(code, normalizeMake(make));
    return row ? clone(row) : null;
  }

  async counts(): Promise<DtcCounts> {
    const generic = this.rows.filter((row) => !row.deletedAt && row.make === null);
    return {
      total: generic.length,
      tier1: generic.filter((row) => row.translationTier === 1).length,
      tier2: generic.filter((row) => row.translationTier === 2).length,
      needsReview: generic.filter((row) => row.needsReview).length,
    };
  }

  async needsReview(): Promise<DtcCode[]> {
    return this.rows
      .filter((row) => !row.deletedAt && row.needsReview)
      .sort(
        (left, right) =>
          left.translationTier - right.translationTier || left.code.localeCompare(right.code),
      )
      .map(clone);
  }

  async applyReview(id: string, input: DtcReviewInput): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id && !row.deletedAt);
    const row = this.rows[index];
    if (!row) return false;
    this.rows[index] = {
      ...row,
      descriptionAr: input.descriptionAr,
      possibleCausesAr: [...input.possibleCausesAr],
      inspectionStepsAr: [...input.inspectionStepsAr],
      needsReview: false,
      reviewedBy: input.reviewedBy,
      reviewedAt: input.reviewedAt ?? this.clock.now(),
      updatedAt: this.clock.now(),
    };
    return true;
  }
}

export class InMemoryScanRepository implements ScanRepository {
  private readonly sessions = new Map<string, ScanSession>();
  private readonly results: ScanResultRow[] = [];
  private readonly readiness: ReadinessSnapshot[] = [];
  private readonly live: LiveDataLog[] = [];
  private readonly clock: Clock;

  constructor(options: InMemoryOptions = {}) {
    this.clock = clock(options);
  }

  async createSession(input: ScanSessionInput): Promise<ScanSession> {
    const at = this.clock.now();
    const row: ScanSession = {
      id: this.clock.idFactory(),
      vehicleId: input.vehicleId ?? null,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt ?? null,
      protocol: input.protocol ?? null,
      adapterInfo: input.adapterInfo ?? null,
      milStatus: input.milStatus ?? null,
      overallStatus: input.overallStatus ?? null,
      mode: input.mode ?? 'normal',
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    this.sessions.set(row.id, row);
    return clone(row);
  }

  async updateSession(id: string, patch: ScanSessionUpdate): Promise<ScanSession | null> {
    const row = this.sessions.get(id);
    if (!row || row.deletedAt) return null;
    const next: ScanSession = { ...row, ...patch, updatedAt: this.clock.now() };
    this.sessions.set(id, next);
    return clone(next);
  }

  async getSession(id: string): Promise<ScanSession | null> {
    const row = this.sessions.get(id);
    return row && !row.deletedAt ? clone(row) : null;
  }

  async listSessions(vehicleId?: string | null): Promise<ScanSession[]> {
    return [...this.sessions.values()]
      .filter((row) => !row.deletedAt && (!vehicleId || row.vehicleId === vehicleId))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map(clone);
  }

  async addResults(sessionId: string, results: readonly ScanResultInput[]): Promise<void> {
    const at = this.clock.now();
    for (const result of results) {
      this.results.push({
        id: this.clock.idFactory(),
        sessionId,
        code: result.code,
        type: result.type,
        freezeFrame: result.freezeFrame ?? null,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      });
    }
  }

  async resultsFor(sessionId: string): Promise<ScanResultRow[]> {
    return this.results.filter((row) => row.sessionId === sessionId && !row.deletedAt).map(clone);
  }

  async addReadiness(
    sessionId: string,
    phase: ReadinessPhase,
    data: unknown,
  ): Promise<ReadinessSnapshot> {
    const at = this.clock.now();
    const row: ReadinessSnapshot = {
      id: this.clock.idFactory(),
      sessionId,
      phase,
      data: clone(data),
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    this.readiness.push(row);
    return clone(row);
  }

  async readinessFor(sessionId: string): Promise<ReadinessSnapshot[]> {
    return this.readiness
      .filter((row) => row.sessionId === sessionId && !row.deletedAt)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async addLiveData(sessionId: string, logs: readonly LiveDataLogInput[]): Promise<void> {
    const at = this.clock.now();
    for (const log of logs) {
      this.live.push({
        id: this.clock.idFactory(),
        sessionId,
        pid: log.pid,
        value: log.value ?? null,
        unit: log.unit ?? null,
        ts: log.ts,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      });
    }
  }

  async liveDataFor(sessionId: string): Promise<LiveDataLog[]> {
    return this.live
      .filter((row) => row.sessionId === sessionId && !row.deletedAt)
      .sort((left, right) => left.ts.localeCompare(right.ts))
      .map(clone);
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  private readonly rows = new Map<string, Setting>();
  private readonly clock: Clock;

  constructor(options: InMemoryOptions = {}) {
    this.clock = clock(options);
  }

  async get(key: string): Promise<string | null> {
    const row = this.rows.get(key);
    return row && !row.deletedAt ? row.value : null;
  }

  async set(key: string, value: string): Promise<Setting> {
    const at = this.clock.now();
    const existing = this.rows.get(key);
    const row: Setting = {
      id: existing?.id ?? this.clock.idFactory(),
      key,
      value,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
      deletedAt: null,
    };
    this.rows.set(key, row);
    return clone(row);
  }

  async delete(key: string): Promise<void> {
    const row = this.rows.get(key);
    if (!row) return;
    this.rows.set(key, { ...row, deletedAt: this.clock.now(), updatedAt: this.clock.now() });
  }
}

export class InMemoryRemoteConfigCacheRepository implements RemoteConfigCacheRepository {
  private readonly rows: RemoteConfigCacheEntry[] = [];
  private readonly clock: Clock;

  constructor(options: InMemoryOptions = {}) {
    this.clock = clock(options);
  }

  async latest(): Promise<RemoteConfigCacheEntry | null> {
    const row = [...this.rows]
      .filter((entry) => !entry.deletedAt)
      .sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt))[0];
    return row ? clone(row) : null;
  }

  async save(input: RemoteConfigCacheInput): Promise<RemoteConfigCacheEntry> {
    const at = this.clock.now();
    const row: RemoteConfigCacheEntry = {
      id: this.clock.idFactory(),
      json: input.json,
      signature: input.signature ?? null,
      fetchedAt: input.fetchedAt,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    this.rows.push(row);
    return clone(row);
  }
}

export class InMemoryScanBackupRepository {
  private readonly rows = new Map<string, ScanBackup>();
  private readonly clock: Clock;

  constructor(options: InMemoryOptions = {}) {
    this.clock = clock(options);
  }

  async save(backup: ScanBackup): Promise<void> {
    this.rows.set(backup.id, clone(backup));
    this.clock.now();
  }

  async list(): Promise<ScanBackup[]> {
    return [...this.rows.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  async get(id: string): Promise<ScanBackup | null> {
    const row = this.rows.get(id);
    return row ? clone(row) : null;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

export interface InMemorySeed {
  vehicles?: readonly Vehicle[];
  catalog?: readonly CatalogEntry[];
  dtc?: readonly DtcCode[];
}

export function createInMemoryRepositories(
  seed: InMemorySeed = {},
  options: InMemoryOptions = {},
): Repositories & { backups: InMemoryScanBackupRepository } {
  const backups = new InMemoryScanBackupRepository(options);
  return {
    vehicles: new InMemoryVehicleRepository(seed.vehicles, options),
    catalog: new InMemoryVehicleCatalogRepository(seed.catalog),
    dtc: new InMemoryDtcRepository(seed.dtc, options),
    scans: new InMemoryScanRepository(options),
    settings: new InMemorySettingsRepository(options),
    remoteConfig: new InMemoryRemoteConfigCacheRepository(options),
    scanBackups: backups,
    backups,
  };
}
