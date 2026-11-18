import { useTranslation } from 'react-i18next';
import type { ParseKeysWithoutVariables } from 'i18next';

type TranslationKey = ParseKeysWithoutVariables;
import { IconAlert, IconCheck, IconScan } from '../../app/icons';
import type { DiagnosticReportData, ReportDtcItem } from './reportTypes';
import { maskVin } from './whatsAppSummary';

interface DiagnosticReportViewProps {
  data: DiagnosticReportData;
  hideVin?: boolean;
}

export function DiagnosticReportView({ data, hideVin = true }: DiagnosticReportViewProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';

  const vehicleName = data.vehicle
    ? `${data.vehicle.make ?? ''} ${data.vehicle.model ?? ''} ${data.vehicle.year ? `(${data.vehicle.year})` : ''}`.trim() ||
      (isAr ? 'مركبة غير محددة' : 'Unspecified vehicle')
    : isAr
      ? 'مركبة غير محددة'
      : 'Unspecified vehicle';

  const displayVin = hideVin ? maskVin(data.vehicle?.vin) : (data.vehicle?.vin ?? 'N/A');

  const totalCodes =
    data.storedCodes.length + data.pendingCodes.length + data.permanentCodes.length;

  const hasFaults = totalCodes > 0 || (data.milStatus?.on ?? false);

  const prePurchase = data.prePurchase;

  return (
    <article
      id="diagnostic-report-print-root"
      dir={isAr ? 'rtl' : 'ltr'}
      className="report-paper mx-auto w-full max-w-4xl bg-white p-6 text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none dark:bg-slate-900 dark:text-slate-100"
    >
      {/* Sample / Emulator Watermark Badge */}
      {data.isSampleData && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 print:border-amber-400 print:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <IconAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{t('report.watermarkSample')}</span>
          </span>
          <span className="font-mono text-[10px] uppercase opacity-80">EMULATOR SCENARIO</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 pb-5 print:border-slate-300 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sky-600 text-white print:bg-slate-800">
                <IconScan className="size-5" />
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                OBD Diagnose
              </span>
              <span className="ms-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600 print:border print:border-slate-300 dark:bg-slate-800 dark:text-slate-300">
                v0.9.0-rc.1
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {data.mode === 'pre_purchase' ? t('report.prePurchaseTitle') : t('report.title')}
            </h1>
          </div>

          <div className="text-end text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {t('report.scanDate')}:{' '}
              </span>
              <span dir="ltr" className="font-mono">
                {data.scanDate}
              </span>
            </div>
            {data.protocol && (
              <div className="mt-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t('report.adapterProtocol')}:{' '}
                </span>
                <span dir="ltr" className="font-mono">
                  {data.protocol}
                </span>
              </div>
            )}
            {data.adapter && (
              <div className="mt-0.5">
                <span dir="ltr" className="font-mono text-[11px] text-slate-400">
                  {data.adapter.identity} {data.adapter.version ? `(${data.adapter.version})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Metadata Box */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4 print:border-slate-300 print:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
              {t('report.makeModel')}
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">
              {vehicleName}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
              {t('report.vin')}
            </span>
            <span
              dir="ltr"
              className="mt-0.5 block font-mono text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              {displayVin}
            </span>
            {hideVin && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                ({t('report.vinMaskedNotice')})
              </span>
            )}
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
              {t('report.year')}
            </span>
            <span
              dir="ltr"
              className="mt-0.5 block font-mono text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              {data.vehicle?.year ?? 'N/A'}
            </span>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
              {t('scan.mil')}
            </span>
            <span className="mt-0.5 block text-sm font-semibold">
              {data.milStatus?.on ? (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <IconAlert className="size-3.5" />
                  {t('scan.milOn')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <IconCheck className="size-3.5" />
                  {t('scan.milOff')}
                </span>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mt-6 space-y-6">
        {/* Overall Status Banner */}
        <section
          className={`break-inside-avoid rounded-xl border p-4 ${
            hasFaults
              ? 'border-rose-300 bg-rose-50/70 text-rose-950 print:border-rose-400 print:bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200'
              : 'border-emerald-300 bg-emerald-50/70 text-emerald-950 print:border-emerald-400 print:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {hasFaults ? (
              <IconAlert className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-400" />
            ) : (
              <IconCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <div>
              <h2 className="text-base font-bold">
                {hasFaults
                  ? t('scan.overallFaultTitle', { count: totalCodes })
                  : t('scan.overallHealthyTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 opacity-90">
                {hasFaults ? t('scan.overallFaultBody') : t('scan.overallHealthyBody')}
              </p>
            </div>
          </div>
        </section>

        {/* Pre-Purchase Assessment Section */}
        {prePurchase && (
          <section className="break-inside-avoid rounded-xl border border-slate-200 bg-slate-50/50 p-5 print:border-slate-300 print:bg-white dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 print:border dark:bg-sky-950/60 dark:text-sky-300">
                  {t('prePurchase.badge')}
                </span>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {t('prePurchase.title')}
                </h2>
              </div>

              <div>
                {prePurchase.level === 'several_indicators' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                    <IconAlert className="size-3.5" />
                    {t('prePurchase.levels.several.badge')}
                  </span>
                )}
                {prePurchase.level === 'some_indicators' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    <IconAlert className="size-3.5" />
                    {t('prePurchase.levels.some.badge')}
                  </span>
                )}
                {prePurchase.level === 'no_indicators' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    <IconCheck className="size-3.5" />
                    {t('prePurchase.levels.none.badge')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t(prePurchase.headlineKey as TranslationKey)}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {t(prePurchase.bodyKey as TranslationKey)}
              </p>
            </div>

            {/* Assessment Factors Grid */}
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {prePurchase.factors.map((factor) => {
                const statusColor =
                  factor.status === 'suspicious'
                    ? 'border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200'
                    : factor.status === 'caution'
                      ? 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
                      : factor.status === 'normal'
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400';

                return (
                  <div
                    key={factor.id}
                    className={`rounded-lg border p-3 text-xs leading-5 ${statusColor} print:border-slate-300`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{t(factor.labelKey as TranslationKey)}</span>
                      <span dir="ltr" className="font-mono">
                        {factor.rawText}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] opacity-90">
                      {t(factor.explanationKey as TranslationKey)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Raw Counters Table */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 print:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50">
              <h4 className="text-xs font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                {t('prePurchase.rawCountersTitle')}
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.distanceSinceClear')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {prePurchase.rawCounters.distanceSinceClearedKm !== null
                      ? prePurchase.rawCounters.distanceSinceClearedKm >= 65535
                        ? `${prePurchase.rawCounters.distanceSinceClearedKm} km (${t('prePurchase.counterAtMaxOrUnavailable')})`
                        : `${prePurchase.rawCounters.distanceSinceClearedKm} km`
                      : 'N/A'}
                  </span>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.warmupsSinceClear')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {prePurchase.rawCounters.warmupsSinceCleared !== null
                      ? prePurchase.rawCounters.warmupsSinceCleared >= 255
                        ? `${prePurchase.rawCounters.warmupsSinceCleared} (${t('prePurchase.counterAtMaxOrUnavailable')})`
                        : prePurchase.rawCounters.warmupsSinceCleared
                      : 'N/A'}
                  </span>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.timeSinceClear')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {prePurchase.rawCounters.timeSinceClearedMinutes !== null
                      ? prePurchase.rawCounters.timeSinceClearedMinutes >= 65535
                        ? `${prePurchase.rawCounters.timeSinceClearedMinutes} min (${t('prePurchase.counterAtMaxOrUnavailable')})`
                        : `${prePurchase.rawCounters.timeSinceClearedMinutes} min`
                      : 'N/A'}
                  </span>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.distanceWithMil')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {prePurchase.rawCounters.distanceWithMilKm !== null
                      ? `${prePurchase.rawCounters.distanceWithMilKm} km`
                      : 'N/A'}
                  </span>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.incompleteMonitors')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {`${prePurchase.rawCounters.incompleteMonitorsCount} / ${prePurchase.rawCounters.supportedMonitorsCount}`}
                  </span>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {t('prePurchase.counterLabels.permanentDtcCount')}
                  </span>
                  <span dir="ltr" className="font-mono font-semibold">
                    {prePurchase.rawCounters.permanentDtcCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Limitations Notice */}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('common.note')}:{' '}
              </span>
              {t(prePurchase.limitationsKey as TranslationKey)}
            </p>
          </section>
        )}

        {/* Trouble Codes Section */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('scan.resultTitle')}
          </h2>

          <DtcSectionGroup
            title={t('scan.storedTitle')}
            codes={data.storedCodes}
            badgeColor="rose"
            emptyText={t('scan.noCodes')}
          />

          <DtcSectionGroup
            title={t('scan.pendingTitle')}
            codes={data.pendingCodes}
            badgeColor="amber"
            emptyText={t('scan.noCodes')}
          />

          <DtcSectionGroup
            title={t('scan.permanentTitle')}
            codes={data.permanentCodes}
            badgeColor="slate"
            emptyText={t('scan.noCodes')}
          />
        </section>

        {/* Freeze Frame Section */}
        {data.freezeFrames.length > 0 && (
          <section className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 print:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t('scan.freezeTitle')}
            </h3>
            <div className="mt-3 space-y-3">
              {data.freezeFrames.map((frame, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 print:border-slate-200 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{t('scan.freezeFrame', { frame: frame.frame + 1 })}</span>
                    {frame.dtc && (
                      <span dir="ltr" className="font-mono text-rose-600 dark:text-rose-400">
                        {frame.dtc.code}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {(frame.readings ?? []).flatMap((reading) =>
                      reading.measurements.map((measurement, mIndex) => (
                        <div
                          key={`${reading.pid}-${mIndex}`}
                          className="rounded bg-white p-2 text-center print:border dark:bg-slate-950"
                        >
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                            {t(measurement.labelKey, measurement.labelParams ?? {})}
                          </span>
                          <span dir="ltr" className="font-mono font-semibold">
                            {measurement.value} {t(`scan.units.${measurement.unit}`)}
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Readiness Monitors Section */}
        {data.readiness && Array.isArray(data.readiness.monitors) && (
          <section className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 print:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t('scan.readinessTitle')}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.readiness.monitors.map((monitor) => (
                <div
                  key={monitor.key}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs print:border-slate-200 dark:border-slate-800/80 dark:bg-slate-900/60"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {t(`scan.monitors.${monitor.key}` as TranslationKey)}
                  </span>
                  {monitor.complete ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <IconCheck className="size-3.5" />
                      {t('scan.monitorComplete')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                      <IconAlert className="size-3.5" />
                      {t('scan.monitorIncomplete')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mandatory Disclaimer Footer */}
      <footer className="mt-8 break-inside-avoid border-t border-slate-200 pt-5 text-xs text-slate-500 print:border-slate-300 dark:border-slate-800 dark:text-slate-400">
        <h4 className="font-bold text-slate-700 dark:text-slate-300">
          {t('report.disclaimerTitle')}
        </h4>
        <p className="mt-1 leading-relaxed">{t('report.disclaimerBody')}</p>
        <p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">
          {t('report.mechanicDisclaimer')}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] print:border-slate-200 dark:border-slate-800/50">
          <span>{t('report.versionFooter', { version: '0.9.0-rc.1' })}</span>
          <span dir="ltr" className="font-mono">
            {new Date().toISOString().replace('T', ' ').slice(0, 19)}
          </span>
        </div>
      </footer>
    </article>
  );
}

function DtcSectionGroup({
  title,
  codes,
  badgeColor,
  emptyText,
}: {
  title: string;
  codes: readonly ReportDtcItem[];
  badgeColor: 'rose' | 'amber' | 'slate';
  emptyText: string;
}) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';

  if (codes.length === 0) {
    return (
      <div className="break-inside-avoid rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 print:border-slate-200 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{title}</span>
          <span className="text-slate-400">{emptyText}</span>
        </div>
      </div>
    );
  }

  const badgeClass =
    badgeColor === 'rose'
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
      : badgeColor === 'amber'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
          {codes.length}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {codes.map((item) => {
          const rec = item.lookup?.record;
          const descAr = rec?.descriptionAr;
          const descEn = rec?.descriptionEn;
          const causes = isAr ? rec?.possibleCausesAr : rec?.possibleCausesEn;
          const steps = isAr ? rec?.inspectionStepsAr : rec?.inspectionStepsEn;

          return (
            <div
              key={item.code}
              className="break-inside-avoid rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 text-xs print:border-slate-200 dark:border-slate-800/80 dark:bg-slate-900/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    dir="ltr"
                    className="font-mono text-sm font-bold text-slate-900 dark:text-white"
                  >
                    {item.code}
                  </span>
                  {rec?.severity && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {rec.severity === 'high'
                        ? t('scan.severities.high')
                        : rec.severity === 'medium'
                          ? t('scan.severities.medium')
                          : t('scan.severities.low')}
                    </span>
                  )}
                  {rec?.translationTier === 1 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {t('scan.dtcDraftReview')}
                    </span>
                  )}
                  {rec?.translationTier === 2 && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {t('scan.dtcUnreviewed')}
                    </span>
                  )}
                </div>
              </div>

              {/* Descriptions */}
              <div className="mt-2 space-y-1">
                {descAr && (
                  <p className="font-medium text-slate-800 dark:text-slate-200" dir="rtl">
                    {descAr}
                  </p>
                )}
                {descEn && (
                  <p className="text-slate-600 dark:text-slate-400" dir="ltr">
                    {descEn}
                  </p>
                )}
              </div>

              {/* Possible Causes */}
              {causes && causes.length > 0 && (
                <div className="mt-2.5 rounded bg-white p-2 print:border dark:bg-slate-950">
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">
                    {t('scan.dtcCauses')}:
                  </span>
                  <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[11px] text-slate-600 dark:text-slate-400">
                    {causes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Inspection Steps */}
              {steps && steps.length > 0 && (
                <div className="mt-2 rounded bg-white p-2 print:border dark:bg-slate-950">
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">
                    {t('scan.dtcSteps')}:
                  </span>
                  <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-[11px] text-slate-600 dark:text-slate-400">
                    {steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
