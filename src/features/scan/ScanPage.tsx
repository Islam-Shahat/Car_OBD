import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../app/EmptyState';
import { PageHeader } from '../../app/PageHeader';
import { IconAlert, IconCheck, IconScan } from '../../app/icons';
import { useStorage } from '../../lib/db/StorageProvider';
import { isTauriEnvironment } from '../../lib/db/runtime';
import type { LiveDataLogInput, ScanResultInput } from '../../lib/db/types';
import type { Elm327Driver } from '../../lib/elm327/driver';
import type { ConnectionInfo } from '../../lib/elm327/connect';
import { errorMessage, isElmError } from '../../lib/elm327/errors';
import {
  ERROR_MESSAGE_KEYS,
  nrcMessageKey,
  type ErrorMessageKey,
  type NrcMessageKey,
} from '../../lib/i18n/errorKeys';
import { isObdError } from '../../lib/obd/errors';
import { ScanService } from '../../lib/obd/scanService';
import type { ClearResult, ScanProgress, ScanResult, ScanStep } from '../../lib/obd/scanTypes';
import { useConnectionStore } from '../connection/connectionStore';
import { useLiveStore } from '../live/liveStore';
import { useFeatureFlag, useRemoteConfigStore } from '../../lib/remoteConfig/remoteConfigStore';
import { useSelectedVehicleStore } from '../vehicles/vehicleStore';
import { ScanResultView } from './ScanResultView';

const STEP_KEYS = {
  pids: 'scan.steps.pids',
  status: 'scan.steps.status',
  dtc: 'scan.steps.dtc',
  vin: 'scan.steps.vin',
  live: 'scan.steps.live',
  freeze: 'scan.steps.freeze',
  backup: 'scan.steps.backup',
  clear: 'scan.steps.clear',
  verify: 'scan.steps.verify',
  done: 'scan.steps.done',
} as const satisfies Record<ScanStep, string>;

const SCAN_ERROR_KEYS = {
  scanFailed: 'scan.errors.scanFailed',
  clearFailed: 'scan.errors.clearFailed',
  busy: 'scan.errors.busy',
  refused: 'scan.errors.refused',
  backupFailed: 'scan.errors.backupFailed',
  rejected: 'scan.errors.rejected',
  malformed: 'scan.errors.malformed',
  storageUnavailable: 'scan.errors.storageUnavailable',
} as const;

type FailureKey =
  ErrorMessageKey | NrcMessageKey | (typeof SCAN_ERROR_KEYS)[keyof typeof SCAN_ERROR_KEYS];

interface Failure {
  key: FailureKey;
  detail: string;
}

function failureFor(error: unknown, kind: 'scan' | 'clear'): Failure {
  let key: FailureKey = kind === 'clear' ? SCAN_ERROR_KEYS.clearFailed : SCAN_ERROR_KEYS.scanFailed;

  if (isObdError(error)) {
    if (error.nrc !== undefined) {
      key = nrcMessageKey(error.nrc);
    } else {
      switch (error.code) {
        case 'busy':
          key = SCAN_ERROR_KEYS.busy;
          break;
        case 'clear-refused':
          key = SCAN_ERROR_KEYS.refused;
          break;
        case 'backup-failed':
          key = SCAN_ERROR_KEYS.backupFailed;
          break;
        case 'clear-failed':
          key = SCAN_ERROR_KEYS.clearFailed;
          break;
        case 'service-rejected':
          key = SCAN_ERROR_KEYS.rejected;
          break;
        case 'malformed-response':
          key = SCAN_ERROR_KEYS.malformed;
          break;
      }
    }
  } else if (isElmError(error)) {
    // Serial/protocol failures already have friendly Arabic and English messages.
    key = ERROR_MESSAGE_KEYS[error.code];
  }

  return { key, detail: errorMessage(error) };
}

/** PID 010C is displayed live only when the ECU claims it; above zero means running. */
function engineIsRunning(result: ScanResult): boolean {
  const rpm = result.live.find((reading) => reading.pid === 0x0c)?.measurements[0]?.value;
  return rpm !== undefined && rpm > 0;
}

/**
 * Mounted only while a connection is open, so every session starts with empty
 * scan state; disconnecting unmounts this subtree and discards the old car.
 */
function ScanSession({ driver, info }: { driver: Elm327Driver; info: ConnectionInfo }) {
  const { t, i18n } = useTranslation();
  const identityCache = useConnectionStore((state) => state.identityCache);
  const isDemo = useConnectionStore((state) => state.isDemo);
  const { repositories, status: storageStatus, error: storageError } = useStorage();

  const [result, setResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [scanMode, setScanMode] = useState<'normal' | 'pre_purchase'>('normal');

  const service = useMemo(
    () => new ScanService(driver, info, identityCache ? { identityCache } : {}),
    [driver, info, identityCache],
  );
  const clearCodesEnabled = useFeatureFlag('clear_codes');
  const busy = scanning || clearing;
  const canClear =
    !busy &&
    clearCodesEnabled &&
    repositories !== null &&
    result !== null &&
    result.stored.length + result.pending.length > 0;

  const runScan = async () => {
    if (busy) return;
    useLiveStore.getState().setStatus('stopped');
    setScanning(true);
    setFailure(null);
    setClearResult(null);
    setProgress(null);
    setResult(null);
    try {
      const scan = await service.runFullScan(setProgress);
      setResult(scan);

      // Auto-persist scan session to SQLite
      if (repositories) {
        try {
          const selectedVehicle = useSelectedVehicleStore.getState().selected;
          const overallStatus =
            scan.stored.length > 0 || scan.status?.mil.on
              ? 'fault'
              : scan.pending.length > 0
                ? 'warning'
                : 'healthy';

          const session = await repositories.scans.createSession({
            vehicleId: selectedVehicle?.id ?? null,
            startedAt: new Date(Date.now() - scan.durationMs).toISOString(),
            finishedAt: new Date(scan.finishedAt).toISOString(),
            protocol: scan.protocol,
            adapterInfo: scan.adapter,
            milStatus: scan.status?.mil ?? null,
            overallStatus,
            mode: scanMode,
            sessionType: useConnectionStore.getState().sessionType,
          });

          const dtcResults: ScanResultInput[] = [
            ...scan.stored.map((d) => ({
              code: d.code,
              type: 'stored' as const,
              freezeFrame: scan.freezeFrames.find((f) => f.dtc?.code === d.code) ?? null,
            })),
            ...scan.pending.map((d) => ({ code: d.code, type: 'pending' as const })),
            ...scan.permanent.map((d) => ({ code: d.code, type: 'permanent' as const })),
          ];
          if (dtcResults.length > 0) {
            await repositories.scans.addResults(session.id, dtcResults);
          }

          if (scan.status) {
            await repositories.scans.addReadiness(session.id, 'initial', scan.status);
          }

          const liveLogs: LiveDataLogInput[] = scan.live.flatMap((r) =>
            r.measurements.map((m) => ({
              pid: `0x${r.pid.toString(16).toUpperCase().padStart(2, '0')}`,
              value: m.value,
              unit: m.unit,
              ts: new Date(scan.finishedAt).toISOString(),
            })),
          );
          if (liveLogs.length > 0) {
            await repositories.scans.addLiveData(session.id, liveLogs);
          }
        } catch (persistErr) {
          // Persistence failure must never block scan results display
          console.warn('Auto-persist scan session failed:', persistErr);
        }
      }
    } catch (error) {
      setFailure(failureFor(error, 'scan'));
    } finally {
      setScanning(false);
      useRemoteConfigStore.getState().applyPendingConfig();
    }
  };

  const runClear = async () => {
    if (busy) return;
    if (!repositories || (isTauriEnvironment() && !repositories.scanBackups.isDurable)) {
      setConfirmOpen(false);
      setFailure({
        key: SCAN_ERROR_KEYS.storageUnavailable,
        detail:
          storageError ??
          'Durable SQLite storage is required before clearing codes in the desktop app',
      });
      return;
    }
    setConfirmOpen(false);
    useLiveStore.getState().setStatus('stopped');
    setClearing(true);
    setFailure(null);
    setProgress(null);
    try {
      const cleared = await service.clearStoredCodes({
        backupRepository: repositories.scanBackups,
        confirm: true,
        requireDurable: isTauriEnvironment(),
        onProgress: setProgress,
      });
      setClearResult(cleared);
      if (cleared.after) setResult(cleared.after);
    } catch (error) {
      setFailure(failureFor(error, 'clear'));
    } finally {
      setClearing(false);
      useRemoteConfigStore.getState().applyPendingConfig();
    }
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="rounded-xl border border-purple-300 bg-purple-50/80 p-3 text-xs font-semibold text-purple-900 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200">
          <span className="me-2 rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
            {t('connection.demoBadge')}
          </span>
          {t('scan.demoNotice')}
        </div>
      )}

      {storageStatus === 'error' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">{t('scan.storageUnavailable')}</p>
          {storageError && (
            <p dir="ltr" className="mt-1 font-mono text-xs opacity-70">
              {storageError}
            </p>
          )}
        </div>
      )}

      {/* Scan Mode Selection */}
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        <button
          type="button"
          onClick={() => setScanMode('normal')}
          disabled={busy}
          className={`flex-1 rounded-lg px-4 py-2.5 text-center text-xs transition-all ${
            scanMode === 'normal'
              ? 'bg-white font-bold text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
              : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <div className="text-xs font-bold">{t('prePurchase.modeNormal')}</div>
          <div className="mt-0.5 text-[11px] font-normal opacity-75">{t('prePurchase.modeNormalDesc')}</div>
        </button>

        <button
          type="button"
          onClick={() => setScanMode('pre_purchase')}
          disabled={busy}
          className={`flex-1 rounded-lg px-4 py-2.5 text-center text-xs transition-all ${
            scanMode === 'pre_purchase'
              ? 'bg-sky-600 font-bold text-white shadow-2xs dark:bg-sky-500'
              : 'font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <div className="text-xs font-bold">{t('prePurchase.modePrePurchase')}</div>
          <div className="mt-0.5 text-[11px] font-normal opacity-85">{t('prePurchase.modePrePurchaseDesc')}</div>
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => void runScan()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void runScan();
              }
            }}
            disabled={busy}
            className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-blue-600 px-6 text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconScan className={`size-5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? t('scan.scanning') : t('scan.start')}
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canClear}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-amber-300 px-5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
          >
            {clearing ? t('scan.clearing') : t('scan.clear')}
          </button>

          {result && !canClear && result.stored.length + result.pending.length === 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('scan.clearNoCodes')}
            </span>
          )}

          {result && !clearCodesEnabled && result.stored.length + result.pending.length > 0 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {t('remoteConfig.clearDisabledRemotely')}
            </span>
          )}
        </div>

        {progress && busy && (
          <div aria-live="polite" className="mt-4">
            <div className="flex items-baseline justify-between gap-4 text-xs">
              <span className="font-medium">{t(STEP_KEYS[progress.step])}</span>
              <span dir="ltr" className="font-mono text-slate-500 dark:text-slate-400">
                {progress.completed} / {progress.total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {failure && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          >
            <p className="flex items-start gap-2">
              <IconAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t(failure.key)}</span>
            </p>
            <p dir="ltr" className="mt-2 ps-6 font-mono text-xs break-words opacity-80">
              {failure.detail}
            </p>
          </div>
        )}
      </section>

      {clearResult && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <h2 className="flex items-center gap-2 font-semibold dark:text-emerald-200">
            <IconCheck className="size-4" />
            {t('scan.clearResultTitle')}
          </h2>
          <p className="mt-2 text-slate-700 dark:text-slate-200">
            {t('scan.backupSaved', { id: clearResult.backupId })}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            {t('scan.clearedAt', {
              time: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(clearResult.clearedAt)),
            })}
          </p>

          <p
            dir="ltr"
            className="mt-2 rounded-lg bg-white/70 px-3 py-2 font-mono text-xs font-semibold text-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
          >
            {t(`scan.clearOutcomes.${clearResult.outcome}`)}
          </p>

          {clearResult.outcome === 'verification_failed' && clearResult.verificationError && (
            <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              {t('scan.verificationFailed')}
              <span dir="ltr" className="mt-1 block font-mono text-xs opacity-80">
                {clearResult.verificationError}
              </span>
            </p>
          )}

          {clearResult.returningCodes.length > 0 && (
            <div className="mt-3">
              <p className="font-medium">{t('scan.returningCodesTitle')}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {clearResult.returningCodes.map((dtc) => (
                  <li
                    key={dtc.code}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-mono text-xs font-bold text-amber-800 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-300"
                  >
                    {dtc.code}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
            {t('scan.clearOutcomeNote')}
          </p>
        </section>
      )}

      {result && <ScanResultView result={result} mode={scanMode} isDemo={isDemo} />}

      {confirmOpen && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-dialog-title"
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 id="clear-dialog-title" className="flex items-center gap-2 text-lg font-semibold">
              <IconAlert className="size-5 text-amber-600 dark:text-amber-400" />
              {t('scan.clearConfirmTitle')}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {t('scan.clearConfirmBody')}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('scan.clearConfirmCounts', {
                stored: result.stored.length,
                pending: result.pending.length,
              })}
            </p>
            {engineIsRunning(result) && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs leading-6 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                <IconAlert className="mt-1 size-3.5 shrink-0" />
                <span>{t('scan.engineRunningWarning')}</span>
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('scan.clearConfirmKeep')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => void runClear()}
                className="inline-flex h-10 items-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
              >
                {t('scan.clearConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScanPage() {
  const { t } = useTranslation();
  const { phase, info, driver } = useConnectionStore();

  return (
    <>
      <PageHeader title={t('pages.scan.title')} subtitle={t('pages.scan.subtitle')} />

      {phase === 'connected' && driver && info ? (
        <ScanSession driver={driver} info={info} />
      ) : (
        <EmptyState
          icon={<IconScan className="size-7" />}
          badge={t('pages.scan.badge')}
          title={t('pages.scan.notConnectedTitle')}
          body={t('pages.scan.notConnectedBody')}
        />
      )}
    </>
  );
}
