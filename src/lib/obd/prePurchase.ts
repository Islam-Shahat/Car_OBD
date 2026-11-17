import type { DriveHistory } from './pids';
import type { ReadinessStatus } from './readiness';

export type PrePurchaseIndicatorLevel = 'no_indicators' | 'some_indicators' | 'several_indicators';

export interface PrePurchaseFactor {
  id: string;
  labelKey: string;
  status: 'normal' | 'caution' | 'suspicious' | 'unavailable';
  rawText: string;
  explanationKey: string;
}

export interface PrePurchaseAssessment {
  level: PrePurchaseIndicatorLevel;
  headlineKey: string;
  bodyKey: string;
  limitationsKey: string;
  factors: PrePurchaseFactor[];
  rawCounters: {
    distanceSinceClearedKm: number | null;
    warmupsSinceCleared: number | null;
    timeSinceClearedMinutes: number | null;
    runTimeSeconds: number | null;
    distanceWithMilKm: number | null;
    timeWithMilMinutes?: number | null;
    incompleteMonitorsCount: number;
    supportedMonitorsCount: number;
    permanentDtcCount: number;
  };
}

export interface PrePurchaseInput {
  status: ReadinessStatus | null;
  driveHistory: DriveHistory;
  stored?: readonly { code: string }[];
  pending?: readonly { code: string }[];
  permanent: readonly { code: string }[];
}

export const COUNTER_MAX_BYTE = 0xff; // 255 (warm-up cycles)
export const COUNTER_MAX_WORD = 0xffff; // 65,535 (distance km or time min)

/**
 * Evaluates whether vehicle readiness monitors and drive history counters
 * show signs consistent with recent diagnostic trouble code clearing.
 *
 * NOTE: All thresholds and heuristics are informational and cautious.
 * They are public heuristics and have NOT been calibrated on physical vehicle fleets.
 * This analysis provides non-accusatory indicator levels and never a definitive verdict.
 */
export function evaluatePrePurchase(input: PrePurchaseInput): PrePurchaseAssessment {
  const { status, driveHistory, permanent } = input;
  const factors: PrePurchaseFactor[] = [];

  const distanceSinceClear = driveHistory.distanceSinceClearedKm;
  const warmupsSinceClear = driveHistory.warmupsSinceCleared;
  const timeSinceClear = driveHistory.timeSinceClearedMinutes;
  const runTimeSeconds = driveHistory.runTimeSeconds;
  const distanceWithMil = driveHistory.distanceWithMilKm;
  const timeWithMil = driveHistory.timeWithMilMinutes;

  const isDistanceClearMax = distanceSinceClear !== null && distanceSinceClear >= COUNTER_MAX_WORD;
  const isWarmupsClearMax = warmupsSinceClear !== null && warmupsSinceClear >= COUNTER_MAX_BYTE;
  const isTimeClearMax = timeSinceClear !== null && timeSinceClear >= COUNTER_MAX_WORD;

  // 1. Evaluate I/M Readiness monitors
  let incompleteMonitorsCount = 0;
  let supportedMonitorsCount = 0;

  if (status && Array.isArray(status.monitors)) {
    supportedMonitorsCount = status.monitors.length;
    incompleteMonitorsCount = status.monitors.filter((m) => !m.complete).length;
  }

  const monitorsAvailable = supportedMonitorsCount > 0;
  let monitorFactorStatus: PrePurchaseFactor['status'] = 'normal';
  if (!monitorsAvailable) {
    monitorFactorStatus = 'unavailable';
  } else if (incompleteMonitorsCount >= 3) {
    monitorFactorStatus = 'suspicious';
  } else if (incompleteMonitorsCount >= 1) {
    monitorFactorStatus = 'caution';
  }

  factors.push({
    id: 'monitors',
    labelKey: 'prePurchase.factors.monitors',
    status: monitorFactorStatus,
    rawText: monitorsAvailable ? `${incompleteMonitorsCount} / ${supportedMonitorsCount}` : 'N/A',
    explanationKey:
      incompleteMonitorsCount >= 3
        ? 'prePurchase.explanations.monitorsManyIncomplete'
        : incompleteMonitorsCount > 0
          ? 'prePurchase.explanations.monitorsSomeIncomplete'
          : 'prePurchase.explanations.monitorsComplete',
  });

  // 2. Distance traveled since DTCs cleared (PID 0131)
  // 0xFFFF (65,535) can mean maximum reached or not available; treat as unavailable, not reassuring.
  let distanceStatus: PrePurchaseFactor['status'] = 'normal';
  if (distanceSinceClear === null || isDistanceClearMax) {
    distanceStatus = 'unavailable';
  } else if (distanceSinceClear < 25) {
    distanceStatus = 'suspicious';
  } else if (distanceSinceClear < 80) {
    distanceStatus = 'caution';
  }

  factors.push({
    id: 'distanceSinceClear',
    labelKey: 'prePurchase.factors.distanceSinceClear',
    status: distanceStatus,
    rawText:
      distanceSinceClear === null
        ? 'N/A'
        : isDistanceClearMax
          ? `${distanceSinceClear} km (0xFFFF — counter at maximum or unavailable)`
          : `${distanceSinceClear} km`,
    explanationKey:
      distanceSinceClear === null
        ? 'prePurchase.explanations.pidUnavailable'
        : isDistanceClearMax
          ? 'prePurchase.explanations.counterAtMaxOrUnavailable'
          : distanceSinceClear < 25
            ? 'prePurchase.explanations.distanceVeryLow'
            : distanceSinceClear < 80
              ? 'prePurchase.explanations.distanceLow'
              : 'prePurchase.explanations.distanceAdequate',
  });

  // 3. Warm-up cycles since DTCs cleared (PID 0130)
  // 0xFF (255) can mean maximum reached or not available; treat as unavailable, not reassuring.
  let warmupsStatus: PrePurchaseFactor['status'] = 'normal';
  if (warmupsSinceClear === null || isWarmupsClearMax) {
    warmupsStatus = 'unavailable';
  } else if (warmupsSinceClear < 3) {
    warmupsStatus = 'suspicious';
  } else if (warmupsSinceClear < 10) {
    warmupsStatus = 'caution';
  }

  factors.push({
    id: 'warmupsSinceClear',
    labelKey: 'prePurchase.factors.warmupsSinceClear',
    status: warmupsStatus,
    rawText:
      warmupsSinceClear === null
        ? 'N/A'
        : isWarmupsClearMax
          ? `${warmupsSinceClear} (0xFF — counter at maximum or unavailable)`
          : `${warmupsSinceClear}`,
    explanationKey:
      warmupsSinceClear === null
        ? 'prePurchase.explanations.pidUnavailable'
        : isWarmupsClearMax
          ? 'prePurchase.explanations.counterAtMaxOrUnavailable'
          : warmupsSinceClear < 3
            ? 'prePurchase.explanations.warmupsVeryLow'
            : warmupsSinceClear < 10
              ? 'prePurchase.explanations.warmupsLow'
              : 'prePurchase.explanations.warmupsAdequate',
  });

  // 4. Permanent DTCs (Mode 0A)
  const permanentCount = permanent.length;
  let permanentStatus: PrePurchaseFactor['status'] = 'normal';
  if (permanentCount > 0) {
    permanentStatus = 'suspicious';
  }

  factors.push({
    id: 'permanentCodes',
    labelKey: 'prePurchase.factors.permanentCodes',
    status: permanentStatus,
    rawText: `${permanentCount}`,
    explanationKey:
      permanentCount > 0
        ? 'prePurchase.explanations.permanentPresent'
        : 'prePurchase.explanations.permanentNone',
  });

  // 5. Distance / Time with MIL on (PIDs 0121 and 014D)
  // Inverse polarity from "since codes cleared":
  // 0 = MIL has not been on; > 0 or saturated (0xFFFF) = warning light has been on for a long time.
  // Never score a low/zero MIL counter as suspicious, and flag non-zero/high/saturated MIL counters.
  if (distanceWithMil !== null || timeWithMil !== null) {
    const milDistActive = distanceWithMil !== null && distanceWithMil > 0;
    const milTimeActive = timeWithMil !== null && timeWithMil > 0;
    const milActive = milDistActive || milTimeActive;
    const milLongOrSaturated =
      (distanceWithMil !== null && distanceWithMil >= 50) ||
      (timeWithMil !== null && timeWithMil >= 60);

    const parts: string[] = [];
    if (distanceWithMil !== null) {
      parts.push(
        distanceWithMil >= COUNTER_MAX_WORD
          ? `${distanceWithMil} km (0xFFFF)`
          : `${distanceWithMil} km`,
      );
    }
    if (timeWithMil !== null) {
      parts.push(
        timeWithMil >= COUNTER_MAX_WORD ? `${timeWithMil} min (0xFFFF)` : `${timeWithMil} min`,
      );
    }

    factors.push({
      id: 'milHistory',
      labelKey: 'prePurchase.factors.milHistory',
      status: milLongOrSaturated ? 'suspicious' : milActive ? 'caution' : 'normal',
      rawText: parts.join(' / '),
      explanationKey: milLongOrSaturated
        ? 'prePurchase.explanations.milHistoryLong'
        : milActive
          ? 'prePurchase.explanations.milHistoryActive'
          : 'prePurchase.explanations.milHistoryZero',
    });
  }

  // 6. Correlate and synthesize overall level
  let suspicionScore = 0;

  if (incompleteMonitorsCount >= 3) suspicionScore += 2;
  else if (incompleteMonitorsCount >= 1) suspicionScore += 1;

  if (distanceSinceClear !== null && !isDistanceClearMax) {
    if (distanceSinceClear < 25) suspicionScore += 2;
    else if (distanceSinceClear < 80) suspicionScore += 1;
  }

  if (warmupsSinceClear !== null && !isWarmupsClearMax) {
    if (warmupsSinceClear < 3) suspicionScore += 2;
    else if (warmupsSinceClear < 10) suspicionScore += 1;
  }

  if (timeSinceClear !== null && !isTimeClearMax && timeSinceClear < 60) {
    suspicionScore += 1;
  }

  if (permanentCount > 0) {
    // Permanent DTC surviving clear is a significant flag
    suspicionScore += 3;
  }

  // PID 0121 / 014D: high or saturated MIL-on distance/time means the warning light has been on for a long time
  if (
    (distanceWithMil !== null && distanceWithMil >= 50) ||
    (timeWithMil !== null && timeWithMil >= 60)
  ) {
    suspicionScore += 2;
  } else if (
    (distanceWithMil !== null && distanceWithMil > 0) ||
    (timeWithMil !== null && timeWithMil > 0)
  ) {
    suspicionScore += 1;
  }

  let level: PrePurchaseIndicatorLevel = 'no_indicators';
  if (suspicionScore >= 4) {
    level = 'several_indicators';
  } else if (suspicionScore >= 2) {
    level = 'some_indicators';
  }

  const headlineKey =
    level === 'several_indicators'
      ? 'prePurchase.levels.several.headline'
      : level === 'some_indicators'
        ? 'prePurchase.levels.some.headline'
        : 'prePurchase.levels.none.headline';

  const bodyKey =
    level === 'several_indicators'
      ? 'prePurchase.levels.several.body'
      : level === 'some_indicators'
        ? 'prePurchase.levels.some.body'
        : 'prePurchase.levels.none.body';

  return {
    level,
    headlineKey,
    bodyKey,
    limitationsKey: 'prePurchase.limitationsNotice',
    factors,
    rawCounters: {
      distanceSinceClearedKm: distanceSinceClear,
      warmupsSinceCleared: warmupsSinceClear,
      timeSinceClearedMinutes: timeSinceClear,
      runTimeSeconds,
      distanceWithMilKm: distanceWithMil,
      timeWithMilMinutes: timeWithMil,
      incompleteMonitorsCount,
      supportedMonitorsCount,
      permanentDtcCount: permanentCount,
    },
  };
}
