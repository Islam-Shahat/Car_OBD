import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PageHeader } from '../../app/PageHeader';
import { IconAlert, IconCar, IconCheck, IconPlug, IconRefresh, IconScan } from '../../app/icons';
import { ERROR_MESSAGE_KEYS } from '../../lib/i18n/errorKeys';
import type { SerialPortInfo } from '../../lib/elm327/serialTransport';
import { useConnectionStore } from './connectionStore';
import { ConnectionStatusPanel } from './ConnectionStatusPanel';

const PORT_KIND_KEYS = {
  usb: 'connection.portKind.usb',
  bluetooth: 'connection.portKind.bluetooth',
  pci: 'connection.portKind.pci',
  unknown: 'connection.portKind.unknown',
} as const satisfies Record<SerialPortInfo['kind'], string>;

export function ConnectionPage() {
  const { t } = useTranslation();
  const {
    phase,
    ports,
    portsLoading,
    selectedPort,
    info,
    failure,
    refreshPorts,
    selectPort,
    connect,
    disconnect,
  } = useConnectionStore();

  useEffect(() => {
    void refreshPorts();
  }, [refreshPorts]);

  const busy = phase === 'connecting';
  const connected = phase === 'connected';

  return (
    <>
      <PageHeader title={t('pages.connect.title')} subtitle={t('pages.connect.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">{t('connection.title')}</h2>

          <label
            htmlFor="port-select"
            className="mt-4 block text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {t('connection.port')}
          </label>

          <div className="mt-1 flex gap-2">
            <select
              id="port-select"
              value={selectedPort ?? ''}
              onChange={(event) => selectPort(event.target.value)}
              disabled={busy || connected}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="" disabled>
                {t('connection.selectPort')}
              </option>
              {ports.map((port) => (
                <option key={port.name} value={port.name}>
                  {port.name} — {t(PORT_KIND_KEYS[port.kind])}
                  {port.label ? ` (${port.label})` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void refreshPorts()}
              disabled={busy || connected || portsLoading}
              aria-label={t('connection.refresh')}
              title={t('connection.refresh')}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <IconRefresh className={`size-4 ${portsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {ports.length === 0 && !portsLoading && (
            <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
              {t('connection.noPorts')}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {!connected && (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={!selectedPort || busy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconPlug className="size-4" />
                {busy ? t('connection.connecting') : t('connection.connect')}
              </button>
            )}

            {connected && (
              <button
                type="button"
                onClick={() => void disconnect()}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('connection.disconnect')}
              </button>
            )}
          </div>

          {failure && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
            >
              <p className="flex items-start gap-2">
                <IconAlert className="mt-0.5 size-4 shrink-0" />
                <span>{t(ERROR_MESSAGE_KEYS[failure.code])}</span>
              </p>
              {failure.detail && (
                <p className="mt-2 ps-6 font-mono text-xs break-words opacity-80">
                  {failure.detail}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <ConnectionStatusPanel phase={phase} info={info} />

          {connected && (
            <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
                <IconCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('connection.connectedTitle')}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {info?.protocol ?? t('connection.protocolUnknown')}
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  to="/scan"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <IconScan className="size-4" />
                  {t('connection.proceedToScan')}
                </Link>
                <Link
                  to="/vehicles"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
                >
                  <IconCar className="size-4" />
                  {t('connection.proceedToVehicles')}
                </Link>
              </div>
            </section>
          )}

          {!connected && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <IconPlug className="size-4 text-blue-600 dark:text-blue-400" />
                <span>{t('connection.plugInGuideTitle')}</span>
              </h3>
              <ol className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li className="leading-5">{t('connection.plugInStep1')}</li>
                <li className="leading-5">{t('connection.plugInStep2')}</li>
                <li className="leading-5">{t('connection.plugInStep3')}</li>
              </ol>
            </section>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {t('app.disclaimerShort')}
      </p>
    </>
  );
}
