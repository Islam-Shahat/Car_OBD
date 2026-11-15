import manifest from '../../data/dtc-pack.manifest.json';

/**
 * The DTC knowledge base is a static asset, not part of the JavaScript bundle:
 * the 4.5 MB pack is fetched only when the database needs seeding, then the
 * parsed rows are inserted and released. `dtc-pack.manifest.json` is tiny and
 * stays in the bundle so a normal start can decide without downloading.
 */
export interface DtcSeedCode {
  code: string;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: string | null;
  /** Present since Phase 4.5; older packs are rejected as incomplete. */
  severitySource: 'heuristic';
  causesEn: string[];
  causesAr: string[];
  stepsEn: string[];
  stepsAr: string[];
  tier: 1 | 2 | 3;
  needsReview: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface DtcSeedFile {
  /** Content hash; changes whenever any row changes. */
  version: string;
  source: string;
  sourceVersion: string;
  generatedAt: string;
  license?: string;
  codes: DtcSeedCode[];
}

export type DtcPackLoader = () => Promise<DtcSeedFile>;

export const DTC_PACK_URL = `${import.meta.env.BASE_URL}dtc-pack.json`;

/** Reads the shipped pack and proves it matches the manifest before use. */
export async function loadDtcPack(): Promise<DtcSeedFile> {
  const response = await fetch(DTC_PACK_URL);
  if (!response.ok) {
    throw new Error(`The DTC pack could not be loaded (HTTP ${response.status})`);
  }

  const pack = (await response.json()) as DtcSeedFile;
  if (!Array.isArray(pack.codes)) throw new Error('The DTC pack has no codes');
  if (pack.version !== manifest.version || pack.codes.length !== manifest.codeCount) {
    throw new Error('The DTC pack does not match its manifest; refusing to seed');
  }
  return pack;
}
