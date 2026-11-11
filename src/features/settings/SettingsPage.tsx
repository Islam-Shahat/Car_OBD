import { useTranslation } from 'react-i18next';

import { PageHeader } from '../../app/PageHeader';
import { LANGUAGES, type LanguageCode } from '../../lib/i18n/direction';
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

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('pages.settings.about')}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t('app.name')} — {t('app.tagline')}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          {t('app.version', { version: __APP_VERSION__ })}
        </p>
      </section>
    </>
  );
}
