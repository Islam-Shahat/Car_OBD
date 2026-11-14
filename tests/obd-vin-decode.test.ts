import { describe, expect, it } from 'vitest';

import makes from '../src/data/makes.json';
import wmiData from '../src/data/wmi.json';
import { decodeVehicleIdentity, normalizeVin, vinYearCandidates } from '../src/lib/obd/vinDecode';

describe('VIN identity decoding', () => {
  it('decodes the emulator VIN to Porsche with both model-year candidates', () => {
    expect(decodeVehicleIdentity('WP0ZZZ99ZTS390000')).toMatchObject({
      vin: 'WP0ZZZ99ZTS390000',
      wmi: 'WP0',
      manufacturerName: 'DR. ING. H.C.F. PORSCHE AG',
      makeSlug: 'porsche',
      yearCandidates: [1996, 2026],
      applicable: false,
      valid: false,
    });
  });

  it('accepts a valid North-American VIN with a numeric check digit', () => {
    expect(decodeVehicleIdentity('1HGCM82633A004352')).toMatchObject({
      wmi: '1HG',
      manufacturerName: 'AMERICAN HONDA MOTOR CO., INC.',
      makeSlug: 'honda',
      yearCandidates: [2003, 2033],
      applicable: true,
      valid: true,
      checkDigit: '3',
    });
  });

  it('does not treat a letter in position 9 as a checksum failure', () => {
    const identity = decodeVehicleIdentity('KMHDU46DZ8U123456');
    expect(identity).toMatchObject({
      wmi: 'KMH',
      makeSlug: 'hyundai',
      applicable: false,
      valid: false,
      checkDigit: 'Z',
    });
  });

  it('normalises lowercase and surrounding spaces', () => {
    expect(normalizeVin(' kmhdu46dz8u123456 ')).toBe('KMHDU46DZ8U123456');
    expect(decodeVehicleIdentity(' wp0zzz99zts390000 ')?.vin).toBe('WP0ZZZ99ZTS390000');
  });

  it('rejects the forbidden VIN letters I, O and Q', () => {
    expect(decodeVehicleIdentity('1HGCM826I3A004352')).toBeNull();
    expect(decodeVehicleIdentity('1HGCM826O3A004352')).toBeNull();
    expect(decodeVehicleIdentity('1HGCM826Q3A004352')).toBeNull();
  });

  it('rejects the wrong length and invalid characters', () => {
    expect(decodeVehicleIdentity('WP0ZZZ99ZTS39000')).toBeNull();
    expect(decodeVehicleIdentity('WP0ZZZ99ZTS3900000')).toBeNull();
    expect(decodeVehicleIdentity('WP0-ZZZ-99ZTS390000')).toBeNull();
  });

  it('lists year candidates for letters and digits instead of guessing one year', () => {
    expect(vinYearCandidates('T')).toEqual([1996, 2026]);
    expect(vinYearCandidates('A')).toEqual([1980, 2010]);
    expect(vinYearCandidates('Y')).toEqual([2000, 2030]);
    expect(vinYearCandidates('3')).toEqual([2003, 2033]);
    expect(vinYearCandidates('9')).toEqual([2009, 2039]);
    expect(vinYearCandidates('-')).toEqual([]);
  });

  it('returns null manufacturer and make for a verified-unknown WMI', () => {
    expect(decodeVehicleIdentity('9ZZZZZ99ZTS390000')).toMatchObject({
      wmi: '9ZZ',
      manufacturerName: null,
      makeSlug: null,
      yearCandidates: [1996, 2026],
    });
  });
});

describe('bundled WMI data', () => {
  const makesSet = new Set<string>(makes);

  it('only maps WMIs to canonical make slugs from makes.json', () => {
    const bad = Object.entries(wmiData.entries)
      .filter(([, record]) => record.makeSlug !== null && !makesSet.has(record.makeSlug))
      .map(([wmi]) => wmi);
    expect(bad).toEqual([]);
  });

  it('records the dataset source, licence and retrieval date', () => {
    expect(wmiData.source).toContain('NHTSA');
    expect(wmiData.license).toMatch(/public domain/i);
    expect(wmiData.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(wmiData.entries).length).toBeGreaterThan(200);
  });
});
