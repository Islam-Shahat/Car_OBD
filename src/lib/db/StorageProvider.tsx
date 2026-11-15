import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
  const [state, setState] = useState<StorageState>({
    status: 'loading',
    storage: null,
    repositories: null,
    error: null,
  });

  useEffect(() => {
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

  const value = useMemo(() => state, [state]);
  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageState {
  return useContext(StorageContext);
}
