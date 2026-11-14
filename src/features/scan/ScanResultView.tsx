import { useTranslation } from 'react-i18next';

import { IconAlert, IconCheck } from '../../app/icons';
import type { Dtc } from '../../lib/obd/dtc';
import type {
  DriveHistory,
  PidLabelKey,
  PidMeasurement,
  PidReading,
  PidUnit,
} from '../../lib/obd/pids';
import type { MonitorKey } from '../../lib/obd/readiness';
import type { ScanResult, ScanWarning, ScanWarningCode } from '../../lib/obd/scanTypes';

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
}: {
  title: string;
  codes: readonly Dtc[];
  supported: boolean;
}) {
  const { t } = useTranslation();

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
        <ul className="mt-2 flex flex-wrap gap-2">
          {codes.map((dtc) => (
            <li
              key={dtc.code}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="font-mono text-sm font-bold">{dtc.code}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScanResultView({ result }: { result: ScanResult }) {
  const { t, i18n } = useTranslation();
  const seconds = (result.durationMs / 1000).toFixed(1);
  const vin = result.vin;
  const hasDriveHistory = Object.values(result.driveHistory).some((value) => value !== null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('scan.resultTitle')}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('scan.duration', { seconds })}
        </span>
      </div>

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
        />
        <DtcGroup
          title={t('scan.pendingTitle')}
          codes={result.pending}
          supported={result.modeSupport.pending}
        />
        <DtcGroup
          title={t('scan.permanentTitle')}
          codes={result.permanent}
          supported={result.modeSupport.permanent}
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
        <div className="mt-5">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('scan.warningsTitle')}
          </h3>
          <ul className="mt-2 grid gap-2">
            {result.warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
              >
                <IconAlert className="mt-1 size-3.5 shrink-0" />
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
    </section>
  );
}
