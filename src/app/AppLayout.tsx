import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { useTheme } from '../lib/theme/useTheme';
import { isDevPreview } from '../lib/db/runtime';
import { useStorage } from '../lib/db/StorageProvider';
import { useConnectionStore } from '../features/connection/connectionStore';
import { GITHUB_RELEASES_URL } from '../lib/projectUrls';
import { useFeatureFlag, useRemoteConfigStore } from '../lib/remoteConfig/remoteConfigStore';
import { RemoteConfigService } from '../lib/remoteConfig/remoteConfigService';
import { DisabledAppBarrier } from '../features/remoteConfig/DisabledAppBarrier';
import { MandatoryUpdatePrompt } from '../features/remoteConfig/MandatoryUpdatePrompt';
import {
  IconActivity,
  IconCar,
  IconDownload,
  IconGauge,
  IconGlobe,
  IconHistory,
  IconMoon,
  IconScan,
  IconSliders,
  IconSun,
} from './icons';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.connect', Icon: IconGauge, end: true },
  { to: '/scan', labelKey: 'nav.scan', Icon: IconScan, end: false },
  { to: '/live', labelKey: 'nav.live', Icon: IconActivity, end: false },
  { to: '/vehicles', labelKey: 'nav.vehicles', Icon: IconCar, end: false },
  { to: '/history', labelKey: 'nav.history', Icon: IconHistory, end: false },
  { to: '/settings', labelKey: 'nav.settings', Icon: IconSliders, end: false },
] as const;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { resolved, setPreference } = useTheme();
  const isDemo = useConnectionStore((state) => state.isDemo);
  const { repositories } = useStorage();

  const config = useRemoteConfigStore((state) => state.config);
  const isUpdateRequired = useRemoteConfigStore((state) => state.isUpdateRequired);
  const isUpdateAvailable = useRemoteConfigStore((state) => state.isUpdateAvailable);
  const liveDataEnabled = useFeatureFlag('live_data');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!repositories) return;
    const service = new RemoteConfigService({ repository: repositories.remoteConfig });
    void service.sync().then((res) => {
      useRemoteConfigStore.getState().setConfig(res.config, res.status, res.error);
    });
  }, [repositories]);

  const handleRetrySync = () => {
    if (!repositories || retrying) return;
    setRetrying(true);
    const service = new RemoteConfigService({ repository: repositories.remoteConfig });
    void service.sync().then((res) => {
      useRemoteConfigStore.getState().setConfig(res.config, res.status, res.error);
      setRetrying(false);
    });
  };

  const navItems = NAV_ITEMS.filter((item) => {
    if (item.to === '/live' && !liveDataEnabled) return false;
    return true;
  });

  const nextLanguage = i18n.resolvedLanguage === 'ar' ? 'en' : 'ar';
  const languageBadge = nextLanguage === 'en' ? 'EN' : 'ع';

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-e border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <IconGauge className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{t('app.name')}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {t('app.tagline')}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label={t('app.name')}>
          {navItems.map(({ to, labelKey, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="size-5 shrink-0" />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            {t('app.offline')}
          </p>
          <p className="mt-1 font-mono">{t('app.version', { version: __APP_VERSION__ })}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isDevPreview() && (
          <div
            role="region"
            aria-label="Browser preview notice"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-500/15 px-6 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 uppercase">
                {t('app.previewBadge')}
              </span>
              <span>{t('app.previewBannerAr')}</span>
              <span className="opacity-40">|</span>
              <span dir="ltr">{t('app.previewBannerEn')}</span>
            </div>
            {isDemo && (
              <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                {t('app.demoActiveBadge')}
              </span>
            )}
          </div>
        )}

        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t('app.disclaimerShort')}
          </p>

          <div className="flex items-center gap-2">
            {isUpdateAvailable && (
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-700/50 dark:bg-blue-950/40 dark:text-blue-300"
              >
                <IconDownload className="size-3.5" />
                <span>{t('remoteConfig.updateAvailable', { version: config.latest_version })}</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => void i18n.changeLanguage(nextLanguage)}
              aria-label={t('common.switchLanguage')}
              title={t('common.switchLanguage')}
              className="flex h-9 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <IconGlobe className="size-4 text-slate-500 dark:text-slate-400" />
              <span lang={nextLanguage}>{languageBadge}</span>
            </button>

            <button
              type="button"
              onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={t('common.toggleTheme')}
              title={t('common.toggleTheme')}
              className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {resolved === 'dark' ? (
                <IconSun className="size-4" />
              ) : (
                <IconMoon className="size-4" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>

        {!config.app_enabled && (
          <DisabledAppBarrier onRetry={handleRetrySync} isRetrying={retrying} />
        )}
        {config.app_enabled && isUpdateRequired && <MandatoryUpdatePrompt />}
      </div>
    </div>
  );
}
