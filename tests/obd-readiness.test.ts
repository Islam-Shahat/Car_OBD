import { describe, expect, it } from 'vitest';

import { decodeReadinessStatus } from '../src/lib/obd/readiness';

describe('PID 0101 readiness', () => {
  it('decodes the stock emulator answer (MIL off, spark, all complete)', () => {
    const status = decodeReadinessStatus([0x00, 0x07, 0xa1, 0x00]);

    expect(status.mil).toEqual({ on: false, dtcCount: 0 });
    expect(status.ignition).toBe('spark');
    expect(status.monitors.map((monitor) => [monitor.key, monitor.complete])).toEqual([
      ['misfire', true],
      ['fuelSystem', true],
      ['components', true],
      ['egr', true],
      ['evap', true],
      ['catalyst', true],
    ]);
  });

  it('decodes MIL on, the stored-DTC count and incomplete monitors', () => {
    const status = decodeReadinessStatus([0x83, 0x37, 0xa1, 0x30]);

    expect(status.mil).toEqual({ on: true, dtcCount: 3 });
    expect(status.ignition).toBe('spark');
    expect(status.monitors).toEqual([
      { key: 'misfire', complete: false },
      { key: 'fuelSystem', complete: false },
      { key: 'components', complete: true },
      { key: 'egr', complete: true },
      { key: 'evap', complete: false },
      { key: 'catalyst', complete: true },
    ]);
  });

  it('uses the compression-ignition monitor names when bit B3 is set', () => {
    const status = decodeReadinessStatus([0x00, 0x0f, 0x54, 0x00]);

    expect(status.ignition).toBe('compression');
    expect(status.monitors.map((monitor) => monitor.key)).toEqual([
      'misfire',
      'fuelSystem',
      'components',
      'exhaustGasSensor',
      'boostPressure',
      'noxScr',
    ]);
  });

  it('rejects a truncated readiness payload', () => {
    expect(() => decodeReadinessStatus([0x00, 0x07, 0xa1])).toThrowError(
      expect.objectContaining({ code: 'malformed-response' }),
    );
  });
});
