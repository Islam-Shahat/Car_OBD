import { useTranslation } from 'react-i18next';
import { IconAlert, IconCheck } from '../../app/icons';
import type { ReadinessSnapshot, ScanResultRow, ScanSession, Vehicle } from '../../lib/db/types';
import type { ReadinessStatus } from '../../lib/obd/readiness';
import { maskVin } from '../reports/whatsAppSummary';

interface ScanCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionA: ScanSession;
  sessionB: ScanSession;
  resultsA: ScanResultRow[];
  resultsB: ScanResultRow[];
  readinessA?: ReadinessSnapshot | null;
  readinessB?: ReadinessSnapshot | null;
  vehicle?: Vehicle | null;
}

export function ScanCompareModal({
  isOpen,
  onClose,
  sessionA,
  sessionB,
  resultsA,
  resultsB,
  readinessA,
  readinessB,
  vehicle,
}: ScanCompareModalProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';

  if (!isOpen) return null;

  // Ensure chronological order: A is earlier, B is later
  const [older, newer, oldResults, newResults, oldReadiness, newReadiness] =
    new Date(sessionA.startedAt).getTime() <= new Date(sessionB.startedAt).getTime()
      ? [sessionA, sessionB, resultsA, resultsB, readinessA, readinessB]
      : [sessionB, sessionA, resultsB, resultsA, readinessB, readinessA];

  const oldCodes = Array.from(new Set(oldResults.map((r) => r.code)));
  const newCodes = Array.from(new Set(newResults.map((r) => r.code)));

  const resolvedCodes = oldCodes.filter((c) => !newCodes.includes(c));
  const persistentCodes = oldCodes.filter((c) => newCodes.includes(c));
  const freshCodes = newCodes.filter((c) => !oldCodes.includes(c));

  const oldMonitors = (oldReadiness?.data as ReadinessStatus | undefined)?.monitors ?? [];
  const newMonitors = (newReadiness?.data as ReadinessStatus | undefined)?.monitors ?? [];

  const vehicleTitle = vehicle
    ? `${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.year ? `(${vehicle.year})` : ''}`.trim() ||
      (isAr ? 'مركبة' : 'Vehicle')
    : isAr
      ? 'مركبة'
      : 'Vehicle';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('history.comparing')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {vehicleTitle} · {maskVin(vehicle?.vin)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t('report.close')}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Side-by-side Session Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                {t('history.olderScan')}
              </span>
              <p
                dir="ltr"
                className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white"
              >
                {new Date(older.startedAt).toLocaleString(i18n.resolvedLanguage)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">
                  {older.mode === 'pre_purchase'
                    ? t('prePurchase.badge')
                    : t('report.badgeStandard')}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {oldCodes.length} {isAr ? 'أكواد' : 'codes'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
              <span className="text-[11px] font-semibold text-sky-700 uppercase dark:text-sky-300">
                {t('history.newerScan')}
              </span>
              <p
                dir="ltr"
                className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white"
              >
                {new Date(newer.startedAt).toLocaleString(i18n.resolvedLanguage)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="rounded bg-sky-200 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                  {newer.mode === 'pre_purchase'
                    ? t('prePurchase.badge')
                    : t('report.badgeStandard')}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {newCodes.length} {isAr ? 'أكواد' : 'codes'}
                </span>
              </div>
            </div>
          </div>

          {/* DTC Diff Summary */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('scan.resultTitle')}
            </h3>

            {/* Resolved */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    {t('history.diffCodesResolved')} ({resolvedCodes.length})
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  {t('history.diffCodesResolvedDesc')}
                </span>
              </div>
              {resolvedCodes.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {resolvedCodes.map((code) => (
                    <span
                      key={code}
                      dir="ltr"
                      className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 font-mono text-xs font-bold text-emerald-800 shadow-2xs dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('scan.noCodes')}
                </p>
              )}
            </div>

            {/* Persistent */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconAlert className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {t('history.diffCodesPersistent')} ({persistentCodes.length})
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  {t('history.diffCodesPersistentDesc')}
                </span>
              </div>
              {persistentCodes.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {persistentCodes.map((code) => (
                    <span
                      key={code}
                      dir="ltr"
                      className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-mono text-xs font-bold text-amber-800 shadow-2xs dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('scan.noCodes')}
                </p>
              )}
            </div>

            {/* New */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconAlert className="size-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    {t('history.diffCodesNew')} ({freshCodes.length})
                  </span>
                </div>
                <span className="text-[11px] text-rose-700 dark:text-rose-300">
                  {t('history.diffCodesNewDesc')}
                </span>
              </div>
              {freshCodes.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {freshCodes.map((code) => (
                    <span
                      key={code}
                      dir="ltr"
                      className="rounded-md border border-rose-300 bg-white px-2.5 py-1 font-mono text-xs font-bold text-rose-800 shadow-2xs dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('scan.noCodes')}
                </p>
              )}
            </div>
          </div>

          {/* Readiness Monitor Changes */}
          {oldMonitors.length > 0 && newMonitors.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 uppercase dark:text-slate-300">
                {t('history.diffMonitorsTitle')}
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {newMonitors.map((nm) => {
                  const om = oldMonitors.find((m) => m.key === nm.key);
                  const statusChanged = om && om.complete !== nm.complete;

                  return (
                    <div
                      key={nm.key}
                      className={`flex items-center justify-between rounded-lg border p-2 text-xs ${
                        statusChanged
                          ? 'border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40'
                          : 'border-slate-100 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/40'
                      }`}
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {t(`scan.monitors.${nm.key}`)}
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className={om?.complete ? 'text-emerald-600' : 'text-rose-600'}>
                          {om?.complete ? 'Ready' : 'Not Ready'}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span
                          className={
                            nm.complete ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'
                          }
                        >
                          {nm.complete ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
