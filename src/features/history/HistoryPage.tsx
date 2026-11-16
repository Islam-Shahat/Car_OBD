import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../app/EmptyState';
import { IconAlert, IconCheck, IconHistory } from '../../app/icons';
import { PageHeader } from '../../app/PageHeader';
import { useStorage } from '../../lib/db/StorageProvider';
import type {
  DtcLookup,
  ReadinessSnapshot,
  ScanResultRow,
  ScanSession,
  Vehicle,
} from '../../lib/db/types';
import { evaluatePrePurchase } from '../../lib/obd/prePurchase';
import type { DriveHistory } from '../../lib/obd/pids';
import type { ReadinessStatus } from '../../lib/obd/readiness';
import { ReportModal } from '../reports/ReportModal';
import type { DiagnosticReportData, ReportDtcItem } from '../reports/reportTypes';
import { maskVin } from '../reports/whatsAppSummary';
import { ScanCompareModal } from './ScanCompareModal';

export function HistoryPage() {
  const { t, i18n } = useTranslation();
  const { repositories } = useStorage();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');

  // Compare selection
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareData, setCompareData] = useState<{
    sessionA: ScanSession;
    sessionB: ScanSession;
    resultsA: ScanResultRow[];
    resultsB: ScanResultRow[];
    readinessA: ReadinessSnapshot | null;
    readinessB: ReadinessSnapshot | null;
    vehicle: Vehicle | null;
  } | null>(null);

  // Delete confirm dialog
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Full Report View Modal
  const [reportModalData, setReportModalData] = useState<DiagnosticReportData | null>(null);

  const loadData = async () => {
    if (!repositories) return;
    setLoading(true);
    try {
      const [allSessions, allVehicles] = await Promise.all([
        repositories.scans.listSessions(),
        repositories.vehicles.list(),
      ]);
      setSessions(allSessions);
      setVehicles(allVehicles);
    } catch (err) {
      console.warn('Failed to load scan history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [repositories]);

  const filteredSessions =
    selectedVehicleId === 'all'
      ? sessions
      : sessions.filter((s) => s.vehicleId === selectedVehicleId);

  const handleToggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1] ?? '', id];
      }
      return [...prev, id];
    });
  };

  const handleOpenCompare = async () => {
    if (selectedForCompare.length !== 2 || !repositories) return;
    const [idA, idB] = selectedForCompare;
    const sessionA = sessions.find((s) => s.id === idA);
    const sessionB = sessions.find((s) => s.id === idB);
    if (!sessionA || !sessionB) return;

    try {
      const [resultsA, resultsB, readinessListA, readinessListB] = await Promise.all([
        repositories.scans.resultsFor(sessionA.id),
        repositories.scans.resultsFor(sessionB.id),
        repositories.scans.readinessFor(sessionA.id),
        repositories.scans.readinessFor(sessionB.id),
      ]);

      const vehicle = vehicles.find((v) => v.id === sessionA.vehicleId) ?? null;

      setCompareData({
        sessionA,
        sessionB,
        resultsA,
        resultsB,
        readinessA: readinessListA[0] ?? null,
        readinessB: readinessListB[0] ?? null,
        vehicle,
      });
      setCompareModalOpen(true);
    } catch (err) {
      console.warn('Failed to prepare scan comparison:', err);
    }
  };

  const handleViewReport = async (session: ScanSession) => {
    if (!repositories) return;
    try {
      const [results, readinessList, liveLogs] = await Promise.all([
        repositories.scans.resultsFor(session.id),
        repositories.scans.readinessFor(session.id),
        repositories.scans.liveDataFor(session.id),
      ]);

      const vehicle = vehicles.find((v) => v.id === session.vehicleId) ?? null;

      // Group DTC results
      const storedRows = results.filter((r) => r.type === 'stored');
      const pendingRows = results.filter((r) => r.type === 'pending');
      const permanentRows = results.filter((r) => r.type === 'permanent');

      // Fetch lookups
      const makeSlug = vehicle?.make ? vehicle.make.toLowerCase() : null;
      const getItems = async (rows: ScanResultRow[], type: 'stored' | 'pending' | 'permanent') => {
        return Promise.all(
          rows.map(async (r): Promise<ReportDtcItem> => {
            let lookup: DtcLookup | null = null;
            try {
              lookup = await repositories.dtc.lookup(r.code, makeSlug);
            } catch {
              lookup = null;
            }
            return { code: r.code, type, lookup };
          }),
        );
      };

      const [storedCodes, pendingCodes, permanentCodes] = await Promise.all([
        getItems(storedRows, 'stored'),
        getItems(pendingRows, 'pending'),
        getItems(permanentRows, 'permanent'),
      ]);

      const readinessSnapshot = readinessList[0]?.data as ReadinessStatus | undefined;

      // Reconstruct drive history from live logs if available
      const driveHistory: DriveHistory = {
        distanceSinceClearedKm: null,
        warmupsSinceCleared: null,
        timeSinceClearedMinutes: null,
        runTimeSeconds: null,
        distanceWithMilKm: null,
        timeWithMilMinutes: null,
      };

      for (const log of liveLogs) {
        if (log.pid === '0x31' && log.value !== null) {
          driveHistory.distanceSinceClearedKm = log.value;
        } else if (log.pid === '0x30' && log.value !== null) {
          driveHistory.warmupsSinceCleared = log.value;
        } else if (log.pid === '0x4E' && log.value !== null) {
          driveHistory.timeSinceClearedMinutes = log.value;
        } else if (log.pid === '0x1F' && log.value !== null) {
          driveHistory.runTimeSeconds = log.value;
        } else if (log.pid === '0x21' && log.value !== null) {
          driveHistory.distanceWithMilKm = log.value;
        } else if (log.pid === '0x4D' && log.value !== null) {
          driveHistory.timeWithMilMinutes = log.value;
        }
      }

      // Pre-purchase assessment
      const prePurchase = evaluatePrePurchase({
        status: readinessSnapshot ?? null,
        driveHistory,
        stored: storedCodes,
        pending: pendingCodes,
        permanent: permanentCodes,
      });

      // Freeze frames
      const freezeFrames = storedRows
        .filter((r) => r.freezeFrame !== null)
        .map((r) => r.freezeFrame!);

      const reportData: DiagnosticReportData = {
        id: session.id,
        mode: session.mode,
        isSampleData: session.sessionType !== 'real',
        scanDate: new Date(session.startedAt).toLocaleString(i18n.resolvedLanguage),
        vehicle: vehicle
          ? {
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              engine: vehicle.engine,
              vin: vehicle.vin,
            }
          : null,
        adapter: session.adapterInfo
          ? {
              identity: session.adapterInfo.identity,
              version: session.adapterInfo.version,
              protocol: session.adapterInfo.protocol,
            }
          : null,
        protocol: session.protocol,
        milStatus: session.milStatus
          ? { on: session.milStatus.on, dtcCount: session.milStatus.dtcCount }
          : null,
        overallStatus: session.overallStatus ?? 'healthy',
        storedCodes,
        pendingCodes,
        permanentCodes,
        readiness: readinessSnapshot ?? null,
        driveHistory,
        freezeFrames,
        prePurchase,
      };

      setReportModalData(reportData);
    } catch (err) {
      console.warn('Failed to load session report data:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || !repositories) return;
    try {
      await repositories.scans.softDelete(deleteConfirmId);
      setSessions((prev) => prev.filter((s) => s.id !== deleteConfirmId));
      setSelectedForCompare((prev) => prev.filter((id) => id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.warn('Failed to delete scan session:', err);
    }
  };

  return (
    <>
      <PageHeader title={t('pages.history.title')} subtitle={t('pages.history.subtitle')} />

      {/* Vehicle Filter & Compare Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <label htmlFor="vehicle-filter" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('history.filterByVehicle')}:
          </label>
          <select
            id="vehicle-filter"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{t('history.allVehicles')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make ?? ''} {v.model ?? ''} {v.year ? `(${v.year})` : ''} - {maskVin(v.vin)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selectedForCompare.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('history.selectToCompare')} ({selectedForCompare.length}/2)
            </span>
          )}
          <button
            type="button"
            disabled={selectedForCompare.length !== 2}
            onClick={() => void handleOpenCompare()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            {t('history.compareScans')}
          </button>
          {selectedForCompare.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t('history.cancelCompare')}
            </button>
          )}
        </div>
      </div>

      {/* Scans List or Empty State */}
      {loading ? (
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          {t('vehicles.loading')}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconHistory className="size-7" />}
            badge={t('pages.history.title')}
            title={t('history.noScansFound')}
            body={t('pages.history.emptyBody')}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filteredSessions.map((session) => {
            const vehicle = vehicles.find((v) => v.id === session.vehicleId);
            const isSelected = selectedForCompare.includes(session.id);
            const isPrePurchase = session.mode === 'pre_purchase';

            return (
              <div
                key={session.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-2xs transition-all ${
                  isSelected
                    ? 'border-sky-400 bg-sky-50/50 dark:border-sky-700 dark:bg-sky-950/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleCompare(session.id)}
                    aria-label={`Select scan from ${session.startedAt} for comparison`}
                    className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700"
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vehicle
                          ? `${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.year ? `(${vehicle.year})` : ''}`.trim() ||
                            'Car'
                          : 'Car'}
                      </span>
                      <span
                        dir="ltr"
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {maskVin(vehicle?.vin)}
                      </span>
                      {isPrePurchase && (
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          {t('prePurchase.badge')}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span dir="ltr" className="font-mono">
                        {new Date(session.startedAt).toLocaleString(i18n.resolvedLanguage)}
                      </span>
                      {session.protocol && (
                        <span>· {session.protocol}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      session.overallStatus === 'fault'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : session.overallStatus === 'warning'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {session.overallStatus === 'fault' ? (
                      <>
                        <IconAlert className="size-3" />
                        <span>{t('scan.overallFaultTitle', { count: '' })}</span>
                      </>
                    ) : session.overallStatus === 'warning' ? (
                      <>
                        <IconAlert className="size-3" />
                        <span>{t('scan.overallWarningTitle')}</span>
                      </>
                    ) : (
                      <>
                        <IconCheck className="size-3" />
                        <span>{t('scan.overallHealthyTitle')}</span>
                      </>
                    )}
                  </span>

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => void handleViewReport(session)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {t('history.viewReport')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(session.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                  >
                    {t('history.deleteScan')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('history.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
              {t('history.deleteConfirmBody')}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {t('history.deleteConfirmCancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                {t('history.deleteConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalData && (
        <ReportModal
          isOpen={true}
          data={reportModalData}
          onClose={() => setReportModalData(null)}
        />
      )}

      {/* Scan Compare Modal */}
      {compareData && (
        <ScanCompareModal
          isOpen={compareModalOpen}
          onClose={() => {
            setCompareModalOpen(false);
            setCompareData(null);
          }}
          sessionA={compareData.sessionA}
          sessionB={compareData.sessionB}
          resultsA={compareData.resultsA}
          resultsB={compareData.resultsB}
          readinessA={compareData.readinessA}
          readinessB={compareData.readinessB}
          vehicle={compareData.vehicle}
        />
      )}
    </>
  );
}
