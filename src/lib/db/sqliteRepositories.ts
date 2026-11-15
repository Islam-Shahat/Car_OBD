import type { ScanBackup, ScanBackupRepository } from '../obd/backup';
import { dtcCategory, normalizeDtcCode } from '../obd/dtc';
import { searchKey } from '../i18n/arabic';
import type {
  DtcRepository,
  DtcReviewInput,
  RemoteConfigCacheRepository,
  Repositories,
  ScanRepository,
  SettingsRepository,
  VehicleCatalogRepository,
  VehicleRepository,
  WmiUserMapRepository,
} from './repositories';
import {
  fromSqlBool,
  likeContains,
  nowIso,
  parseJsonArray,
  stringifyJsonArray,
  type SqlExecutor,
  type SqlValue,
} from './sql';
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
  ScanSession,
  ScanResultType,
  ScanResultRow,
  ScanSessionInput,
  ScanSessionUpdate,
  Setting,
  Vehicle,
  VehicleInput,
  VehicleUpdate,
  WmiUserMapEntry,
} from './types';

export interface SqliteRepositoryOptions {
  now?: () => string;
  idFactory?: () => string;
}

interface RepositoryClock {
  now: () => string;
  idFactory: () => string;
}

function repositoryClock(options: SqliteRepositoryOptions = {}): RepositoryClock {
  return {
    now: options.now ?? nowIso,
    idFactory: options.idFactory ?? (() => crypto.randomUUID()),
  };
}

function jsonOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Vehicles                                                                    */
/* -------------------------------------------------------------------------- */

interface VehicleRow {
  id: string;
  catalog_id: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  vin: string | null;
  notes: string | null;
  make_text: string | null;
  model_text: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    catalogId: row.catalog_id,
    make: row.make,
    model: row.model,
    year: row.year === null ? null : Number(row.year),
    engine: row.engine,
    vin: row.vin,
    notes: row.notes,
    makeText: row.make_text,
    modelText: row.model_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const VEHICLE_COLUMNS = {
  catalogId: 'catalog_id',
  make: 'make',
  model: 'model',
  year: 'year',
  engine: 'engine',
  vin: 'vin',
  notes: 'notes',
  makeText: 'make_text',
  modelText: 'model_text',
} as const satisfies Record<keyof VehicleInput, string>;

export class SqliteVehicleRepository implements VehicleRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
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
    await this.db.execute(
      `INSERT INTO vehicles (
        id, catalog_id, make, model, year, engine, vin, notes, make_text, model_text,
        created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        row.id,
        row.catalogId,
        row.make,
        row.model,
        row.year,
        row.engine,
        row.vin,
        row.notes,
        row.makeText,
        row.modelText,
        row.createdAt,
        row.updatedAt,
        row.deletedAt,
      ],
    );
    return row;
  }

  async update(id: string, patch: VehicleUpdate): Promise<Vehicle | null> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [
      keyof VehicleInput,
      SqlValue,
    ][];
    if (entries.length === 0) return this.get(id);

    const sets = entries.map(([key], index) => `${VEHICLE_COLUMNS[key]} = $${index + 1}`);
    sets.push(`updated_at = $${entries.length + 1}`);
    const params: SqlValue[] = entries.map(([, value]) => value);
    params.push(this.clock.now(), id);

    await this.db.execute(
      `UPDATE vehicles SET ${sets.join(', ')}
       WHERE id = $${entries.length + 2} AND deleted_at IS NULL`,
      params,
    );
    return this.get(id);
  }

  async get(id: string): Promise<Vehicle | null> {
    const [row] = await this.db.select<VehicleRow>(
      'SELECT * FROM vehicles WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return row ? mapVehicle(row) : null;
  }

  async list(): Promise<Vehicle[]> {
    const rows = await this.db.select<VehicleRow>(
      'SELECT * FROM vehicles WHERE deleted_at IS NULL ORDER BY updated_at DESC',
    );
    return rows.map(mapVehicle);
  }

  async findByVin(vin: string): Promise<Vehicle | null> {
    const wanted = vin.trim().toUpperCase();
    if (!wanted) return null;
    const [row] = await this.db.select<VehicleRow>(
      `SELECT * FROM vehicles
       WHERE deleted_at IS NULL AND upper(vin) = $1
       ORDER BY updated_at DESC LIMIT 1`,
      [wanted],
    );
    return row ? mapVehicle(row) : null;
  }

  async softDelete(id: string): Promise<void> {
    const at = this.clock.now();
    await this.db.execute('UPDATE vehicles SET deleted_at = $1, updated_at = $1 WHERE id = $2', [
      at,
      id,
    ]);
  }
}

/* -------------------------------------------------------------------------- */
/* Vehicle catalog                                                             */
/* -------------------------------------------------------------------------- */

interface CatalogRow {
  id: string;
  make: string;
  make_slug: string;
  model: string;
  make_aliases_ar: string;
  aliases_ar: string;
  aliases_en: string;
  year_from: number | null;
  year_to: number | null;
  body_type: string | null;
  source_tier: string;
  verified: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapCatalog(row: CatalogRow): CatalogEntry {
  return {
    id: row.id,
    make: row.make,
    makeSlug: row.make_slug,
    model: row.model,
    makeAliasesAr: parseJsonArray(row.make_aliases_ar),
    aliasesAr: parseJsonArray(row.aliases_ar),
    aliasesEn: parseJsonArray(row.aliases_en),
    yearFrom: row.year_from === null ? null : Number(row.year_from),
    yearTo: row.year_to === null ? null : Number(row.year_to),
    bodyType: row.body_type,
    sourceTier: row.source_tier === 'cited' ? 'cited' : 'knowledge',
    verified: fromSqlBool(row.verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqliteVehicleCatalogRepository implements VehicleCatalogRepository {
  private readonly db: SqlExecutor;

  constructor(db: SqlExecutor) {
    this.db = db;
  }

  async makes(): Promise<CatalogMake[]> {
    const rows = await this.db.select<{
      make: string;
      make_slug: string;
      count: number;
      make_aliases_ar: string;
    }>(
      `SELECT make, make_slug, COUNT(*) AS count, MAX(make_aliases_ar) AS make_aliases_ar
       FROM vehicle_catalog
       WHERE deleted_at IS NULL
       GROUP BY make, make_slug
       ORDER BY make COLLATE NOCASE`,
    );
    return rows.map((row) => ({
      make: row.make,
      makeSlug: row.make_slug,
      count: Number(row.count),
      aliasesAr: parseJsonArray(row.make_aliases_ar),
    }));
  }

  async search(query: string, makeSlug?: string | null): Promise<CatalogEntry[]> {
    const needle = likeContains(searchKey(query));
    const slug = makeSlug?.trim().toLowerCase() || null;
    const rows = await this.db.select<CatalogRow>(
      `SELECT * FROM vehicle_catalog
       WHERE deleted_at IS NULL
         AND ($1 IS NULL OR make_slug = $1)
         AND search_text LIKE $2 ESCAPE '\\'
       ORDER BY make COLLATE NOCASE, model COLLATE NOCASE
       LIMIT 200`,
      [slug, needle],
    );
    return rows.map(mapCatalog);
  }

  async get(id: string): Promise<CatalogEntry | null> {
    const [row] = await this.db.select<CatalogRow>(
      'SELECT * FROM vehicle_catalog WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return row ? mapCatalog(row) : null;
  }

  async count(): Promise<number> {
    const [row] = await this.db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM vehicle_catalog WHERE deleted_at IS NULL',
    );
    return Number(row?.count ?? 0);
  }
}

/* -------------------------------------------------------------------------- */
/* DTC codes                                                                   */
/* -------------------------------------------------------------------------- */

interface DtcRow {
  id: string;
  code: string;
  make: string | null;
  description_ar: string;
  description_en: string;
  severity: string | null;
  severity_source: string;
  possible_causes_ar: string;
  possible_causes_en: string;
  inspection_steps_ar: string;
  inspection_steps_en: string;
  source: string;
  source_version: string;
  translation_tier: number;
  needs_review: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapDtc(row: DtcRow): DtcCode {
  return {
    id: row.id,
    code: row.code,
    make: row.make,
    descriptionAr: row.description_ar,
    descriptionEn: row.description_en,
    severity: row.severity,
    severitySource: 'heuristic',
    possibleCausesAr: parseJsonArray(row.possible_causes_ar),
    possibleCausesEn: parseJsonArray(row.possible_causes_en),
    inspectionStepsAr: parseJsonArray(row.inspection_steps_ar),
    inspectionStepsEn: parseJsonArray(row.inspection_steps_en),
    source: row.source,
    sourceVersion: row.source_version,
    translationTier: row.translation_tier === 1 ? 1 : row.translation_tier === 3 ? 3 : 2,
    needsReview: fromSqlBool(row.needs_review),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function normalizeMake(make: string | null | undefined): string | null {
  const value = make?.trim().toLowerCase();
  return value ? value : null;
}

export class SqliteDtcRepository implements DtcRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  private async byCodeAndMake(code: string, make: string | null): Promise<DtcCode | null> {
    const [row] = await this.db.select<DtcRow>(
      `SELECT * FROM dtc_codes
       WHERE code = $1 AND make IS $2 AND deleted_at IS NULL
       LIMIT 1`,
      [code, make],
    );
    return row ? mapDtc(row) : null;
  }

  async lookup(code: string, make?: string | null): Promise<DtcLookup> {
    const normalized = normalizeDtcCode(code);
    const slug = normalizeMake(make);
    const specific = slug ? await this.byCodeAndMake(normalized, slug) : null;
    const generic = await this.byCodeAndMake(normalized, null);
    const record = specific ?? generic;
    return {
      kind: record ? (specific ? 'specific' : 'generic') : 'unknown',
      code: normalized,
      category: dtcCategory(normalized),
      record,
    };
  }

  async get(code: string, make?: string | null): Promise<DtcCode | null> {
    return this.byCodeAndMake(normalizeDtcCode(code), normalizeMake(make));
  }

  async counts(): Promise<DtcCounts> {
    const [row] = await this.db.select<{
      total: number;
      tier1: number | null;
      tier2: number | null;
      needs_review: number | null;
    }>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN translation_tier = 1 THEN 1 ELSE 0 END) AS tier1,
         SUM(CASE WHEN translation_tier = 2 THEN 1 ELSE 0 END) AS tier2,
         SUM(CASE WHEN needs_review = 1 THEN 1 ELSE 0 END) AS needs_review
       FROM dtc_codes
       WHERE deleted_at IS NULL AND make IS NULL`,
    );
    return {
      total: Number(row?.total ?? 0),
      tier1: Number(row?.tier1 ?? 0),
      tier2: Number(row?.tier2 ?? 0),
      needsReview: Number(row?.needs_review ?? 0),
    };
  }

  async needsReview(): Promise<DtcCode[]> {
    const rows = await this.db.select<DtcRow>(
      `SELECT * FROM dtc_codes
       WHERE deleted_at IS NULL AND needs_review = 1
       ORDER BY translation_tier ASC, code ASC`,
    );
    return rows.map(mapDtc);
  }

  async applyReview(id: string, input: DtcReviewInput): Promise<boolean> {
    const result = await this.db.execute(
      `UPDATE dtc_codes SET
         description_ar = $1,
         possible_causes_ar = $2,
         inspection_steps_ar = $3,
         needs_review = 0,
         reviewed_by = $4,
         reviewed_at = $5,
         updated_at = $6
       WHERE id = $7 AND deleted_at IS NULL`,
      [
        input.descriptionAr,
        stringifyJsonArray(input.possibleCausesAr),
        stringifyJsonArray(input.inspectionStepsAr),
        input.reviewedBy,
        input.reviewedAt ?? this.clock.now(),
        this.clock.now(),
        id,
      ],
    );
    return result.rowsAffected > 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Scan history                                                                */
/* -------------------------------------------------------------------------- */

interface ScanSessionRow {
  id: string;
  vehicle_id: string | null;
  started_at: string;
  finished_at: string | null;
  protocol: string | null;
  adapter_info: string | null;
  mil_status: string | null;
  overall_status: string | null;
  mode: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapSession(row: ScanSessionRow): ScanSession {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    protocol: row.protocol,
    adapterInfo: parseJson(row.adapter_info),
    milStatus: parseJson(row.mil_status),
    overallStatus: row.overall_status,
    mode: row.mode === 'pre_purchase' ? 'pre_purchase' : 'normal',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

interface ScanResultDbRow {
  id: string;
  session_id: string;
  code: string;
  type: string;
  freeze_frame_json: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapScanResult(row: ScanResultDbRow): ScanResultRow {
  const type: ScanResultType =
    row.type === 'pending' ? 'pending' : row.type === 'permanent' ? 'permanent' : 'stored';
  return {
    id: row.id,
    sessionId: row.session_id,
    code: row.code,
    type,
    freezeFrame: parseJson(row.freeze_frame_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqliteScanRepository implements ScanRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  async createSession(input: ScanSessionInput): Promise<ScanSession> {
    const at = this.clock.now();
    const id = this.clock.idFactory();
    await this.db.execute(
      `INSERT INTO scan_sessions (
        id, vehicle_id, started_at, finished_at, protocol, adapter_info, mil_status,
        overall_status, mode, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)`,
      [
        id,
        input.vehicleId ?? null,
        input.startedAt,
        input.finishedAt ?? null,
        input.protocol ?? null,
        jsonOrNull(input.adapterInfo),
        jsonOrNull(input.milStatus),
        input.overallStatus ?? null,
        input.mode ?? 'normal',
        at,
        at,
      ],
    );
    return {
      id,
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
  }

  async updateSession(id: string, patch: ScanSessionUpdate): Promise<ScanSession | null> {
    const columns = {
      finishedAt: 'finished_at',
      protocol: 'protocol',
      adapterInfo: 'adapter_info',
      milStatus: 'mil_status',
      overallStatus: 'overall_status',
      vehicleId: 'vehicle_id',
      mode: 'mode',
    } as const;
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [
      keyof ScanSessionUpdate,
      unknown,
    ][];
    if (entries.length === 0) return this.getSession(id);

    const sets = entries.map(([key], index) => `${columns[key]} = $${index + 1}`);
    sets.push(`updated_at = $${entries.length + 1}`);
    const params: SqlValue[] = entries.map(([key, value]) =>
      key === 'adapterInfo' || key === 'milStatus' ? jsonOrNull(value) : (value as SqlValue),
    );
    params.push(this.clock.now(), id);

    await this.db.execute(
      `UPDATE scan_sessions SET ${sets.join(', ')}
       WHERE id = $${entries.length + 2} AND deleted_at IS NULL`,
      params,
    );
    return this.getSession(id);
  }

  async getSession(id: string): Promise<ScanSession | null> {
    const [row] = await this.db.select<ScanSessionRow>(
      'SELECT * FROM scan_sessions WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return row ? mapSession(row) : null;
  }

  async listSessions(vehicleId?: string | null): Promise<ScanSession[]> {
    const rows = await this.db.select<ScanSessionRow>(
      `SELECT * FROM scan_sessions
       WHERE deleted_at IS NULL AND ($1 IS NULL OR vehicle_id = $1)
       ORDER BY started_at DESC`,
      [vehicleId ?? null],
    );
    return rows.map(mapSession);
  }

  async addResults(sessionId: string, results: readonly ScanResultInput[]): Promise<void> {
    const at = this.clock.now();
    for (const result of results) {
      await this.db.execute(
        `INSERT INTO scan_results (
          id, session_id, code, type, freeze_frame_json, created_at, updated_at, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
        [
          this.clock.idFactory(),
          sessionId,
          result.code,
          result.type,
          jsonOrNull(result.freezeFrame),
          at,
          at,
        ],
      );
    }
  }

  async resultsFor(sessionId: string): Promise<ScanResultRow[]> {
    const rows = await this.db.select<ScanResultDbRow>(
      'SELECT * FROM scan_results WHERE session_id = $1 AND deleted_at IS NULL',
      [sessionId],
    );
    return rows.map(mapScanResult);
  }

  async addReadiness(
    sessionId: string,
    phase: ReadinessPhase,
    data: unknown,
  ): Promise<ReadinessSnapshot> {
    const at = this.clock.now();
    const id = this.clock.idFactory();
    await this.db.execute(
      `INSERT INTO readiness_snapshots (
        id, session_id, phase, data_json, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [id, sessionId, phase, JSON.stringify(data), at, at],
    );
    return {
      id,
      sessionId,
      phase,
      data,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
  }

  async readinessFor(sessionId: string): Promise<ReadinessSnapshot[]> {
    const rows = await this.db.select<{
      id: string;
      session_id: string;
      phase: string;
      data_json: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>(
      'SELECT * FROM readiness_snapshots WHERE session_id = $1 AND deleted_at IS NULL ORDER BY created_at',
      [sessionId],
    );
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      phase:
        row.phase === 'before_clear'
          ? 'before_clear'
          : row.phase === 'after_clear'
            ? 'after_clear'
            : 'initial',
      data: parseJson(row.data_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
  }

  async addLiveData(sessionId: string, logs: readonly LiveDataLogInput[]): Promise<void> {
    const at = this.clock.now();
    for (const log of logs) {
      await this.db.execute(
        `INSERT INTO live_data_logs (
          id, session_id, pid, value, unit, ts, created_at, updated_at, deleted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
        [
          this.clock.idFactory(),
          sessionId,
          log.pid,
          log.value ?? null,
          log.unit ?? null,
          log.ts,
          at,
          at,
        ],
      );
    }
  }

  async liveDataFor(sessionId: string): Promise<LiveDataLog[]> {
    const rows = await this.db.select<{
      id: string;
      session_id: string;
      pid: string;
      value: number | null;
      unit: string | null;
      ts: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>('SELECT * FROM live_data_logs WHERE session_id = $1 AND deleted_at IS NULL ORDER BY ts', [
      sessionId,
    ]);
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      pid: row.pid,
      value: row.value === null ? null : Number(row.value),
      unit: row.unit,
      ts: row.ts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
  }
}

/* -------------------------------------------------------------------------- */
/* Settings and remote config                                                  */
/* -------------------------------------------------------------------------- */

interface SettingRow {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapSetting(row: SettingRow): Setting {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SqliteSettingsRepository implements SettingsRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  async get(key: string): Promise<string | null> {
    const [row] = await this.db.select<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1 AND deleted_at IS NULL',
      [key],
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<Setting> {
    const at = this.clock.now();
    await this.db.execute(
      `INSERT INTO settings (id, key, value, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at,
         deleted_at = NULL`,
      [this.clock.idFactory(), key, value, at, at],
    );
    const [row] = await this.db.select<SettingRow>('SELECT * FROM settings WHERE key = $1', [key]);
    if (!row) throw new Error(`Setting ${key} was not readable after writing`);
    return mapSetting(row);
  }

  async delete(key: string): Promise<void> {
    const at = this.clock.now();
    await this.db.execute('UPDATE settings SET deleted_at = $1, updated_at = $1 WHERE key = $2', [
      at,
      key,
    ]);
  }
}

export class SqliteRemoteConfigCacheRepository implements RemoteConfigCacheRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  async latest(): Promise<RemoteConfigCacheEntry | null> {
    const [row] = await this.db.select<{
      id: string;
      json: string;
      signature: string | null;
      fetched_at: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>(
      `SELECT * FROM remote_config_cache
       WHERE deleted_at IS NULL
       ORDER BY fetched_at DESC LIMIT 1`,
    );
    return row
      ? {
          id: row.id,
          json: row.json,
          signature: row.signature,
          fetchedAt: row.fetched_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        }
      : null;
  }

  async save(input: RemoteConfigCacheInput): Promise<RemoteConfigCacheEntry> {
    const at = this.clock.now();
    const id = this.clock.idFactory();
    await this.db.execute(
      `INSERT INTO remote_config_cache (
        id, json, signature, fetched_at, created_at, updated_at, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [id, input.json, input.signature ?? null, input.fetchedAt, at, at],
    );
    return {
      id,
      json: input.json,
      signature: input.signature ?? null,
      fetchedAt: input.fetchedAt,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Scan backups                                                                */
/* -------------------------------------------------------------------------- */

export class SqliteScanBackupRepository implements ScanBackupRepository {
  readonly isDurable = true;
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  async save(backup: ScanBackup): Promise<void> {
    await this.db.execute(
      `INSERT INTO scan_backups (id, session_id, payload_json, created_at, updated_at, deleted_at)
       VALUES ($1, NULL, $2, $3, $4, NULL)
       ON CONFLICT(id) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at,
         deleted_at = NULL`,
      [backup.id, JSON.stringify(backup), backup.createdAt, this.clock.now()],
    );

    // The safety rule is "Mode 04 only after a durable backup". A write that
    // cannot be read back is treated as failed, exactly like localStorage did.
    const [row] = await this.db.select<{ id: string }>(
      'SELECT id FROM scan_backups WHERE id = $1 AND deleted_at IS NULL',
      [backup.id],
    );
    if (!row) throw new Error('The scan backup could not be verified after writing');
  }

  async list(): Promise<ScanBackup[]> {
    const rows = await this.db.select<{ payload_json: string }>(
      `SELECT payload_json FROM scan_backups
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`,
    );
    return rows
      .map((row) => parseJson<ScanBackup>(row.payload_json))
      .filter((backup): backup is ScanBackup => backup !== null);
  }

  async get(id: string): Promise<ScanBackup | null> {
    const [row] = await this.db.select<{ payload_json: string }>(
      'SELECT payload_json FROM scan_backups WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return row ? parseJson<ScanBackup>(row.payload_json) : null;
  }

  async delete(id: string): Promise<void> {
    const at = this.clock.now();
    await this.db.execute(
      'UPDATE scan_backups SET deleted_at = $1, updated_at = $1 WHERE id = $2',
      [at, id],
    );
  }
}

export class SqliteWmiUserMapRepository implements WmiUserMapRepository {
  private readonly db: SqlExecutor;
  private readonly clock: RepositoryClock;

  constructor(db: SqlExecutor, options: SqliteRepositoryOptions = {}) {
    this.db = db;
    this.clock = repositoryClock(options);
  }

  async get(wmi: string): Promise<string | null> {
    const [row] = await this.db.select<{ make_slug: string }>(
      'SELECT make_slug FROM wmi_user_map WHERE wmi = $1 ORDER BY last_used_at DESC, rowid DESC LIMIT 1',
      [wmi.toUpperCase()],
    );
    return row?.make_slug ?? null;
  }

  async getAll(wmi: string): Promise<string[]> {
    const rows = await this.db.select<{ make_slug: string }>(
      'SELECT make_slug FROM wmi_user_map WHERE wmi = $1 ORDER BY last_used_at DESC, rowid DESC',
      [wmi.toUpperCase()],
    );
    return rows.map((r) => r.make_slug);
  }

  async set(wmi: string, makeSlug: string): Promise<void> {
    const at = this.clock.now();
    await this.db.execute(
      `INSERT INTO wmi_user_map (wmi, make_slug, source, created_at, last_used_at)
       VALUES ($1, $2, 'user', $3, $3)
       ON CONFLICT(wmi, make_slug) DO UPDATE SET last_used_at = excluded.last_used_at`,
      [wmi.toUpperCase(), makeSlug, at],
    );
  }

  async list(): Promise<WmiUserMapEntry[]> {
    const rows = await this.db.select<{
      wmi: string;
      make_slug: string;
      source: string;
      created_at: string;
      last_used_at: string;
    }>(
      'SELECT wmi, make_slug, source, created_at, last_used_at FROM wmi_user_map ORDER BY last_used_at DESC, rowid DESC',
    );
    return rows.map((row) => ({
      wmi: row.wmi,
      makeSlug: row.make_slug,
      source: 'user',
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }
}

export function createSqliteRepositories(
  db: SqlExecutor,
  options: SqliteRepositoryOptions = {},
): Repositories {
  return {
    vehicles: new SqliteVehicleRepository(db, options),
    catalog: new SqliteVehicleCatalogRepository(db),
    dtc: new SqliteDtcRepository(db, options),
    scans: new SqliteScanRepository(db, options),
    settings: new SqliteSettingsRepository(db, options),
    remoteConfig: new SqliteRemoteConfigCacheRepository(db, options),
    scanBackups: new SqliteScanBackupRepository(db, options),
    wmiUserMap: new SqliteWmiUserMapRepository(db, options),
  };
}
