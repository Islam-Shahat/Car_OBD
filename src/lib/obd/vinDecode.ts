import wmiData from '../../data/wmi.json';
import { validateVin, type VinResult } from './vin';

interface WmiRecord {
  manufacturerName: string;
  makeSlug: string | null;
}

/** Decoded identity of a 17-character VIN. Model is deliberately not inferred. */
export interface VehicleIdentity extends VinResult {
  /** World Manufacturer Identifier, the first three characters. */
  wmi: string;
  /** Manufacturer name exactly as recorded by the WMI dataset, when known. */
  manufacturerName: string | null;
  /** Canonical make slug shared with the Phase 4 vehicle catalog, when known. */
  makeSlug: string | null;
  /**
   * Model years encoded by position 10. A code repeats every 30 years, so this
   * is a list, never a single guess (T can mean 1996 or 2026).
   */
  yearCandidates: number[];
}

const YEAR_LETTERS = 'ABCDEFGHJKLMNPRSTVWXY';
const YEAR_DIGITS = '123456789';
const VALID_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const WMI_ENTRIES: Readonly<Record<string, WmiRecord>> = wmiData.entries;

/**
 * Candidate WMIs from public lists (NOT VERIFIED):
 * - LVV: Chery
 * - LSJ: SAIC MG
 * - LS5: Changan
 * - LGW: Great Wall / Haval
 * - LNB: BAIC
 * - LVT: Chery group (Chery, Exeed, Jetour, Soueast)
 *
 * Strict policy: Add one to wmi.json only after the owner confirms it against
 * a real VIN plate or two independent sources, and record where it was verified.
 * Never add a WMI to wmi.json without that record.
 * Runtime user assignments are saved locally to the SQLite `wmi_user_map` table.
 */
export const CANDIDATE_UNVERIFIED_WMIS: Readonly<Record<string, string>> = {
  LVV: 'chery',
  LSJ: 'mg',
  LS5: 'changan',
  LGW: 'haval',
  LNB: 'baic',
  LVT: 'chery',
};

/** Uppercases and removes spaces/tabs, as VIN printers and some ECUs add them. */
export function normalizeVin(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/** Model-year candidates for VIN position 10; empty when the character is not a year code. */
export function vinYearCandidates(position10: string): number[] {
  const code = position10.toUpperCase();

  const letterIndex = YEAR_LETTERS.indexOf(code);
  if (letterIndex >= 0) return [1980 + letterIndex, 2010 + letterIndex];

  const digitIndex = YEAR_DIGITS.indexOf(code);
  if (digitIndex >= 0) return [2001 + digitIndex, 2031 + digitIndex];

  return [];
}

/**
 * Decodes WMI and model-year candidates. Returns `null` for a VIN with the
 * wrong length or with I/O/Q, which are not valid VIN characters. Unknown WMIs
 * are not an error: manufacturer/make are simply `null` unless supplied via `userMakeSlug`.
 */
export function decodeVehicleIdentity(
  input: string,
  userMakeSlug?: string | null,
): VehicleIdentity | null {
  const vin = normalizeVin(input);
  if (!VALID_VIN.test(vin)) return null;

  const wmi = vin.slice(0, 3);
  const record = WMI_ENTRIES[wmi];

  const makeSlug = record?.makeSlug ?? userMakeSlug ?? null;
  const manufacturerName =
    record?.manufacturerName ?? (userMakeSlug ? userMakeSlug.toUpperCase() : null);

  return {
    ...validateVin(vin),
    wmi,
    manufacturerName,
    makeSlug,
    yearCandidates: vinYearCandidates(vin[9] ?? ''),
  };
}
