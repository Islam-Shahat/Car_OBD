import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconAlert, IconCheck } from '../../app/icons';
import { useStorage } from '../../lib/db/StorageProvider';
import type { DtcLookup } from '../../lib/db/types';
import { dtcCategory, type Dtc } from '../../lib/obd/dtc';
import { evaluatePrePurchase } from '../../lib/obd/prePurchase';
import type {
  DriveHistory,
  PidLabelKey,
  PidMeasurement,
  PidReading,
  PidUnit,
} from '../../lib/obd/pids';
import type { MonitorKey } from '../../lib/obd/readiness';
import type { ScanResult, ScanWarning, ScanWarningCode } from '../../lib/obd/scanTypes';
import { useSelectedVehicleStore } from '../vehicles/vehicleStore';
import { useConnectionStore } from '../connection/connectionStore';
import { ReportModal } from '../reports/ReportModal';

const MONITOR_KEYS = {
  misfire: 'scan.monitors.misfire',
  fuelSystem: 'scan.monitors.fuelSystem',
  components: 'scan.monitors.components',
  egr: 'scan.monitors.egr',
  o2Heater: 'scan.monitors.o2Heater',
  pmFilter: 'scan.monitors.pmFilter',
  o2Sensor: 'scan.monitors.o2Sensor',
  exhaustGasSensor: 'scan.monitors.exhaustGasSensor',
  acRefrigerant: 'scan.monitors.acRefrigerant',
  secondaryAir: 'scan.monitors.secondaryAir',
  boostPressure: 'scan.monitors.boostPressure',
  evap: 'scan.monitors.evap',
  heatedCatalyst: 'scan.monitors.heatedCatalyst',
  noxScr: 'scan.monitors.noxScr',
  catalyst: 'scan.monitors.catalyst',
  nmhcCatalyst: 'scan.monitors.nmhcCatalyst',
} as const satisfies Record<MonitorKey, string>;

const SYSTEM_KEYS = {
  P: 'scan.systems.P',
  C: 'scan.systems.C',
  B: 'scan.systems.B',
  U: 'scan.systems.U',
} as const satisfies Record<Dtc['system'], string>;

const SEVERITY_KEYS = {
  high: 'scan.severities.high',
  medium: 'scan.severities.medium',
  low: 'scan.severities.low',
} as const;

const WARNING_KEYS = {
  'pids-unavailable': 'scan.warnings.pidsUnavailable',
  'pid-no-data': 'scan.warnings.pidNoData',
  'mode-unsupported': 'scan.warnings.modeUnsupported',
  'vin-unavailable': 'scan.warnings.vinUnavailable',
  'vin-invalid': 'scan.warnings.vinInvalid',
  'freeze-frame-unavailable': 'scan.warnings.freezeFrameUnavailable',
  'dtc-count-mismatch': 'scan.warnings.dtcCountMismatch',
  'headers-unavailable': 'scan.warnings.headersUnavailable',
  'malformed-response': 'scan.warnings.malformedResponse',
} as const satisfies Record<ScanWarningCode, string>;

const DRIVE_HISTORY_FIELDS: readonly {
  key: keyof DriveHistory;
  labelKey: PidLabelKey;
  unit: PidUnit;
}[] = [
  { key: 'runTimeSeconds', labelKey: 'scan.pids.runTime', unit: 'seconds' },
  { key: 'distanceWithMilKm', labelKey: 'scan.pids.distanceWithMil', unit: 'km' },
  { key: 'warmupsSinceCleared', labelKey: 'scan.pids.warmupsSinceCleared', unit: 'count' },
  { key: 'distanceSinceClearedKm', labelKey: 'scan.pids.distanceSinceCleared', unit: 'km' },
  { key: 'timeWithMilMinutes', labelKey: 'scan.pids.timeWithMil', unit: 'minutes' },
  { key: 'timeSinceClearedMinutes', labelKey: 'scan.pids.timeSinceCleared', unit: 'minutes' },
];

function hex(value: number, width = 2): string {
  return value.toString(16).toUpperCase().padStart(width, '0');
}

function WarningText({ warning }: { warning: ScanWarning }) {
  const { t } = useTranslation();
  const params: Record<string, string | number> = {};
  if (warning.pid !== undefined) params.pid = `0x${hex(warning.pid)}`;
  if (warning.mode !== undefined) params.mode = hex(warning.mode);
  if (warning.reported !== undefined) params.reported = warning.reported;
  if (warning.received !== undefined) params.received = warning.received;
  return <>{t(WARNING_KEYS[warning.code], params)}</>;
}

function MeasurementValue({ measurement }: { measurement: PidMeasurement }) {
  const { t, i18n } = useTranslation();
  const formatted = new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: measurement.decimals,
    maximumFractionDigits: measurement.decimals,
  }).format(measurement.value);

  return (
    <span className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {t(measurement.labelKey, measurement.labelParams ?? {})}
      </span>
      <span dir="ltr" className="font-mono text-sm font-semibold tabular-nums">
        {formatted}
        <span className="ms-1 text-xs font-normal text-slate-500 dark:text-slate-400">
          {t(`scan.units.${measurement.unit}`)}
        </span>
      </span>
    </span>
  );
}

function ReadingsList({ readings }: { readings: readonly PidReading[] }) {
  if (readings.length === 0) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {readings.flatMap((reading) =>
        reading.measurements.map((measurement, index) => (
          <li
            key={`${reading.pid}-${index}`}
            className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
          >
            <MeasurementValue measurement={measurement} />
          </li>
        )),
      )}
    </ul>
  );
}

function DriveHistoryList({ history }: { history: DriveHistory }) {
  const { t, i18n } = useTranslation();
  const rows = DRIVE_HISTORY_FIELDS.filter(({ key }) => history[key] !== null);
  if (rows.length === 0) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map(({ key, labelKey, unit }) => {
        const value = history[key];
        if (value === null) return null;
        return (
          <li
            key={key}
            className="flex items-baseline justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
          >
            <span className="text-sm text-slate-600 dark:text-slate-300">{t(labelKey)}</span>
            <span dir="ltr" className="font-mono text-sm font-semibold tabular-nums">
              {new Intl.NumberFormat(i18n.resolvedLanguage).format(value)}
              <span className="ms-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                {t(`scan.units.${unit}`)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DtcGroup({
  title,
  codes,
  supported,
  make,
}: {
  title: string;
  codes: readonly Dtc[];
  supported: boolean;
  make: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { repositories } = useStorage();
  const [lookups, setLookups] = useState<Record<string, DtcLookup>>({});
  const [showEnglishMap, setShowEnglishMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const repository = repositories?.dtc;
    if (!repository || codes.length === 0) return;

    void Promise.all(
      codes.map(async (dtc) => [dtc.code, await repository.lookup(dtc.code, make)] as const),
    )
      .then((entries) => {
        if (!cancelled) setLookups(Object.fromEntries(entries));
      })
      .catch(() => {
        // A lookup failure must never hide the code itself.
        if (!cancelled) setLookups({});
      });

    return () => {
      cancelled = true;
    };
  }, [codes, repositories, make]);

  const arabic = i18n.resolvedLanguage === 'ar';

  const toggleEnglish = (code: string) => {
    setShowEnglishMap((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {title}
      </h3>
      {!supported && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('scan.modeUnsupported')}
        </p>
      )}
      {supported && codes.length === 0 && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('scan.noCodes')}</p>
      )}
      {codes.length > 0 && (
        <ul className="mt-2 grid gap-2">
          {codes.map((dtc) => {
            const lookup = lookups[dtc.code];
            const record = lookup?.record ?? null;
            const category = lookup?.category ?? dtcCategory(dtc.code);
            const causes = record
              ? arabic
                ? record.possibleCausesAr
                : record.possibleCausesEn
              : [];
            const steps = record
              ? arabic
                ? record.inspectionStepsAr
                : record.inspectionStepsEn
              : [];
            const isEnglishOpen = showEnglishMap[dtc.code] ?? false;

            return (
              <li
                key={dtc.code}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{dtc.code}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t(`scan.dtcCategories.${category}`)}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {t(SYSTEM_KEYS[dtc.system])}
                  </span>
                  {dtc.ecuId && (
                    <span
                      dir="ltr"
                      className="font-mono text-[11px] text-slate-400 dark:text-slate-500"
                    >
                      {t('scan.ecuId', { id: dtc.ecuId })}
                    </span>
                  )}
                  {record?.translationTier === 1 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                      {t('scan.dtcDraftReview')}
                    </span>
                  )}
                  {record?.translationTier === 2 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {t('scan.dtcUnreviewed')}
                    </span>
                  )}
                  {record?.severity && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        record.severity === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                          : record.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {t('scan.severityLabel', {
                        level: t(
                          SEVERITY_KEYS[record.severity as keyof typeof SEVERITY_KEYS] ??
                            'scan.severities.medium',
                        ),
                      })}
                      {record.severitySource === 'heuristic' && (
                        <span className="ms-1 font-normal opacity-75">
                          {t('scan.severityHeuristic')}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {record ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs leading-6 text-slate-700 dark:text-slate-200">
                      {arabic ? record.descriptionAr : record.descriptionEn}
                    </p>

                    {arabic && (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleEnglish(dtc.code)}
                          className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {isEnglishOpen ? t('scan.dtcHideEnglish') : t('scan.dtcShowEnglish')}
                        </button>
                        {isEnglishOpen && (
                          <p
                            dir="ltr"
                            className="mt-1 rounded bg-slate-50 p-2 font-sans text-xs leading-5 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                          >
                            {record.descriptionEn}
                          </p>
                        )}
                      </div>
                    )}

                    {(causes.length > 0 || steps.length > 0) && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                          {t('scan.dtcDetails')}
                        </summary>
                        {causes.length > 0 && (
                          <div className="mt-1.5">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {t('scan.dtcCauses')}
                            </p>
                            <ul className="mt-0.5 list-inside list-disc text-slate-600 dark:text-slate-400">
                              {causes.map((cause) => (
                                <li key={cause}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {steps.length > 0 && (
                          <div className="mt-1.5">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {t('scan.dtcSteps')}
                            </p>
                            <ol className="mt-0.5 list-inside list-decimal text-slate-600 dark:text-slate-400">
                              {steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </details>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {t('scan.dtcSource', {
                        source: record.source,
                        version: record.sourceVersion.slice(0, 7),
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('scan.dtcNoDescription')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ScanResultView({
  result,
  mode = 'normal',
  isDemo = false,
}: {
  result: ScanResult;
  mode?: 'normal' | 'pre_purchase';
  isDemo?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { repositories } = useStorage();
  const selectedVehicle = useSelectedVehicleStore((state) => state.selected);

  const seconds = (result.durationMs / 1000).toFixed(1);
  const vin = result.vin;
  const hasDriveHistory = Object.values(result.driveHistory).some((value) => value !== null);

  const hasStored = result.stored.length > 0;
  const isMilOn = Boolean(result.status?.mil.on);
  const hasPending = result.pending.length > 0;

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [allLookups, setAllLookups] = useState<Record<string, DtcLookup>>({});

  useEffect(() => {
    let cancelled = false;
    const repository = repositories?.dtc;
    const allCodes = [...result.stored, ...result.pending, ...result.permanent];
    if (!repository || allCodes.length === 0) return;

    void Promise.all(
      allCodes.map(
        async (dtc) =>
          [dtc.code, await repository.lookup(dtc.code, vin?.makeSlug ?? null)] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setAllLookups(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setAllLookups({});
      });

    return () => {
      cancelled = true;
    };
  }, [result, repositories, vin]);

  const prePurchase = useMemo(
    () =>
      evaluatePrePurchase({
        status: result.status,
        driveHistory: result.driveHistory,
        stored: result.stored,
        pending: result.pending,
        permanent: result.permanent,
      }),
    [result],
  );

  // Banner color derives strictly from vehicle fault data (stored, pending, MIL)
  const healthTier: 'healthy' | 'warning' | 'fault' =
    hasStored || isMilOn ? 'fault' : hasPending ? 'warning' : 'healthy';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('scan.resultTitle')}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {t('report.viewReport')}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('scan.duration', { seconds })}
          </span>
        </div>
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 shadow-sm ${
          healthTier === 'healthy'
            ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100'
            : healthTier === 'warning'
              ? 'border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100'
              : 'border-red-300 bg-red-50/80 text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
              healthTier === 'healthy'
                ? 'bg-emerald-600 text-white'
                : healthTier === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-red-600 text-white'
            }`}
          >
            {healthTier === 'healthy' ? (
              <IconCheck className="size-5" />
            ) : (
              <IconAlert className="size-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold">
              {healthTier === 'healthy'
                ? t('scan.overallHealthyTitle')
                : healthTier === 'warning'
                  ? t('scan.overallWarningTitle')
                  : t('scan.overallFaultTitle')}
            </h3>
            <p className="mt-1 text-xs opacity-90 leading-5">
              {healthTier === 'healthy'
                ? t('scan.overallHealthyBody')
                : healthTier === 'warning'
                  ? t('scan.overallWarningBody')
                  : t('scan.overallFaultBody')}
            </p>
          </div>
        </div>
      </div>

      {mode === 'pre_purchase' && (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/30">
          <div className="flex items-center justify-between">
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
              {t('prePurchase.badge')}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                prePurchase.level === 'several_indicators'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : prePurchase.level === 'some_indicators'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {t(
                `prePurchase.levels.${
                  prePurchase.level === 'several_indicators'
                    ? 'several'
                    : prePurchase.level === 'some_indicators'
                      ? 'some'
                      : 'none'
                }.badge` as any,
              )}
            </span>
          </div>
          <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
            {t(prePurchase.headlineKey as any)}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {t(prePurchase.bodyKey as any)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded bg-white p-2 text-center shadow-2xs dark:bg-slate-900">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                {t('prePurchase.factors.monitors')}
              </span>
              <span dir="ltr" className="font-mono font-semibold">
                {`${prePurchase.rawCounters.incompleteMonitorsCount} / ${prePurchase.rawCounters.supportedMonitorsCount}`}
              </span>
            </div>
            <div className="rounded bg-white p-2 text-center shadow-2xs dark:bg-slate-900">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                {t('prePurchase.factors.distanceSinceClear')}
              </span>
              <span dir="ltr" className="font-mono font-semibold">
                {prePurchase.rawCounters.distanceSinceClearedKm !== null
                  ? `${prePurchase.rawCounters.distanceSinceClearedKm} km`
                  : 'N/A'}
              </span>
            </div>
            <div className="rounded bg-white p-2 text-center shadow-2xs dark:bg-slate-900">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                {t('prePurchase.factors.warmupsSinceClear')}
              </span>
              <span dir="ltr" className="font-mono font-semibold">
                {prePurchase.rawCounters.warmupsSinceCleared ?? 'N/A'}
              </span>
            </div>
            <div className="rounded bg-white p-2 text-center shadow-2xs dark:bg-slate-900">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                {t('prePurchase.factors.permanentCodes')}
              </span>
              <span dir="ltr" className="font-mono font-semibold">
                {prePurchase.rawCounters.permanentDtcCount}
              </span>
            </div>
          </div>
        </div>
      )}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('scan.vin')}</dt>
          <dd className="mt-0.5">
            <span dir="ltr" className="font-mono font-semibold">
              {vin?.vin ?? t('scan.vinUnavailable')}
            </span>
          </dd>
          {vin && (
            <dd
              className={`mt-1 text-xs ${
                vin.applicable && !vin.valid
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {!vin.applicable
                ? t('scan.vinNotApplicable')
                : vin.valid
                  ? t('scan.vinValid')
                  : t('scan.vinInvalid')}
            </dd>
          )}
          {vin && (vin.manufacturerName || vin.makeSlug) && (
            <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('scan.vinManufacturer')}: {vin.manufacturerName ?? vin.makeSlug}
            </dd>
          )}
          {vin && vin.yearCandidates.length > 0 && (
            <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('scan.vinYearCandidates', { years: vin.yearCandidates.join(' / ') })}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('scan.protocol')}</dt>
          <dd className="mt-0.5">{result.protocol ?? t('connection.protocolUnknown')}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('scan.adapter')}</dt>
          <dd className="mt-0.5">{result.adapter.identity}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">{t('scan.supportedPids')}</dt>
          <dd className="mt-0.5">{result.supportedPids.length}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
        <span className="text-sm font-semibold">{t('scan.mil')}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            result.status?.mil.on
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
          }`}
        >
          {result.status?.mil.on
            ? result.status.mil.dtcCount > 0
              ? t('scan.milOnCount', { count: result.status.mil.dtcCount })
              : t('scan.milOn')
            : t('scan.milOff')}
        </span>
      </div>

      {result.status && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t('scan.readinessTitle')}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t(`scan.ignition.${result.status.ignition}`)}
            </span>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.status.monitors.map((monitor) => (
              <li
                key={monitor.key}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/60"
              >
                <span>{t(MONITOR_KEYS[monitor.key])}</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    monitor.complete
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {monitor.complete ? (
                    <IconCheck className="size-3.5" />
                  ) : (
                    <IconAlert className="size-3.5" />
                  )}
                  {monitor.complete ? t('scan.monitorComplete') : t('scan.monitorIncomplete')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <DtcGroup
          title={t('scan.storedTitle')}
          codes={result.stored}
          supported={result.modeSupport.stored}
          make={result.vin?.makeSlug ?? null}
        />
        <DtcGroup
          title={t('scan.pendingTitle')}
          codes={result.pending}
          supported={result.modeSupport.pending}
          make={result.vin?.makeSlug ?? null}
        />
        <DtcGroup
          title={t('scan.permanentTitle')}
          codes={result.permanent}
          supported={result.modeSupport.permanent}
          make={result.vin?.makeSlug ?? null}
        />
      </div>

      {result.freezeFrames.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('scan.freezeTitle')}
          </h3>
          <div className="mt-2 grid gap-3">
            {result.freezeFrames.map((frame) => (
              <div
                key={frame.frame}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="text-xs font-semibold">
                  {t('scan.freezeFrame', { frame: frame.frame + 1 })}
                </p>
                {frame.dtc && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('scan.freezeDtc', { code: frame.dtc.code })}
                  </p>
                )}
                <div className="mt-2">
                  <ReadingsList readings={frame.readings} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.live.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('scan.liveTitle')}
          </h3>
          <div className="mt-2">
            <ReadingsList readings={result.live} />
          </div>
        </div>
      )}

      {hasDriveHistory && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('scan.driveHistoryTitle')}
          </h3>
          <div className="mt-2">
            <DriveHistoryList history={result.driveHistory} />
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
              {t('scan.scanNotesTitle')}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('scan.scanNotesNotice')}
            </span>
          </div>
          <ul className="mt-3 grid gap-2">
            {result.warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <IconAlert className="mt-1 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <WarningText warning={warning} />
                  {warning.detail && (
                    <span dir="ltr" className="mt-0.5 block font-mono text-[11px] opacity-70">
                      {warning.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(result.finishedAt))}
      </p>

      {reportModalOpen && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportModalOpen(false)}
          data={{
            mode,
            isSampleData: isDemo || useConnectionStore.getState().sessionType !== 'real',
            scanDate: new Date(result.finishedAt).toLocaleString(i18n.resolvedLanguage),
            vehicle: selectedVehicle
              ? {
                  make: selectedVehicle.make,
                  model: selectedVehicle.model,
                  year: selectedVehicle.year,
                  engine: selectedVehicle.engine,
                  vin: selectedVehicle.vin,
                }
              : result.vin
                ? {
                    make: result.vin.manufacturerName ?? result.vin.makeSlug,
                    model: null,
                    year: result.vin.yearCandidates[0] ?? null,
                    engine: null,
                    vin: result.vin.vin,
                  }
                : null,
            adapter: result.adapter
              ? {
                  identity: result.adapter.identity,
                  version: result.adapter.version,
                  protocol: result.adapter.protocol,
                }
              : null,
            protocol: result.protocol,
            milStatus: result.status
              ? { on: result.status.mil.on, dtcCount: result.status.mil.dtcCount }
              : null,
            overallStatus: healthTier,
            storedCodes: result.stored.map((d) => ({
              code: d.code,
              type: 'stored',
              lookup: allLookups[d.code] ?? null,
            })),
            pendingCodes: result.pending.map((d) => ({
              code: d.code,
              type: 'pending',
              lookup: allLookups[d.code] ?? null,
            })),
            permanentCodes: result.permanent.map((d) => ({
              code: d.code,
              type: 'permanent',
              lookup: allLookups[d.code] ?? null,
            })),
            readiness: result.status,
            driveHistory: result.driveHistory,
            freezeFrames: result.freezeFrames,
            prePurchase,
          }}
        />
      )}
    </section>
  );
}
