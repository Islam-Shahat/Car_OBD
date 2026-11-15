export interface RemoteConfigMessage {
  ar: string;
  en: string;
}

export interface RemoteFeatureFlags {
  clear_codes: boolean;
  live_data: boolean;
  pre_purchase_report: boolean;
  [key: string]: boolean;
}

export interface DtcPackDescriptor {
  version: string;
  url: string;
  signature: string;
}

export interface RemoteConfigPayload {
  app_enabled: boolean;
  min_version: string;
  latest_version: string;
  message: RemoteConfigMessage | null;
  features: RemoteFeatureFlags;
  dtc_pack?: DtcPackDescriptor;
  issued_at: string;
}

export interface SignedRemoteConfigEnvelope {
  config: RemoteConfigPayload;
  signature: string;
}

export type RemoteConfigFetchStatus =
  'idle' | 'fetching' | 'success' | 'offline_cached' | 'fallback_default' | 'error';
