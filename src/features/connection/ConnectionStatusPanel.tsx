import { useTranslation } from 'react-i18next';

import { IconAlert, IconCheck } from '../../app/icons';
import type { ConnectionInfo } from '../../lib/elm327/connect';

export function ConnectionStatusPanel({
  phase,
  info,
}: {
  phase: 'idle' | 'connecting' | 'connected';
  info: ConnectionInfo | null;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">{t('connection.statusTitle')}</h2>

      <div aria-live="polite" className="mt-3">
        {phase === 'idle' && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('connection.statusIdle')}</p>
        )}

        {phase === 'connecting' && (
          <p className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span
              className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400"
              aria-hidden="true"
            />
            {t('connection.statusConnecting')}
          </p>
        )}

        {phase === 'connected' && info && (
          <div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">{t('connection.adapter')}</dt>
              <dd className="font-medium">{info.identity}</dd>

              {info.description && (
                <>
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t('connection.description')}
                  </dt>
                  <dd>{info.description}</dd>
                </>
              )}

              <dt className="text-slate-500 dark:text-slate-400">{t('connection.protocol')}</dt>
              <dd>{info.protocol ?? t('connection.protocolUnknown')}</dd>

              <dt className="text-slate-500 dark:text-slate-400">{t('connection.ecu')}</dt>
              <dd>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    info.ecuPresent
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {info.ecuPresent ? (
                    <IconCheck className="size-3.5" />
                  ) : (
                    <IconAlert className="size-3.5" />
                  )}
                  {info.ecuPresent ? t('connection.ecuFound') : t('connection.ecuNotFound')}
                </span>
              </dd>

              <dt className="text-slate-500 dark:text-slate-400">{t('connection.baud')}</dt>
              <dd>{info.baudRate}</dd>

              <dt className="text-slate-500 dark:text-slate-400">
                {t('connection.adapterTimeout')}
              </dt>
              <dd>{info.adapterTimeoutMs} ms</dd>
            </dl>

            {!info.ecuPresent && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-semibold">{t('connection.ecuMissingTitle')}</p>
                <p className="mt-1">{t('connection.ecuMissingBody')}</p>
              </div>
            )}

            {info.likelyClone && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-semibold">{t('connection.cloneTitle')}</p>
                <p className="mt-1">
                  {t('connection.cloneBody', { version: info.version ?? '?' })}
                </p>
              </div>
            )}

            {info.limitedCommands && (
              <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <p className="font-semibold">{t('connection.limitedTitle')}</p>
                <p className="mt-1">{t('connection.limitedBody')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
