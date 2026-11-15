/* eslint-disable @typescript-eslint/require-await */
import catalogData from '../../data/vehicle-catalog.json';
import { createInMemoryRepositories } from './inMemoryRepositories';
import { migrate } from './migrations';
import type { Repositories } from './repositories';
import { seedDatabase, type CatalogSeedEntry, type SeedOptions, type SeedResult } from './seed';
import { createSqliteRepositories } from './sqliteRepositories';
import {
  browserKeyValueStore,
  migrateLegacyBackups,
  type LegacyMigrationResult,
} from './legacyBackups';
import type { SqlExecutor } from './sql';
import { TauriSqlExecutor } from './tauriSql';
import type { CatalogEntry, DtcCode } from './types';

/** SQLite file created under Tauri's app-data directory. */
export const DATABASE_PATH = 'sqlite:obd-diagnose.db';

export interface Storage {
  db: SqlExecutor;
  repositories: Repositories;
  seed: SeedResult;
  legacy: LegacyMigrationResult;
  isInMemory?: boolean;
}

export interface OpenStorageOptions {
  seed?: SeedOptions;
  legacyStore?: ReturnType<typeof browserKeyValueStore>;
  migrateLegacy?: boolean;
}

export interface OpenTauriStorageOptions {
  allowDevFallback?: boolean;
}

/**
 * Returns true if running within Tauri (has a functional Tauri IPC bridge).
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
    };
    isTauri?: boolean;
    __TAURI__?: unknown;
  };
  return typeof win.__TAURI_INTERNALS__?.invoke === 'function';
}

/**
 * Returns true if running in development browser preview (outside Tauri).
 */
export function isDevPreview(): boolean {
  return !isTauriEnvironment() && !import.meta.env?.PROD;
}

const SAMPLE_PREVIEW_DTC_CODES: DtcCode[] = [
  {
    id: 'dtc-p0133',
    code: 'P0133',
    make: null,
    descriptionEn: 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)',
    descriptionAr: 'استجابة بطيئة في دائرة حساس الأكسجين (صف 1، حساس 1)',
    severity: 'medium',
    severitySource: 'heuristic',
    possibleCausesEn: ['Defective O2 sensor', 'Exhaust leak', 'Wiring issue'],
    possibleCausesAr: ['تلف حساس الأكسجين', 'تسريب في العادم', 'مشكلة في التوصيلات الكهربائية'],
    inspectionStepsEn: [
      'Inspect wiring to O2 sensor',
      'Check for exhaust leaks ahead of sensor',
      'Replace O2 sensor if unresponsive',
    ],
    inspectionStepsAr: [
      'فحص الأسلاك المتصلة بحساس الأكسجين',
      'التأكد من عدم وجود تسريب في العادم قبل الحساس',
      'استبدال حساس الأكسجين إذا لم يستجب',
    ],
    source: 'OBDex',
    sourceVersion: '1.0',
    translationTier: 1,
    needsReview: true,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'dtc-p0300',
    code: 'P0300',
    make: null,
    descriptionEn: 'Random/Multiple Cylinder Misfire Detected',
    descriptionAr: 'رصد احتراق غير منتظم عشوائي أو في عدة أسطوانات',
    severity: 'high',
    severitySource: 'heuristic',
    possibleCausesEn: ['Faulty spark plugs or ignition coils', 'Low fuel pressure', 'Vacuum leak'],
    possibleCausesAr: [
      'تلف شمعات الاحتراق (البواجي) أو الكويلات',
      'انخفاض ضغط الوقود',
      'تسريب في سحب الهواء (فاكيوم)',
    ],
    inspectionStepsEn: [
      'Check spark plugs and coils',
      'Inspect intake manifold for vacuum leaks',
      'Verify fuel pressure',
    ],
    inspectionStepsAr: [
      'فحص البواجي والكويلات',
      'فحص مجمع السحب بحثاً عن تسريب فاكيوم',
      'التأكد من ضغط الوقود',
    ],
    source: 'OBDex',
    sourceVersion: '1.0',
    translationTier: 1,
    needsReview: true,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'dtc-p0420',
    code: 'P0420',
    make: null,
    descriptionEn: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    descriptionAr: 'كفاءة نظام المحول الحفاز (دبة التلوث) أقل من الحد المسموح (صف 1)',
    severity: 'medium',
    severitySource: 'heuristic',
    possibleCausesEn: ['Damaged catalytic converter', 'Exhaust leak', 'Faulty rear O2 sensor'],
    possibleCausesAr: [
      'تلف علبة البيئة / المحول الحفاز',
      'تسريب في نظام العادم',
      'عطل بحساس الأكسجين الخلفي',
    ],
    inspectionStepsEn: [
      'Inspect exhaust for leaks',
      'Check rear O2 sensor operation',
      'Inspect catalytic converter for degradation',
    ],
    inspectionStepsAr: [
      'فحص العادم بحثاً عن تسريب',
      'مراقبة عمل حساس الأكسجين الخلفي',
      'فحص المحول الحفاز والتأكد من سلامته',
    ],
    source: 'OBDex',
    sourceVersion: '1.0',
    translationTier: 1,
    needsReview: true,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    deletedAt: null,
  },
];

/**
 * Creates in-memory storage for browser preview mode, seeded with the full vehicle catalog.
 */
export async function openBrowserStorage(): Promise<Storage> {
  const now = new Date().toISOString();
  const catalogEntries: CatalogEntry[] = (
    (catalogData as unknown as { entries: CatalogSeedEntry[] }).entries ?? []
  ).map((entry, index) => ({
    id: entry.id ?? `catalog-${index + 1}`,
    make: entry.make,
    makeSlug: entry.makeSlug,
    model: entry.model,
    makeAliasesAr: entry.makeAliasesAr ?? [],
    aliasesAr: entry.aliasesAr ?? [],
    aliasesEn: entry.aliasesEn ?? [],
    yearFrom: entry.yearFrom ?? null,
    yearTo: entry.yearTo ?? null,
    bodyType: entry.bodyType ?? null,
    sourceTier: entry.sourceTier ?? 'cited',
    verified: Boolean(entry.verified),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  const repositories = createInMemoryRepositories({
    catalog: catalogEntries,
    dtc: SAMPLE_PREVIEW_DTC_CODES,
  });

  const dummyDb: SqlExecutor = {
    async execute() {
      return { rowsAffected: 0 };
    },
    async select<T>() {
      return [] as T[];
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      return work();
    },
  };

  return {
    db: dummyDb,
    repositories,
    seed: {
      dtcInserted: true,
      catalogInserted: true,
      dtcCount: SAMPLE_PREVIEW_DTC_CODES.length,
      catalogCount: catalogEntries.length,
    },
    legacy: { migrated: 0, skipped: 0, error: null },
    isInMemory: true,
  };
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

/**
 * Opens SQLite through the Tauri SQL plugin.
 * In development preview (outside Tauri), falls back to in-memory browser storage.
 * In a production build outside Tauri, throws an error so the real error screen is displayed.
 */
export async function openTauriStorage(options: OpenTauriStorageOptions = {}): Promise<Storage> {
  const allowFallback = options.allowDevFallback ?? isDevPreview();

  if (!isTauriEnvironment()) {
    if (allowFallback) {
      return openBrowserStorage();
    }
    throw new Error(
      'Tauri IPC bridge is unavailable in production build. Real SQLite storage is required.',
    );
  }

  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const database = await Database.load(DATABASE_PATH);
  return openStorage(new TauriSqlExecutor(database));
}
