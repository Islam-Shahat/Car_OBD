import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '../../app/PageHeader';
import { IconCheck, IconDownload, IconRefresh } from '../../app/icons';
import { useStorage } from '../../lib/db/StorageProvider';
import { downloadTrafficLog, trafficLogger } from '../../lib/elm327/trafficLogger';
import { LANGUAGES, type LanguageCode } from '../../lib/i18n/direction';
import { GITHUB_RELEASES_URL } from '../../lib/projectUrls';
import { RemoteConfigService } from '../../lib/remoteConfig/remoteConfigService';
import { useRemoteConfigStore } from '../../lib/remoteConfig/remoteConfigStore';
import { useTheme } from '../../lib/theme/useTheme';
import type { ThemePreference } from '../../lib/theme/theme';

const LANGUAGE_LABEL_KEYS: Record<LanguageCode, 'languages.ar' | 'languages.en'> = {
  ar: 'languages.ar',
  en: 'languages.en',
};

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  labelKey: 'pages.settings.themeLight' | 'pages.settings.themeDark' | 'pages.settings.themeSystem';
}> = [
  { value: 'light', labelKey: 'pages.settings.themeLight' },
  { value: 'dark', labelKey: 'pages.settings.themeDark' },
  { value: 'system', labelKey: 'pages.settings.themeSystem' },
];

function optionClass(active: boolean): string {
  const base = 'rounded-lg border px-3 py-2 text-sm font-medium transition-colors';
  return active
    ? `${base} border-blue-600 bg-blue-600/10 text-blue-700 dark:border-blue-500 dark:text-blue-300`
    : `${base} border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();
  const { repositories } = useStorage();

  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<'available' | 'uptodate' | 'error' | null>(null);
  const [loggingEnabled, setLoggingEnabled] = useState(() => trafficLogger.isEnabled());
  const [logCount, setLogCount] = useState(() => trafficLogger.getEntries().length);
  const config = useRemoteConfigStore((state) => state.config);
  const isUpdateAvailable = useRemoteConfigStore((state) => state.isUpdateAvailable);

  const handleToggleLogging = () => {
    const next = !loggingEnabled;
    trafficLogger.setEnabled(next);
    setLoggingEnabled(next);
    setLogCount(trafficLogger.getEntries().length);
  };

  const handleExportLog = () => {
    const logContent = trafficLogger.exportLog({
      appVersion: __APP_VERSION__,
    });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTrafficLog(`elm327-traffic-${dateStr}.log`, logContent);
  };

  const handleClearLog = () => {
    trafficLogger.clear();
    setLogCount(0);
  };

  const handleCheckUpdates = async () => {
    if (!repositories || checking) return;
    setChecking(true);
    setCheckStatus(null);
    try {
      const service = new RemoteConfigService({ repository: repositories.remoteConfig });
      const res = await service.sync();
      useRemoteConfigStore.getState().setConfig(res.config, res.status, res.error);
      if (res.isUpdateAvailable) {
        setCheckStatus('available');
      } else {
        setCheckStatus('uptodate');
      }
    } catch {
      setCheckStatus('error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <PageHeader title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">{t('pages.settings.language')}</h2>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label={t('pages.settings.language')}
          >
            {LANGUAGES.map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={i18n.resolvedLanguage === language}
                onClick={() => void i18n.changeLanguage(language)}
                className={optionClass(i18n.resolvedLanguage === language)}
                lang={language}
              >
                {t(LANGUAGE_LABEL_KEYS[language])}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">{t('pages.settings.appearance')}</h2>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label={t('pages.settings.appearance')}
          >
            {THEME_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
                className={optionClass(preference === value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <h2 className="text-sm font-semibold">{t('pages.settings.safetyTitle')}</h2>
        <p className="mt-1 text-sm leading-7">{t('pages.settings.safetyBody')}</p>
      </section>

      {/* Privacy and Transparency */}
      <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-5 text-sm dark:border-blue-900/40 dark:bg-blue-950/20">
        <h2 className="text-sm font-semibold text-blue-950 dark:text-blue-200">
          {t('pages.settings.privacyTitle')}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-blue-900/80 dark:text-blue-300/80">
          {t('pages.settings.privacyBody')}
        </p>
      </section>

      {/* Raw ELM327 Traffic Logging */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{t('pages.settings.trafficLogTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('pages.settings.trafficLogDesc')}
            </p>
            <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300">
              {t('pages.settings.trafficLogEntries', { count: logCount })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLogging}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                loggingEnabled
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {loggingEnabled
                ? t('pages.settings.trafficLogDisable')
                : t('pages.settings.trafficLogEnable')}
            </button>

            <button
              type="button"
              onClick={handleExportLog}
              disabled={logCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <IconDownload className="size-3.5" />
              {t('pages.settings.trafficLogExport')}
            </button>

            <button
              type="button"
              onClick={handleClearLog}
              disabled={logCount === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {t('pages.settings.trafficLogClear')}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{t('pages.settings.about')}</h2>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {t('app.name')} — {t('app.tagline')}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              {t('app.version', { version: __APP_VERSION__ })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => void handleCheckUpdates()}
              disabled={checking}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <IconRefresh className={`size-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? t('remoteConfig.checking') : t('remoteConfig.checkUpdates')}
            </button>

            {checkStatus === 'uptodate' && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <IconCheck className="size-3.5" />
                {t('remoteConfig.upToDate')}
              </span>
            )}

            {checkStatus === 'available' && isUpdateAvailable && (
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                <IconDownload className="size-3.5" />
                {t('remoteConfig.updateAvailable', { version: config.latest_version })}
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
