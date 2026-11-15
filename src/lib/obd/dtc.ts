export type DtcMode = 3 | 7 | 10;
export type DtcSystem = 'P' | 'C' | 'B' | 'U';
export type DtcCategory = 'powertrain' | 'body' | 'chassis' | 'network';

export interface Dtc {
  /** SAE J2012 display form, e.g. `P0133`. */
  code: string;
  system: DtcSystem;
  bytes: readonly [number, number];
  /** Two encoded bytes as hex, e.g. `0133`. */
  raw: string;
  /** CAN identifier of the ECU that reported the code, when headers were on. */
  ecuId?: string;
}

export const DTC_MODE_REQUEST: Readonly<Record<DtcMode, string>> = {
  3: '03',
  7: '07',
  10: '0A',
};

export const DTC_MODE_RESPONSE: Readonly<Record<DtcMode, number>> = {
  3: 0x43,
  7: 0x47,
  10: 0x4a,
};

const SYSTEM_BY_BITS: readonly DtcSystem[] = ['P', 'C', 'B', 'U'];

function toHexByte(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

/** Decodes the two SAE J2012 bytes of one diagnostic trouble code. */
export function decodeDtcPair(first: number, second: number): Dtc {
  const firstByte = first & 0xff;
  const secondByte = second & 0xff;
  const system = SYSTEM_BY_BITS[(firstByte >> 6) & 0x03] ?? 'P';
  const firstDigit = (firstByte >> 4) & 0x03;
  const secondDigit = firstByte & 0x0f;

  return {
    code: `${system}${firstDigit}${secondDigit.toString(16).toUpperCase()}${toHexByte(secondByte)}`,
    system,
    bytes: [firstByte, secondByte],
    raw: `${toHexByte(firstByte)}${toHexByte(secondByte)}`,
  };
}

export function isZeroDtc(dtc: Dtc): boolean {
  return dtc.bytes[0] === 0 && dtc.bytes[1] === 0;
}

/**
 * Decodes the payload that follows the positive service byte.
 *
 * CAN/ISO 15765 answers contain only DTC pairs (padded with `00 00`), while
 * ISO 9141/14230 answers prefix the number of DTCs. The odd total length is
 * the discriminator: a count byte makes the payload odd-length, DTC pairs are
 * even-length. Zero padding is dropped.
 */
export function decodeDtcPayload(payload: readonly number[]): Dtc[] {
  if (payload.length === 0) return [];

  const body = payload.length % 2 === 1 ? payload.slice(1) : payload;
  const codes: Dtc[] = [];

  for (let offset = 0; offset + 1 < body.length; offset += 2) {
    const dtc = decodeDtcPair(body[offset] ?? 0, body[offset + 1] ?? 0);
    if (!isZeroDtc(dtc)) {
      codes.push(dtc);
    }
  }

  return codes;
}

/** Normalizes user/ECU input to the SAE display form used by every table. */
export function normalizeDtcCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** P = powertrain, B = body, C = chassis, U = network. */
export function dtcCategory(code: string): DtcCategory {
  switch (normalizeDtcCode(code)[0]) {
    case 'B':
      return 'body';
    case 'C':
      return 'chassis';
    case 'U':
      return 'network';
    default:
      return 'powertrain';
  }
}

/** Keeps the first occurrence of each code (several ECUs can report the same DTC). */
export function uniqueDtcs(codes: readonly Dtc[]): Dtc[] {
  const seen = new Set<string>();
  const unique: Dtc[] = [];
  for (const code of codes) {
    if (seen.has(code.code)) continue;
    seen.add(code.code);
    unique.push(code);
  }
  return unique;
}
