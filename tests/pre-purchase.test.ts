import { describe, expect, it } from 'vitest';
import { evaluatePrePurchase } from '../src/lib/obd/prePurchase';
import type { DriveHistory } from '../src/lib/obd/pids';
import type { ReadinessStatus } from '../src/lib/obd/readiness';

describe('Pre-purchase inspection heuristics', () => {
  const emptyHistory: DriveHistory = {
    distanceSinceClearedKm: null,
    warmupsSinceCleared: null,
    timeSinceClearedMinutes: null,
    runTimeSeconds: null,
    distanceWithMilKm: null,
    timeWithMilMinutes: null,
  };

  it('evaluates recently cleared codes as several_indicators', () => {
    const status: ReadinessStatus = {
      mil: { on: false, dtcCount: 0 },
      ignition: 'spark',
      monitors: [
        { key: 'misfire', complete: true },
        { key: 'fuelSystem', complete: true },
        { key: 'components', complete: true },
        { key: 'catalyst', complete: false },
        { key: 'evap', complete: false },
        { key: 'o2Sensor', complete: false },
        { key: 'egr', complete: false },
      ],
    };

    const driveHistory: DriveHistory = {
      ...emptyHistory,
      distanceSinceClearedKm: 12,
      warmupsSinceCleared: 1,
      timeSinceClearedMinutes: 25,
      runTimeSeconds: 400,
    };

    const assessment = evaluatePrePurchase({
      status,
      driveHistory,
      stored: [],
      pending: [],
      permanent: [{ code: 'P0420' }],
    });

    expect(assessment.level).toBe('several_indicators');
    expect(assessment.rawCounters.distanceSinceClearedKm).toBe(12);
    expect(assessment.rawCounters.warmupsSinceCleared).toBe(1);
    expect(assessment.rawCounters.incompleteMonitorsCount).toBe(4);
    expect(assessment.rawCounters.permanentDtcCount).toBe(1);

    const monitorFactor = assessment.factors.find((f) => f.id === 'monitors');
    expect(monitorFactor?.status).toBe('suspicious');

    const distFactor = assessment.factors.find((f) => f.id === 'distanceSinceClear');
    expect(distFactor?.status).toBe('suspicious');
  });

  it('evaluates normal extended driving as no_indicators', () => {
    const status: ReadinessStatus = {
      mil: { on: false, dtcCount: 0 },
      ignition: 'spark',
      monitors: [
        { key: 'misfire', complete: true },
        { key: 'fuelSystem', complete: true },
        { key: 'components', complete: true },
        { key: 'catalyst', complete: true },
        { key: 'o2Sensor', complete: true },
      ],
    };

    const driveHistory: DriveHistory = {
      ...emptyHistory,
      distanceSinceClearedKm: 1850,
      warmupsSinceCleared: 64,
      timeSinceClearedMinutes: 4200,
      runTimeSeconds: 1200,
    };

    const assessment = evaluatePrePurchase({
      status,
      driveHistory,
      stored: [],
      pending: [],
      permanent: [],
    });

    expect(assessment.level).toBe('no_indicators');
    expect(assessment.rawCounters.incompleteMonitorsCount).toBe(0);
    expect(assessment.factors.every((f) => f.status === 'normal')).toBe(true);
  });

  it('evaluates partial driving / battery disconnect as some_indicators', () => {
    const status: ReadinessStatus = {
      mil: { on: false, dtcCount: 0 },
      ignition: 'spark',
      monitors: [
        { key: 'misfire', complete: true },
        { key: 'fuelSystem', complete: true },
        { key: 'catalyst', complete: false },
      ],
    };

    const driveHistory: DriveHistory = {
      ...emptyHistory,
      distanceSinceClearedKm: 55, // Between 25 and 80 km
      warmupsSinceCleared: 6, // Between 3 and 10
    };

    const assessment = evaluatePrePurchase({
      status,
      driveHistory,
      stored: [],
      pending: [],
      permanent: [],
    });

    expect(assessment.level).toBe('some_indicators');
    expect(assessment.rawCounters.incompleteMonitorsCount).toBe(1);
  });

  it('handles missing or unsupported PIDs safely without throwing', () => {
    const assessment = evaluatePrePurchase({
      status: null,
      driveHistory: emptyHistory,
      stored: [],
      pending: [],
      permanent: [],
    });

    expect(assessment.level).toBe('no_indicators');
    expect(assessment.rawCounters.distanceSinceClearedKm).toBeNull();
    expect(assessment.rawCounters.warmupsSinceCleared).toBeNull();
    expect(assessment.rawCounters.incompleteMonitorsCount).toBe(0);

    const distFactor = assessment.factors.find((f) => f.id === 'distanceSinceClear');
    expect(distFactor?.status).toBe('unavailable');
  });
});
