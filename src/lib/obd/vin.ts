import type { ObdMessage } from './frames';

export interface VinResult {
  vin: string;
  /** The check digit matches the ISO 3779 check-digit calculation. */
  valid: boolean;
  /** Position 9 is a digit/X (the check digit is only mandatory in some markets). */
  applicable: boolean;
  checkDigit: string;
  expectedCheckDigit: string;
}

const TRANSLITERATION: Readonly<Record<string, number>> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/;
const LOOSE_VIN_PATTERN = /[A-Z0-9]{17}/;

/** ISO 3779 check digit for position 9; `null` when a character is invalid. */
export function computeVinCheckDigit(vin: string): string | null {
  if (vin.length !== 17) return null;

  let sum = 0;
  for (let index = 0; index < 17; index += 1) {
    const char = vin[index] ?? '';
    const value = TRANSLITERATION[char];
    const weight = WEIGHTS[index];
    if (value === undefined || weight === undefined) return null;
    sum += value * weight;
  }

  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/**
 * Extracts the VIN from Mode 09 PID 02 messages.
 *
 * The ECU sends ASCII bytes with optional frame counters and zero padding;
 * bytes below `0x30` (counters, padding) are discarded, then the 17-character
 * VIN pattern is located. `I`, `O` and `Q` are not valid VIN characters.
 */
export function extractVin(messages: readonly ObdMessage[]): string | null {
  let text = '';

  for (const message of messages) {
    if (message.bytes[0] !== 0x49 || message.bytes[1] !== 0x02) continue;
    for (const byte of message.bytes.slice(2)) {
      if (byte >= 0x30 && byte <= 0x5a) {
        text += String.fromCharCode(byte).toUpperCase();
      }
    }
  }

  return VIN_PATTERN.exec(text)?.[0] ?? LOOSE_VIN_PATTERN.exec(text)?.[0] ?? null;
}

export function validateVin(vin: string): VinResult {
  const expectedCheckDigit = computeVinCheckDigit(vin) ?? '';
  const checkDigit = vin[8] ?? '';
  const applicable = /^[0-9X]$/.test(checkDigit);
  return {
    vin,
    valid: applicable && expectedCheckDigit.length > 0 && checkDigit === expectedCheckDigit,
    applicable,
    checkDigit,
    expectedCheckDigit,
  };
}

export function decodeVin(messages: readonly ObdMessage[]): VinResult | null {
  const vin = extractVin(messages);
  return vin ? validateVin(vin) : null;
}
