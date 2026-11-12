import type { AdapterInfo } from '../elm327/driver';
import type { Dtc } from './dtc';
import type { PidReading } from './pids';
import type { ReadinessStatus } from './readiness';
import type { VinResult } from './vin';

export type ScanWarningCode =
  | 'pids-unavailable'
  | 'pid-no-data'
  | 'mode-unsupported'
  | 'vin-unavailable'
  | 'vin-invalid'
  | 'freeze-frame-unavailable'
  | 'dtc-count-mismatch'
  | 'malformed-response';

export interface ScanWarning {
  code: ScanWarningCode;
  pid?: number;
  mode?: number;
  reported?: number;
  received?: number;
  detail?: string;
}

export type ScanStep =
  'pids' | 'status' | 'dtc' | 'vin' | 'live' | 'freeze' | 'backup' | 'clear' | 'verify' | 'done';

export interface ScanProgress {
  step: ScanStep;
  completed: number;
  total: number;
}

export type ScanProgressListener = (progress: ScanProgress) => void;

export interface FreezeFrame {
  /** Freeze-frame index requested from the ECU (0 = first stored DTC). */
  frame: number;
  /** DTC reported by Mode 02 PID 02, when the ECU provides it. */
  dtc: Dtc | null;
  readings: PidReading[];
}

export interface DtcModeSupport {
  stored: boolean;
  pending: boolean;
  permanent: boolean;
  freezeFrame: boolean;
}

export interface ScanResult {
  adapter: AdapterInfo;
  protocol: string | null;
  vin: VinResult | null;
  status: ReadinessStatus | null;
  stored: Dtc[];
  pending: Dtc[];
  permanent: Dtc[];
  modeSupport: DtcModeSupport;
  freezeFrames: FreezeFrame[];
  live: PidReading[];
  supportedPids: number[];
  warnings: ScanWarning[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ClearResult {
  backupId: string;
  clearedAt: string;
  before: ScanResult;
  /** `null` when the verification re-scan failed after the ECU accepted Mode 04. */
  after: ScanResult | null;
  verificationError: string | null;
  returningCodes: Dtc[];
}
