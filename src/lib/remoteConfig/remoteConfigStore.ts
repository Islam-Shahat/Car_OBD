import { create } from 'zustand';
import { CURRENT_APP_VERSION, FALLBACK_REMOTE_CONFIG } from './defaults';
import type { RemoteConfigFetchStatus, RemoteConfigPayload } from './types';
import { compareSemver } from './version';

export interface RemoteConfigState {
  config: RemoteConfigPayload;
  status: RemoteConfigFetchStatus;
  error: string | null;
  pendingConfig: RemoteConfigPayload | null;
  isUpdateRequired: boolean;
  isUpdateAvailable: boolean;

  // Actions
  setConfig: (
    config: RemoteConfigPayload,
    status?: RemoteConfigFetchStatus,
    error?: string | null,
  ) => void;
  setPendingConfig: (pending: RemoteConfigPayload | null) => void;
  applyPendingConfig: () => void;
  isFeatureEnabled: (feature: string) => boolean;
}

export const useRemoteConfigStore = create<RemoteConfigState>((set, get) => ({
  config: FALLBACK_REMOTE_CONFIG,
  status: 'idle',
  error: null,
  pendingConfig: null,
  isUpdateRequired: false,
  isUpdateAvailable: false,

  setConfig: (config, status = 'success', error = null) => {
    const isUpdateRequired = compareSemver(CURRENT_APP_VERSION, config.min_version) < 0;
    const isUpdateAvailable = compareSemver(CURRENT_APP_VERSION, config.latest_version) < 0;
    set({
      config,
      status,
      error,
      isUpdateRequired,
      isUpdateAvailable,
    });
  },

  setPendingConfig: (pendingConfig) => set({ pendingConfig }),

  applyPendingConfig: () => {
    const { pendingConfig } = get();
    if (!pendingConfig) return;
    const isUpdateRequired = compareSemver(CURRENT_APP_VERSION, pendingConfig.min_version) < 0;
    const isUpdateAvailable = compareSemver(CURRENT_APP_VERSION, pendingConfig.latest_version) < 0;
    set({
      config: pendingConfig,
      pendingConfig: null,
      isUpdateRequired,
      isUpdateAvailable,
    });
  },

  isFeatureEnabled: (feature: string) => {
    const { config } = get();
    // If entire app is disabled, features are off
    if (!config.app_enabled) return false;
    const val = config.features[feature];
    // Default to true if not explicitly disabled in feature map
    return val !== false;
  },
}));

/**
 * Convenient React hook to read a specific feature flag.
 */
export function useFeatureFlag(feature: string): boolean {
  return useRemoteConfigStore((state) => state.isFeatureEnabled(feature));
}
