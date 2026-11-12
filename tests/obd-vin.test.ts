import { describe, expect, it } from 'vitest';

import { decodeMessages } from '../src/lib/obd/frames';
import { computeVinCheckDigit, decodeVin, extractVin, validateVin } from '../src/lib/obd/vin';

const VIN_LINES = [
  '014',
  '0: 49 02 01 57 50 30',
  '1: 5A 5A 5A 39 39 5A 54',
  '2: 53 33 39 30 30 30 30',
];

describe('VIN extraction', () => {
  it('reassembles a multi-frame Mode 09 PID 02 answer', () => {
    const messages = decodeMessages(VIN_LINES);
    expect(extractVin(messages)).toBe('WP0ZZZ99ZTS390000');
  });

  it('ignores zero padding and frame counters', () => {
    const messages = decodeMessages([
      '0: 49 02 01 31 4D 38 47',
      '1: 44 4D 39 41 58 4B 50',
      '2: 30 34 32 37 38 38 00',
    ]);
    expect(extractVin(messages)).toBe('1M8GDM9AXKP042788');
  });

  it('returns null when the response has no VIN', () => {
    expect(decodeVin(decodeMessages(['0: 49 01 01']))).toBeNull();
    expect(extractVin(decodeMessages(['410C1AF8']))).toBeNull();
  });
});

describe('VIN checksum', () => {
  it('computes the ISO 3779 check digit', () => {
    expect(computeVinCheckDigit('1M8GDM9AXKP042788')).toBe('X');
    expect(computeVinCheckDigit('WP0ZZZ99ZTS390000')).toBe('2');
  });

  it('accepts a valid North-American VIN', () => {
    expect(validateVin('1M8GDM9AXKP042788')).toMatchObject({
      valid: true,
      applicable: true,
      checkDigit: 'X',
      expectedCheckDigit: 'X',
    });
  });

  it('flags a wrong numeric check digit', () => {
    expect(validateVin('1M8GDM9A2KP042788')).toMatchObject({
      valid: false,
      applicable: true,
      checkDigit: '2',
      expectedCheckDigit: 'X',
    });
  });

  it('does not treat a non-numeric position 9 as a checksum failure', () => {
    expect(validateVin('WP0ZZZ99ZTS390000')).toMatchObject({
      valid: false,
      applicable: false,
      checkDigit: 'Z',
      expectedCheckDigit: '2',
    });
  });

  it('returns null for an invalid length or characters', () => {
    expect(computeVinCheckDigit('SHORT')).toBeNull();
    expect(computeVinCheckDigit('1M8GDM9AIKP042788')).toBeNull();
  });
});
