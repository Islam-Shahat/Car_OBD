import { ObdError } from './errors';

export type IgnitionType = 'spark' | 'compression';

export type MonitorKey =
  | 'misfire'
  | 'fuelSystem'
  | 'components'
  | 'egr'
  | 'o2Heater'
  | 'pmFilter'
  | 'o2Sensor'
  | 'exhaustGasSensor'
  | 'acRefrigerant'
  | 'secondaryAir'
  | 'boostPressure'
  | 'evap'
  | 'heatedCatalyst'
  | 'noxScr'
  | 'catalyst'
  | 'nmhcCatalyst';

export interface Monitor {
  key: MonitorKey;
  complete: boolean;
}

export interface MilStatus {
  on: boolean;
  dtcCount: number;
}

export interface ReadinessStatus {
  mil: MilStatus;
  ignition: IgnitionType;
  /** Only monitors this ECU declares as supported. */
  monitors: Monitor[];
}

interface MonitorSpec {
  key: MonitorKey;
  /** Support bit in byte C (or byte B for the continuous monitors). */
  supportBit: number;
  /** Incomplete bit in byte D (or byte B for the continuous monitors). */
  incompleteBit: number;
  ignition: IgnitionType | 'both';
}

const CONTINUOUS: readonly MonitorSpec[] = [
  { key: 'misfire', supportBit: 0x01, incompleteBit: 0x10, ignition: 'both' },
  { key: 'fuelSystem', supportBit: 0x02, incompleteBit: 0x20, ignition: 'both' },
  { key: 'components', supportBit: 0x04, incompleteBit: 0x40, ignition: 'both' },
];

const NON_CONTINUOUS: readonly MonitorSpec[] = [
  { key: 'egr', supportBit: 0x01, incompleteBit: 0x01, ignition: 'both' },
  { key: 'o2Heater', supportBit: 0x02, incompleteBit: 0x02, ignition: 'spark' },
  { key: 'pmFilter', supportBit: 0x02, incompleteBit: 0x02, ignition: 'compression' },
  { key: 'o2Sensor', supportBit: 0x04, incompleteBit: 0x04, ignition: 'spark' },
  {
    key: 'exhaustGasSensor',
    supportBit: 0x04,
    incompleteBit: 0x04,
    ignition: 'compression',
  },
  { key: 'acRefrigerant', supportBit: 0x08, incompleteBit: 0x08, ignition: 'spark' },
  { key: 'secondaryAir', supportBit: 0x10, incompleteBit: 0x10, ignition: 'spark' },
  { key: 'boostPressure', supportBit: 0x10, incompleteBit: 0x10, ignition: 'compression' },
  { key: 'evap', supportBit: 0x20, incompleteBit: 0x20, ignition: 'spark' },
  { key: 'heatedCatalyst', supportBit: 0x40, incompleteBit: 0x40, ignition: 'spark' },
  { key: 'noxScr', supportBit: 0x40, incompleteBit: 0x40, ignition: 'compression' },
  { key: 'catalyst', supportBit: 0x80, incompleteBit: 0x80, ignition: 'spark' },
  { key: 'nmhcCatalyst', supportBit: 0x80, incompleteBit: 0x80, ignition: 'compression' },
];

/**
 * PID 0101 payload: A = MIL + stored-DTC count, B = continuous monitors and
 * ignition type, C = supported non-continuous monitors, D = incomplete flags.
 * A set incomplete bit means "not complete" (1 = incomplete).
 */
export function decodeReadinessStatus(data: readonly number[]): ReadinessStatus {
  if (data.length < 4) {
    throw new ObdError(
      'malformed-response',
      `PID 0101 needs 4 bytes but only ${data.length} arrived`,
    );
  }

  const a = data[0] ?? 0;
  const b = data[1] ?? 0;
  const c = data[2] ?? 0;
  const d = data[3] ?? 0;
  const ignition: IgnitionType = (b & 0x08) !== 0 ? 'compression' : 'spark';

  const monitors: Monitor[] = [];

  for (const spec of CONTINUOUS) {
    if ((b & spec.supportBit) === 0) continue;
    monitors.push({ key: spec.key, complete: (b & spec.incompleteBit) === 0 });
  }

  for (const spec of NON_CONTINUOUS) {
    if (spec.ignition !== 'both' && spec.ignition !== ignition) continue;
    if ((c & spec.supportBit) === 0) continue;
    monitors.push({ key: spec.key, complete: (d & spec.incompleteBit) === 0 });
  }

  return {
    mil: { on: (a & 0x80) !== 0, dtcCount: a & 0x7f },
    ignition,
    monitors,
  };
}
