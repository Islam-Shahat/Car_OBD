import { useTranslation } from 'react-i18next';
import { GITHUB_RELEASES_URL } from '../../lib/projectUrls';
import { useRemoteConfigStore } from '../../lib/remoteConfig/remoteConfigStore';
import { CURRENT_APP_VERSION } from '../../lib/remoteConfig/defaults';
import { IconDownload, IconAlert } from '../../app/icons';

export function MandatoryUpdatePrompt() {
  const { t } = useTranslation();
  const config = useRemoteConfigStore((state) => state.config);

  const openReleases = () => {
    window.open(GITHUB_RELEASES_URL, '_blank');
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-900 p-6 text-center text-slate-100 shadow-2xl">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
          <IconAlert className="size-8" />
        </div>

        <h1
          id="update-required-title"
          className="text-xl font-bold tracking-tight text-white sm:text-2xl"
        >
          {t('remoteConfig.updateRequiredTitle')}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {t('remoteConfig.updateRequiredMessage')}
        </p>

        <div className="mt-5 flex justify-center gap-6 text-xs text-slate-400">
          <div>
            <span className="block text-slate-500">{t('remoteConfig.currentVersion')}</span>
            <span className="font-mono font-bold text-slate-300">v{CURRENT_APP_VERSION}</span>
          </div>
          <div className="border-e border-slate-700" />
          <div>
            <span className="block text-slate-500">{t('remoteConfig.requiredVersion')}</span>
            <span className="font-mono font-bold text-amber-400">v{config.min_version}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={openReleases}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-amber-400 focus:outline-hidden"
          >
            <IconDownload className="size-4" />
            {t('remoteConfig.downloadUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}
