import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { IconAlert, IconGauge, IconRefresh } from '../../app/icons';
import { errorMessage } from '../elm327/errors';
import type { Repositories } from './repositories';
import { openTauriStorage, type Storage } from './runtime';

export type StorageStatus = 'loading' | 'ready' | 'error';

export interface StorageState {
  status: StorageStatus;
  storage: Storage | null;
  repositories: Repositories | null;
  error: string | null;
}

const StorageContext = createContext<StorageState>({
  status: 'loading',
  storage: null,
  repositories: null,
  error: null,
});

/**
 * Opens SQLite once for the whole app. A storage failure never blocks a scan;
 * it only disables the operations that need durable data (clear backup,
 * vehicles, code explanations).
 */
export function StorageProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<StorageState>({
    status: 'loading',
    storage: null,
    repositories: null,
    error: null,
  });
  const [bypassedError, setBypassedError] = useState(false);

  const initStorage = useCallback(() => {
    setState((curr) => ({ ...curr, status: 'loading', error: null }));
    let cancelled = false;

    openTauriStorage()
      .then((storage) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          storage,
          repositories: storage.repositories,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          storage: null,
          repositories: null,
          error: errorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = initStorage();
    return cleanup;
  }, [initStorage]);

  const value = useMemo(() => state, [state]);

  if (state.status === 'loading') {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 px-6 text-white select-none">
        <div className="relative mb-6 flex size-20 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20">
          <IconGauge className="size-10 text-white animate-pulse" />
          <span className="absolute -inset-1 rounded-2xl border border-blue-400/30 animate-ping opacity-30" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{t('app.name')}</h1>
        <p className="mt-1 text-xs text-slate-400">{t('app.tagline')}</p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-2/5 rounded-full bg-blue-500 animate-[pulse_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs font-medium text-slate-300">{t('app.loadingDatabase')}</p>
        </div>

        <div className="mt-12 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-800/60 px-3 py-1 text-[11px] text-slate-400">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>{t('app.offline')}</span>
        </div>
      </div>
    );
  }

  if (state.status === 'error' && !bypassedError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 px-6 text-white select-none">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <IconAlert className="size-8" />
        </div>
        <h1 className="text-lg font-bold">{t('app.databaseError')}</h1>
        {state.error && (
          <p
            dir="ltr"
            className="mt-2 max-w-md text-center font-mono text-xs text-slate-400 break-words"
          >
            {state.error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void initStorage()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <IconRefresh className="size-3.5" />
            {t('common.retry')}
          </button>
          <button
            type="button"
            onClick={() => setBypassedError(true)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-700 px-4 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            {t('vehicles.storageUnavailable')}
          </button>
        </div>
      </div>
    );
  }

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageState {
  return useContext(StorageContext);
}
