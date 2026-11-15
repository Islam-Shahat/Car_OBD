import type { AdapterInfo } from '../elm327/driver';
import type { DtcCategory } from '../obd/dtc';
import type { MilStatus } from '../obd/readiness';
import type { FreezeFrame } from '../obd/scanTypes';

/** Columns shared by every table: UUID id plus soft-delete timestamps. */
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Vehicle extends Entity {
  /** Catalog entry the user picked, or null for a free-text car. */
  catalogId: string | null;
  /** Canonical make from the catalog, when available. */
  make: string | null;
  /** Canonical model from the catalog, when available. */
  model: string | null;
  year: number | null;
  engine: string | null;
  vin: string | null;
  notes: string | null;
  /** Free text, kept so a car outside the catalog is still a normal vehicle. */
  makeText: string | null;
  modelText: string | null;
}

export interface VehicleInput {
  catalogId?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
  vin?: string | null;
  notes?: string | null;
  makeText?: string | null;
  modelText?: string | null;
}

export type VehicleUpdate = VehicleInput;

export type SourceTier = 'cited' | 'knowledge';

export interface CatalogEntry extends Entity {
  make: string;
  makeSlug: string;
  model: string;
  /** Common Arabic spellings of the make, shared by its models. */
  makeAliasesAr: string[];
  aliasesAr: string[];
  aliasesEn: string[];
  yearFrom: number | null;
  yearTo: number | null;
  bodyType: string | null;
  sourceTier: SourceTier;
  verified: boolean;
}

export interface CatalogMake {
  make: string;
  makeSlug: string;
  count: number;
  aliasesAr: string[];
}

export type { DtcCategory };
export type TranslationTier = 1 | 2 | 3;

/**
 * Severity is an estimate derived from the upstream record flags (limp mode,
 * MIL), not a safety rating and not a manufacturer statement.
 */
export type SeveritySource = 'heuristic';

export interface DtcCode extends Entity {
  code: string;
  /** Normalized make slug; `null` means the generic SAE J2012 row. */
  make: string | null;
  descriptionAr: string;
  descriptionEn: string;
  severity: string | null;
  severitySource: SeveritySource;
  possibleCausesAr: string[];
  possibleCausesEn: string[];
  inspectionStepsAr: string[];
  inspectionStepsEn: string[];
  source: string;
  sourceVersion: string;
  translationTier: TranslationTier;
  needsReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface DtcLookup {
  kind: 'specific' | 'generic' | 'unknown';
  code: string;
  category: DtcCategory;
  record: DtcCode | null;
}

export interface DtcCounts {
  total: number;
  tier1: number;
  tier2: number;
  needsReview: number;
}

export type ScanMode = 'normal' | 'pre_purchase';
export type ScanResultType = 'stored' | 'pending' | 'permanent';
export type ReadinessPhase = 'before_clear' | 'after_clear' | 'initial';

export interface ScanSession extends Entity {
  vehicleId: string | null;
  startedAt: string;
  finishedAt: string | null;
  protocol: string | null;
  adapterInfo: AdapterInfo | null;
  milStatus: MilStatus | null;
  overallStatus: string | null;
  mode: ScanMode;
}

export interface ScanSessionInput {
  vehicleId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  protocol?: string | null;
  adapterInfo?: AdapterInfo | null;
  milStatus?: MilStatus | null;
  overallStatus?: string | null;
  mode?: ScanMode;
}

export interface ScanSessionUpdate {
  finishedAt?: string | null;
  protocol?: string | null;
  adapterInfo?: AdapterInfo | null;
  milStatus?: MilStatus | null;
  overallStatus?: string | null;
  vehicleId?: string | null;
  mode?: ScanMode;
}

export interface ScanResultRow extends Entity {
  sessionId: string;
  code: string;
  type: ScanResultType;
  freezeFrame: FreezeFrame | null;
}

export interface ScanResultInput {
  code: string;
  type: ScanResultType;
  freezeFrame?: FreezeFrame | null;
}

export interface ReadinessSnapshot extends Entity {
  sessionId: string;
  phase: ReadinessPhase;
  data: unknown;
}

export interface LiveDataLog extends Entity {
  sessionId: string;
  pid: string;
  value: number | null;
  unit: string | null;
  ts: string;
}

export interface LiveDataLogInput {
  pid: string;
  value?: number | null;
  unit?: string | null;
  ts: string;
}

export interface Setting extends Entity {
  key: string;
  value: string;
}

export interface RemoteConfigCacheEntry extends Entity {
  json: string;
  signature: string | null;
  fetchedAt: string;
}

export interface RemoteConfigCacheInput {
  json: string;
  signature?: string | null;
  fetchedAt: string;
}
