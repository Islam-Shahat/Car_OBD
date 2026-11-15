import type { DtcLookup } from '../../lib/db/types';
import type { DriveHistory } from '../../lib/obd/pids';
import type { ReadinessStatus } from '../../lib/obd/readiness';
import type { FreezeFrame } from '../../lib/obd/scanTypes';
import type { PrePurchaseAssessment } from '../../lib/obd/prePurchase';

export interface ReportDtcItem {
  code: string;
  type: 'stored' | 'pending' | 'permanent';
  lookup?: DtcLookup | null;
}

export interface ReportVehicleInfo {
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  vin: string | null;
}

export interface ReportAdapterInfo {
  identity: string;
  version: string | null;
  protocol: string | null;
}

export interface DiagnosticReportData {
  id?: string;
  mode: 'normal' | 'pre_purchase';
  isSampleData?: boolean;
  scanDate: string;
  vehicle: ReportVehicleInfo | null;
  adapter: ReportAdapterInfo | null;
  protocol: string | null;
  milStatus: {
    on: boolean;
    dtcCount: number;
  } | null;
  overallStatus: 'fault' | 'warning' | 'healthy' | string;
  storedCodes: readonly ReportDtcItem[];
  pendingCodes: readonly ReportDtcItem[];
  permanentCodes: readonly ReportDtcItem[];
  readiness: ReadinessStatus | null;
  driveHistory: DriveHistory;
  freezeFrames: readonly FreezeFrame[];
  prePurchase?: PrePurchaseAssessment | null;
}
