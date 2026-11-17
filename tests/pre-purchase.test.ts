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

  it('treats 0xFF (255 warm-ups) and 0xFFFF (65,535 distance/time) as saturated/unavailable, not reassuring evidence', () => {
    const status: ReadinessStatus = {
      mil: { on: false, dtcCount: 0 },
      ignition: 'spark',
      monitors: [
        { key: 'misfire', complete: true },
        { key: 'fuelSystem', complete: true },
        { key: 'components', complete: true },
      ],
    };

    const saturatedHistory: DriveHistory = {
      ...emptyHistory,
      distanceSinceClearedKm: 65535, // 0xFFFF
      warmupsSinceCleared: 255, // 0xFF
      timeSinceClearedMinutes: 65535, // 0xFFFF
      runTimeSeconds: 3600,
    };

    const assessment = evaluatePrePurchase({
      status,
      driveHistory: saturatedHistory,
      stored: [],
      pending: [],
      permanent: [],
    });

    expect(assessment.rawCounters.distanceSinceClearedKm).toBe(65535);
    expect(assessment.rawCounters.warmupsSinceCleared).toBe(255);

    const distFactor = assessment.factors.find((f) => f.id === 'distanceSinceClear');
    expect(distFactor?.status).toBe('unavailable');
    expect(distFactor?.rawText).toContain('65535 km');
    expect(distFactor?.rawText).toContain('counter at maximum or unavailable');
    expect(distFactor?.explanationKey).toBe('prePurchase.explanations.counterAtMaxOrUnavailable');

    const warmFactor = assessment.factors.find((f) => f.id === 'warmupsSinceClear');
    expect(warmFactor?.status).toBe('unavailable');
    expect(warmFactor?.rawText).toContain('255');
    expect(warmFactor?.rawText).toContain('counter at maximum or unavailable');
    expect(warmFactor?.explanationKey).toBe('prePurchase.explanations.counterAtMaxOrUnavailable');
  });

  it('scores PIDs 0121 and 014D (distance/time with MIL on) in the opposite direction of since-cleared counters', () => {
    const completeMonitors: ReadinessStatus = {
      mil: { on: false, dtcCount: 0 },
      ignition: 'spark',
      monitors: [
        { key: 'misfire', complete: true },
        { key: 'fuelSystem', complete: true },
        { key: 'catalyst', complete: true },
      ],
    };

    // Direction 1: 0 km and 0 min with MIL on -> normal (0 is GOOD for MIL-on, whereas 0 is SUSPICIOUS for since-cleared)
    const zeroMilAssessment = evaluatePrePurchase({
      status: completeMonitors,
      driveHistory: {
        ...emptyHistory,
        distanceSinceClearedKm: 500,
        warmupsSinceCleared: 30,
        timeSinceClearedMinutes: 1200,
        distanceWithMilKm: 0,
        timeWithMilMinutes: 0,
      },
      stored: [],
      pending: [],
      permanent: [],
    });
    expect(zeroMilAssessment.level).toBe('no_indicators');
    const zeroMilFactor = zeroMilAssessment.factors.find((f) => f.id === 'milHistory');
    expect(zeroMilFactor?.status).toBe('normal');
    expect(zeroMilFactor?.explanationKey).toBe('prePurchase.explanations.milHistoryZero');

    // Direction 2: High or saturated (0xFFFF) distance/time with MIL on -> suspicious (warning light on for a long time)
    const highMilAssessment = evaluatePrePurchase({
      status: completeMonitors,
      driveHistory: {
        ...emptyHistory,
        distanceSinceClearedKm: 500,
        warmupsSinceCleared: 30,
        timeSinceClearedMinutes: 1200,
        distanceWithMilKm: 65535, // 0xFFFF saturated MIL-on distance
        timeWithMilMinutes: 400, // 400 minutes with MIL on
      },
      stored: [],
      pending: [],
      permanent: [],
    });
    expect(highMilAssessment.level).toBe('some_indicators');
    const highMilFactor = highMilAssessment.factors.find((f) => f.id === 'milHistory');
    expect(highMilFactor?.status).toBe('suspicious');
    expect(highMilFactor?.explanationKey).toBe('prePurchase.explanations.milHistoryLong');
  });

  it('handles missing or unsupported PIDs safely without throwing or false positives', () => {
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
    expect(distFactor?.explanationKey).toBe('prePurchase.explanations.pidUnavailable');

    const warmFactor = assessment.factors.find((f) => f.id === 'warmupsSinceClear');
    expect(warmFactor?.status).toBe('unavailable');
    expect(warmFactor?.explanationKey).toBe('prePurchase.explanations.pidUnavailable');
  });
});
