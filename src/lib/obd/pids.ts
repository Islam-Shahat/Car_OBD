import { ObdError } from './errors';

export type PidUnit = 'percent' | 'rpm' | 'kmh' | 'celsius' | 'gps' | 'volts';

/** i18n keys of the measurement labels; keeps `t()` calls type-checked. */
export type PidLabelKey =
  | 'scan.pids.engineLoad'
  | 'scan.pids.coolantTemp'
  | 'scan.pids.shortFuelTrim'
  | 'scan.pids.longFuelTrim'
  | 'scan.pids.rpm'
  | 'scan.pids.speed'
  | 'scan.pids.intakeTemp'
  | 'scan.pids.maf'
  | 'scan.pids.throttle'
  | 'scan.pids.o2Voltage'
  | 'scan.pids.o2Trim'
  | 'scan.pids.fuelLevel'
  | 'scan.pids.moduleVoltage'
  | 'scan.pids.ambientTemp'
  | 'scan.pids.oilTemp';

export interface PidMeasurement {
  /** i18n key for the measurement label. */
  labelKey: PidLabelKey;
  labelParams?: Record<string, string | number>;
  value: number;
  unit: PidUnit;
  decimals: number;
}

export interface PidDefinition {
  pid: number;
  /** Minimum number of data bytes after the PID byte. */
  bytes: number;
  decode: (data: readonly number[]) => PidMeasurement[];
}

export interface PidReading {
  pid: number;
  measurements: PidMeasurement[];
  /** Raw data bytes after the PID byte, useful for reports and debugging. */
  data: number[];
}

export interface SupportedPidGroup {
  base: number;
  bytes: number[];
  pids: number[];
  /** PID `base + 0x20` claims another bitmap group. */
  next: boolean;
}

function requireBytes(data: readonly number[], count: number): void {
  if (data.length < count) {
    throw new ObdError(
      'malformed-response',
      `PID data needs ${count} byte(s) but only ${data.length} arrived`,
    );
  }
}

const percent = (raw: number): number => (raw * 100) / 255;
const fuelTrim = (raw: number): number => ((raw - 128) * 100) / 128;

function single(
  labelKey: PidLabelKey,
  value: number,
  unit: PidUnit,
  decimals: number,
  labelParams?: Record<string, string | number>,
): PidMeasurement[] {
  return [{ labelKey, value, unit, decimals, ...(labelParams ? { labelParams } : {}) }];
}

function o2Sensor(pid: number, bank: number, sensor: number): PidDefinition {
  return {
    pid,
    bytes: 2,
    decode: (data) => {
      requireBytes(data, 2);
      const params = { bank, sensor };
      return [
        {
          labelKey: 'scan.pids.o2Voltage',
          labelParams: params,
          value: (data[0] ?? 0) / 200,
          unit: 'volts',
          decimals: 2,
        },
        {
          labelKey: 'scan.pids.o2Trim',
          labelParams: params,
          value: fuelTrim(data[1] ?? 0),
          unit: 'percent',
          decimals: 1,
        },
      ];
    },
  };
}

const DEFINITIONS: readonly PidDefinition[] = [
  {
    pid: 0x04,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.engineLoad', percent(data[0] ?? 0), 'percent', 1);
    },
  },
  {
    pid: 0x05,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.coolantTemp', (data[0] ?? 0) - 40, 'celsius', 0);
    },
  },
  {
    pid: 0x06,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.shortFuelTrim', fuelTrim(data[0] ?? 0), 'percent', 1, {
        bank: 1,
      });
    },
  },
  {
    pid: 0x07,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.longFuelTrim', fuelTrim(data[0] ?? 0), 'percent', 1, { bank: 1 });
    },
  },
  {
    pid: 0x08,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.shortFuelTrim', fuelTrim(data[0] ?? 0), 'percent', 1, {
        bank: 2,
      });
    },
  },
  {
    pid: 0x09,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.longFuelTrim', fuelTrim(data[0] ?? 0), 'percent', 1, { bank: 2 });
    },
  },
  {
    pid: 0x0c,
    bytes: 2,
    decode: (data) => {
      requireBytes(data, 2);
      return single('scan.pids.rpm', ((data[0] ?? 0) * 256 + (data[1] ?? 0)) / 4, 'rpm', 0);
    },
  },
  {
    pid: 0x0d,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.speed', data[0] ?? 0, 'kmh', 0);
    },
  },
  {
    pid: 0x0f,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.intakeTemp', (data[0] ?? 0) - 40, 'celsius', 0);
    },
  },
  {
    pid: 0x10,
    bytes: 2,
    decode: (data) => {
      requireBytes(data, 2);
      return single('scan.pids.maf', ((data[0] ?? 0) * 256 + (data[1] ?? 0)) / 100, 'gps', 2);
    },
  },
  {
    pid: 0x11,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.throttle', percent(data[0] ?? 0), 'percent', 1);
    },
  },
  o2Sensor(0x14, 1, 1),
  o2Sensor(0x15, 1, 2),
  o2Sensor(0x16, 1, 3),
  o2Sensor(0x17, 1, 4),
  o2Sensor(0x18, 2, 1),
  o2Sensor(0x19, 2, 2),
  o2Sensor(0x1a, 2, 3),
  o2Sensor(0x1b, 2, 4),
  {
    pid: 0x2f,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.fuelLevel', percent(data[0] ?? 0), 'percent', 1);
    },
  },
  {
    pid: 0x42,
    bytes: 2,
    decode: (data) => {
      requireBytes(data, 2);
      return single(
        'scan.pids.moduleVoltage',
        ((data[0] ?? 0) * 256 + (data[1] ?? 0)) / 1000,
        'volts',
        2,
      );
    },
  },
  {
    pid: 0x46,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.ambientTemp', (data[0] ?? 0) - 40, 'celsius', 0);
    },
  },
  {
    pid: 0x5c,
    bytes: 1,
    decode: (data) => {
      requireBytes(data, 1);
      return single('scan.pids.oilTemp', (data[0] ?? 0) - 40, 'celsius', 0);
    },
  },
];

export const PID_DEFINITIONS = DEFINITIONS;
export const PID_BY_ID: ReadonlyMap<number, PidDefinition> = new Map(
  DEFINITIONS.map((definition) => [definition.pid, definition]),
);
/** PIDs read for the live snapshot and used to decode freeze frames. */
export const CORE_PID_IDS: readonly number[] = DEFINITIONS.map((definition) => definition.pid);

export function decodePid(pid: number, data: readonly number[]): PidReading {
  const definition = PID_BY_ID.get(pid);
  if (!definition) {
    throw new ObdError(
      'malformed-response',
      `PID 0x${pid.toString(16)} is not decoded by this app`,
    );
  }
  requireBytes(data, definition.bytes);

  return {
    pid,
    measurements: definition.decode(data),
    data: [...data],
  };
}

/**
 * Decodes one four-byte supported-PID bitmap. Bit 7 of the first byte is
 * `base + 1`, bit 0 of the fourth byte is `base + 32` (the "next group" flag).
 */
export function decodeSupportedPidGroup(base: number, data: readonly number[]): SupportedPidGroup {
  if (data.length < 4) {
    throw new ObdError(
      'malformed-response',
      `Supported-PID bitmap needs 4 bytes but only ${data.length} arrived`,
    );
  }

  const bytes = data.slice(0, 4);
  const pids: number[] = [];
  let next = false;

  for (let index = 0; index < 32; index += 1) {
    const byte = bytes[Math.floor(index / 8)] ?? 0;
    const mask = 1 << (7 - (index % 8));
    if ((byte & mask) === 0) continue;

    const pid = base + index + 1;
    pids.push(pid);
    if (index === 31) next = true;
  }

  return { base, bytes, pids, next };
}
