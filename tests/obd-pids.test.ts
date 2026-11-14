import { describe, expect, it } from 'vitest';

import {
  CORE_PID_IDS,
  decodePid,
  decodeSupportedPidGroup,
  DRIVE_HISTORY_PIDS,
  emptyDriveHistory,
  type PidMeasurement,
} from '../src/lib/obd/pids';

function first(pid: number, data: readonly number[]): PidMeasurement {
  const measurement = decodePid(pid, data).measurements[0];
  if (!measurement) throw new Error(`PID ${pid} returned no measurement`);
  return measurement;
}

describe('Mode 01 PID decoding', () => {
  it('decodes engine load', () => {
    expect(first(0x04, [0xff]).value).toBeCloseTo(100);
    expect(first(0x04, [0x00]).value).toBe(0);
  });

  it('decodes coolant, intake, ambient and oil temperatures', () => {
    expect(first(0x05, [0x5f]).value).toBe(55);
    expect(first(0x0f, [0x39]).value).toBe(17);
    expect(first(0x46, [0x43]).value).toBe(27);
    expect(first(0x5c, [0x43]).value).toBe(27);
  });

  it('decodes fuel trims with the -100%..+99.2% scale', () => {
    expect(first(0x06, [0x80]).value).toBe(0);
    expect(first(0x06, [0xff]).value).toBeCloseTo(99.21875);
    expect(first(0x06, [0x00]).value).toBe(-100);
    expect(first(0x06, [0x80]).labelParams).toEqual({ bank: 1 });
    expect(first(0x08, [0x80]).labelParams).toEqual({ bank: 2 });
    expect(first(0x07, [0x80]).labelKey).toBe('scan.pids.longFuelTrim');
    expect(first(0x09, [0x40]).value).toBeCloseTo(-50);
    expect(first(0x09, [0x40]).labelParams).toEqual({ bank: 2 });
  });

  it('decodes RPM and vehicle speed', () => {
    expect(first(0x0c, [0x1a, 0xf8]).value).toBe(1726);
    expect(first(0x0c, [0x00, 0x00]).value).toBe(0);
    expect(first(0x0d, [0x0a]).value).toBe(10);
  });

  it('decodes MAF and throttle position', () => {
    expect(first(0x10, [0x18, 0x1f]).value).toBeCloseTo(61.75);
    expect(first(0x11, [0x2b]).value).toBeCloseTo(16.8627, 3);
  });

  it('decodes O2 sensor voltage and trim', () => {
    const readings = decodePid(0x14, [0xaa, 0x80]).measurements;
    expect(readings).toHaveLength(2);
    expect(readings[0]?.value).toBeCloseTo(0.85);
    expect(readings[0]?.unit).toBe('volts');
    expect(readings[0]?.labelParams).toEqual({ bank: 1, sensor: 1 });
    expect(readings[1]?.value).toBe(0);
    expect(readings[1]?.unit).toBe('percent');

    const bank2 = decodePid(0x1b, [0x64, 0x90]).measurements;
    expect(bank2[0]?.labelParams).toEqual({ bank: 2, sensor: 4 });
    expect(bank2[0]?.value).toBeCloseTo(0.5);
    expect(bank2[1]?.value).toBeCloseTo(12.5);
  });

  it('decodes fuel level', () => {
    expect(first(0x2f, [0xaa]).value).toBeCloseTo(66.6667, 3);
  });

  it('decodes control-module voltage', () => {
    expect(first(0x42, [0x39, 0x4b]).value).toBeCloseTo(14.667);
  });

  it('rejects truncated data and unknown PIDs', () => {
    expect(() => decodePid(0x0c, [0x1a])).toThrowError(
      expect.objectContaining({ code: 'malformed-response' }),
    );
    expect(() => decodePid(0x99, [0x00])).toThrowError(
      expect.objectContaining({ code: 'malformed-response' }),
    );
  });

  it('decodes all eight oxygen-sensor PIDs with the shared formula', () => {
    const fixtures = [
      [0x14, 1, 1],
      [0x15, 1, 2],
      [0x16, 1, 3],
      [0x17, 1, 4],
      [0x18, 2, 1],
      [0x19, 2, 2],
      [0x1a, 2, 3],
      [0x1b, 2, 4],
    ] as const;

    for (const [pid, bank, sensor] of fixtures) {
      const [voltage, trim] = decodePid(pid, [0x80, 0xa0]).measurements;
      expect(voltage).toMatchObject({
        value: 0.64,
        unit: 'volts',
        labelParams: { bank, sensor },
      });
      expect(trim).toMatchObject({ value: 25, unit: 'percent', labelParams: { bank, sensor } });
    }
  });

  it('covers every core PID with at least one measurement', () => {
    const samples: Record<number, number[]> = {
      0x04: [0xff],
      0x05: [0x5f],
      0x06: [0x80],
      0x07: [0x80],
      0x08: [0x80],
      0x09: [0x80],
      0x0c: [0x1a, 0xf8],
      0x0d: [0x0a],
      0x0f: [0x39],
      0x10: [0x18, 0x1f],
      0x11: [0x2b],
      0x14: [0xaa, 0x80],
      0x15: [0xaa, 0x80],
      0x16: [0xaa, 0x80],
      0x17: [0xaa, 0x80],
      0x18: [0xaa, 0x80],
      0x19: [0xaa, 0x80],
      0x1a: [0xaa, 0x80],
      0x1b: [0xaa, 0x80],
      0x2f: [0xaa],
      0x42: [0x39, 0x4b],
      0x46: [0x43],
      0x5c: [0x43],
    };

    expect(new Set(CORE_PID_IDS)).toEqual(new Set(Object.keys(samples).map(Number)));
    for (const pid of CORE_PID_IDS) {
      const data = samples[pid];
      expect(data, `sample for PID 0x${pid.toString(16)}`).toBeDefined();
      expect(decodePid(pid, data ?? []).measurements.length).toBeGreaterThan(0);
    }
  });
});

describe('drive-history PIDs', () => {
  it('decodes run time and distance values', () => {
    expect(first(0x1f, [0x0e, 0x10]).value).toBe(3600);
    expect(first(0x21, [0x00, 0x64]).value).toBe(100);
    expect(first(0x31, [0x00, 0xc8]).value).toBe(200);
  });

  it('decodes warm-ups and time counters', () => {
    expect(first(0x30, [0x05]).value).toBe(5);
    expect(first(0x4d, [0x00, 0x1e]).value).toBe(30);
    expect(first(0x4e, [0x00, 0x64]).value).toBe(100);
  });

  it('uses the right units and nulls for unsupported values', () => {
    expect(first(0x1f, [0x0e, 0x10])).toMatchObject({
      labelKey: 'scan.pids.runTime',
      unit: 'seconds',
    });
    expect(first(0x21, [0x00, 0x64])).toMatchObject({
      labelKey: 'scan.pids.distanceWithMil',
      unit: 'km',
    });
    expect(first(0x30, [0x05])).toMatchObject({
      labelKey: 'scan.pids.warmupsSinceCleared',
      unit: 'count',
    });
    expect(first(0x4d, [0x00, 0x1e])).toMatchObject({
      labelKey: 'scan.pids.timeWithMil',
      unit: 'minutes',
    });
    expect(emptyDriveHistory()).toEqual({
      runTimeSeconds: null,
      distanceWithMilKm: null,
      warmupsSinceCleared: null,
      distanceSinceClearedKm: null,
      timeWithMilMinutes: null,
      timeSinceClearedMinutes: null,
    });
  });

  it('maps every drive-history field to its PID', () => {
    expect(DRIVE_HISTORY_PIDS).toEqual([
      { key: 'runTimeSeconds', pid: 0x1f },
      { key: 'distanceWithMilKm', pid: 0x21 },
      { key: 'warmupsSinceCleared', pid: 0x30 },
      { key: 'distanceSinceClearedKm', pid: 0x31 },
      { key: 'timeWithMilMinutes', pid: 0x4d },
      { key: 'timeSinceClearedMinutes', pid: 0x4e },
    ]);
  });
});

describe('supported-PID bitmaps', () => {
  it('decodes the stock ELM327-emulator 0100 bitmap', () => {
    const group = decodeSupportedPidGroup(0x00, [0xbe, 0x3f, 0xa8, 0x13]);
    expect(group.pids).toEqual([
      0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x13, 0x15,
      0x1c, 0x1f, 0x20,
    ]);
    expect(group.next).toBe(true);
  });

  it('decodes the 0120 group', () => {
    const group = decodeSupportedPidGroup(0x20, [0x90, 0x1f, 0xf0, 0x15]);
    expect(group.pids).toEqual([
      0x21, 0x24, 0x2c, 0x2d, 0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x3c, 0x3e, 0x40,
    ]);
    expect(group.next).toBe(true);
  });

  it('decodes the 0140 group and stops when the next bit is clear', () => {
    const group = decodeSupportedPidGroup(0x40, [0x7a, 0x1c, 0x80, 0x21]);
    expect(group.pids).toEqual([0x42, 0x43, 0x44, 0x45, 0x47, 0x4c, 0x4d, 0x4e, 0x51, 0x5b, 0x60]);
    expect(group.next).toBe(true);

    const last = decodeSupportedPidGroup(0x60, [0x00, 0x00, 0x00, 0x00]);
    expect(last.pids).toEqual([]);
    expect(last.next).toBe(false);
  });

  it('rejects a truncated bitmap', () => {
    expect(() => decodeSupportedPidGroup(0x00, [0xbe, 0x3f])).toThrowError(
      expect.objectContaining({ code: 'malformed-response' }),
    );
  });
});
