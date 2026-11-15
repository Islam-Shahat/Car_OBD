import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { useTheme } from '../lib/theme/useTheme';
import {
  IconCar,
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
  { to: '/vehicles', labelKey: 'nav.vehicles', Icon: IconCar, end: false },
  { to: '/history', labelKey: 'nav.history', Icon: IconHistory, end: false },
  { to: '/settings', labelKey: 'nav.settings', Icon: IconSliders, end: false },
] as const;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const { resolved, setPreference } = useTheme();

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
          {NAV_ITEMS.map(({ to, labelKey, Icon, end }) => (
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
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t('app.disclaimerShort')}
          </p>

          <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
