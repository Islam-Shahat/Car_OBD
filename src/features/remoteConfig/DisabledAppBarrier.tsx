import { useTranslation } from 'react-i18next';
import { useRemoteConfigStore } from '../../lib/remoteConfig/remoteConfigStore';
import { IconAlert, IconRefresh } from '../../app/icons';

export interface DisabledAppBarrierProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function DisabledAppBarrier({ onRetry, isRetrying }: DisabledAppBarrierProps) {
  const { t, i18n } = useTranslation();
  const config = useRemoteConfigStore((state) => state.config);
  const isArabic = i18n.resolvedLanguage === 'ar';

  const customMessage = config.message
    ? isArabic
      ? config.message.ar || config.message.en
      : config.message.en || config.message.ar
    : null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disabled-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-slate-900 p-6 text-center text-slate-100 shadow-2xl">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
          <IconAlert className="size-8" />
        </div>

        <h1 id="disabled-title" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {t('remoteConfig.disabledTitle')}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {customMessage || t('remoteConfig.disabledDefaultMessage')}
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-start text-xs text-slate-400">
          <p className="font-semibold text-slate-300">{t('remoteConfig.securityNoticeTitle')}</p>
          <p className="mt-1">{t('remoteConfig.securityNoticeBody')}</p>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            {t('remoteConfig.issuedAt')}: {new Date(config.issued_at).toLocaleString()}
          </p>
        </div>

        {onRetry && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-red-500 focus:outline-hidden disabled:opacity-50"
            >
              <IconRefresh className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {t('common.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
