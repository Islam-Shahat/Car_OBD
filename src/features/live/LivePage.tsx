import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { EmptyState } from '../../app/EmptyState';
import { PageHeader } from '../../app/PageHeader';
import { IconActivity, IconDownload, IconPlay, IconPlug, IconSquare } from '../../app/icons';
import { useStorage } from '../../lib/db/StorageProvider';
import { convertMeasurement } from '../../lib/obd/units';
import { LivePoller } from '../../lib/obd/livePoller';
import type { PidReading } from '../../lib/obd/pids';
import { useConnectionStore } from '../connection/connectionStore';
import { useSelectedVehicleStore } from '../vehicles/vehicleStore';
import { FuelTrimView } from './FuelTrimView';
import { Gauge } from './Gauge';
import { LiveChart } from './LiveChart';
import { O2SensorView } from './O2SensorView';
import { downloadCsv, formatTelemetryCsv, saveLiveRecordingSession } from './liveRecording';
import { useLiveStore } from './liveStore';

type ActiveTab = 'gauges' | 'charts' | 'fuelTrim' | 'o2';

type PidLabelKey =
  | 'scan.pids.rpm'
  | 'scan.pids.speed'
  | 'scan.pids.coolantTemp'
  | 'scan.pids.engineLoad'
  | 'scan.pids.throttle'
  | 'scan.pids.intakeTemp'
  | 'scan.pids.maf'
  | 'scan.pids.shortFuelTrim'
  | 'scan.pids.longFuelTrim'
  | 'scan.pids.o2Voltage';

interface PidOption {
  pid: number;
  labelKey: PidLabelKey;
  category: 'core' | 'air-fuel' | 'o2';
}

const AVAILABLE_PIDS: readonly PidOption[] = [
  { pid: 0x0c, labelKey: 'scan.pids.rpm', category: 'core' },
  { pid: 0x0d, labelKey: 'scan.pids.speed', category: 'core' },
  { pid: 0x05, labelKey: 'scan.pids.coolantTemp', category: 'core' },
  { pid: 0x04, labelKey: 'scan.pids.engineLoad', category: 'core' },
  { pid: 0x11, labelKey: 'scan.pids.throttle', category: 'core' },
  { pid: 0x0f, labelKey: 'scan.pids.intakeTemp', category: 'core' },
  { pid: 0x10, labelKey: 'scan.pids.maf', category: 'core' },
  { pid: 0x06, labelKey: 'scan.pids.shortFuelTrim', category: 'air-fuel' },
  { pid: 0x07, labelKey: 'scan.pids.longFuelTrim', category: 'air-fuel' },
  { pid: 0x08, labelKey: 'scan.pids.shortFuelTrim', category: 'air-fuel' },
  { pid: 0x09, labelKey: 'scan.pids.longFuelTrim', category: 'air-fuel' },
  { pid: 0x14, labelKey: 'scan.pids.o2Voltage', category: 'o2' },
  { pid: 0x15, labelKey: 'scan.pids.o2Voltage', category: 'o2' },
  { pid: 0x18, labelKey: 'scan.pids.o2Voltage', category: 'o2' },
  { pid: 0x19, labelKey: 'scan.pids.o2Voltage', category: 'o2' },
];

export function LivePage() {
  const { t } = useTranslation();
  const { repositories } = useStorage();
  const selectedVehicle = useSelectedVehicleStore((s) => s.selected);
  const info = useConnectionStore((s) => s.info);
  const sessionType = useConnectionStore((s) => s.sessionType);
  const [activeTab, setActiveTab] = useState<ActiveTab>('gauges');
  const [pidsOpen, setPidsOpen] = useState(false);

  const phase = useConnectionStore((s) => s.phase);
  const driver = useConnectionStore((s) => s.driver);

  const {
    status,
    selectedPids,
    readings,
    history,
    rateHz,
    units,
    isRecording,
    recordedSamples,
    setStatus,
    togglePid,
    setUnits,
    startRecording,
    stopRecording,
  } = useLiveStore();

  const pollerRef = useRef<LivePoller | null>(null);

  // Initialize or re-create LivePoller when driver or connection changes
  useEffect(() => {
    if (!driver || phase !== 'connected') {
      if (pollerRef.current) {
        void pollerRef.current.stop();
        pollerRef.current = null;
      }
      useLiveStore.getState().setStatus('stopped');
      return;
    }

    const poller = new LivePoller(driver, {
      pids: useLiveStore.getState().selectedPids,
      onReading: (reading: PidReading) => {
        useLiveStore.getState().updateReading(reading);
      },
      onRate: (hz: number) => {
        useLiveStore.getState().setRateHz(hz);
      },
      onError: (err) => {
        console.warn('Live telemetry poll error:', err);
      },
    });

    pollerRef.current = poller;
    poller.start();
    useLiveStore.getState().setStatus('polling');

    return () => {
      void poller.stop();
      pollerRef.current = null;
    };
  }, [driver, phase]);

  // Synchronize active PIDs with poller instance
  useEffect(() => {
    if (pollerRef.current) {
      pollerRef.current.setPids(selectedPids);
    }
  }, [selectedPids]);

  const togglePolling = () => {
    if (!pollerRef.current) return;
    if (status === 'polling' || status === 'recording') {
      pollerRef.current.pause();
      setStatus('paused');
    } else {
      pollerRef.current.resume();
      setStatus('polling');
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
      if (repositories && recordedSamples.length > 0) {
        void saveLiveRecordingSession(repositories, recordedSamples, {
          vehicleId: selectedVehicle?.id ?? null,
          protocol: info?.protocol,
          adapterInfo: info,
          sessionType,
        }).catch((err) => {
          console.warn('Failed to save recorded live session:', err);
        });
      }
    } else {
      if (status === 'paused' || status === 'stopped') {
        pollerRef.current?.resume();
      }
      startRecording();
    }
  };

  const handleExportCsv = async () => {
    if (recordedSamples.length === 0) return;
    const csv = formatTelemetryCsv(recordedSamples);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCsv(`live-telemetry-${dateStr}.csv`, csv);

    if (repositories) {
      try {
        await saveLiveRecordingSession(repositories, recordedSamples, {
          vehicleId: selectedVehicle?.id ?? null,
          protocol: info?.protocol,
          adapterInfo: info,
          sessionType,
        });
      } catch (err) {
        console.warn('Failed to persist live recording session on export:', err);
      }
    }
  };

  if (phase !== 'connected') {
    return (
      <div className="space-y-6">
        <PageHeader title={t('pages.live.title')} subtitle={t('pages.live.subtitle')} />
        <EmptyState
          icon={<IconPlug className="size-7" />}
          badge={t('live.stopped')}
          title={t('pages.live.notConnectedTitle')}
          body={t('pages.live.notConnectedBody')}
        />
        <div className="flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlug className="size-4" />
            {t('nav.connect')}
          </Link>
        </div>
      </div>
    );
  }

  // Extract primary gauges data (RPM, Speed, Coolant)
  const rawRpm = readings[0x0c]?.measurements[0]?.value ?? 0;
  const rawSpeed = readings[0x0d]?.measurements[0]?.value ?? 0;
  const rawCoolant = readings[0x05]?.measurements[0]?.value ?? 0;

  const convertedSpeed = convertMeasurement(rawSpeed, 'kmh', units);
  const convertedCoolant = convertMeasurement(rawCoolant, 'celsius', units);

  const speedMax = units.speed === 'mph' ? 160 : 240;
  const speedWarning = units.speed === 'mph' ? 85 : 130;
  const speedDanger = units.speed === 'mph' ? 110 : 160;

  const coolantMin = units.temperature === 'fahrenheit' ? 32 : -40;
  const coolantMax = units.temperature === 'fahrenheit' ? 260 : 130;
  const coolantWarning = units.temperature === 'fahrenheit' ? 212 : 100;
  const coolantDanger = units.temperature === 'fahrenheit' ? 235 : 115;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={t('pages.live.title')} subtitle={t('pages.live.subtitle')} />

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Rate indicator */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span
              className={`size-2 rounded-full ${
                status === 'polling' || status === 'recording'
                  ? 'animate-pulse bg-emerald-500'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-mono tabular-nums">
              {status === 'paused' ? t('live.paused') : t('live.rate', { hz: rateHz.toFixed(1) })}
            </span>
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={togglePolling}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
              status === 'polling' || status === 'recording'
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {status === 'polling' || status === 'recording' ? (
              <>
                <IconSquare className="size-3.5 fill-current" />
                {t('live.pausePolling')}
              </>
            ) : (
              <>
                <IconPlay className="size-3.5 fill-current" />
                {t('live.resumePolling')}
              </>
            )}
          </button>

          {/* Record Button */}
          <button
            type="button"
            onClick={handleToggleRecording}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
              isRecording
                ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 animate-pulse'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <span className={`size-2 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
            {isRecording ? t('live.stopRecord') : t('live.record')}
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={recordedSamples.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title={t('live.samplesRecorded', { count: recordedSamples.length })}
          >
            <IconDownload className="size-3.5" />
            {t('live.exportCsv')}
            {recordedSamples.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] dark:bg-slate-700">
                {recordedSamples.length}
              </span>
            )}
          </button>

          {/* Unit Toggle Dropdowns / Toggles */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() =>
                setUnits({
                  temperature: units.temperature === 'celsius' ? 'fahrenheit' : 'celsius',
                })
              }
              className="rounded px-2 py-1 font-semibold text-slate-700 transition-colors hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('live.tempUnit')}
            >
              {units.temperature === 'celsius' ? '°C' : '°F'}
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() =>
                setUnits({
                  speed: units.speed === 'kmh' ? 'mph' : 'kmh',
                })
              }
              className="rounded px-2 py-1 font-semibold text-slate-700 transition-colors hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('live.speedUnit')}
            >
              {units.speed === 'kmh' ? 'km/h' : 'mph'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs and PID Filter toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
          {(
            [
              { id: 'gauges', label: t('live.tabGauges') },
              { id: 'charts', label: t('live.tabCharts') },
              { id: 'fuelTrim', label: t('live.tabFuelTrim') },
              { id: 'o2', label: t('live.tabO2') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPidsOpen(!pidsOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <IconActivity className="size-3.5 text-blue-600 dark:text-blue-400" />
          {t('live.selectPids')} ({selectedPids.length})
        </button>
      </div>

      {/* PID Selector Drawer / Panel */}
      {pidsOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {t('live.selectPids')}
            </h4>
            <span className="text-[11px] text-slate-500">
              {selectedPids.length} active (sequential poll)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_PIDS.map((item) => {
              const active = selectedPids.includes(item.pid);
              const hex = `0x${item.pid.toString(16).toUpperCase().padStart(2, '0')}`;
              const label = t(item.labelKey, { bank: 1, sensor: 1 });
              return (
                <button
                  key={item.pid}
                  type="button"
                  onClick={() => togglePid(item.pid)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 font-semibold'
                      : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-75">{hex}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: GAUGES DASHBOARD */}
      {activeTab === 'gauges' && (
        <div className="space-y-6">
          {/* Primary 3 Gauges */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Gauge
              label={t('scan.pids.rpm')}
              value={rawRpm}
              min={0}
              max={8000}
              unit="RPM"
              warningThreshold={5500}
              dangerThreshold={6500}
            />
            <Gauge
              label={t('scan.pids.speed')}
              value={convertedSpeed.value}
              min={0}
              max={speedMax}
              unit={convertedSpeed.displayUnit}
              warningThreshold={speedWarning}
              dangerThreshold={speedDanger}
            />
            <Gauge
              label={t('scan.pids.coolantTemp')}
              value={convertedCoolant.value}
              min={coolantMin}
              max={coolantMax}
              unit={convertedCoolant.displayUnit}
              warningThreshold={coolantWarning}
              dangerThreshold={coolantDanger}
            />
          </div>

          {/* Secondary Live Value Cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {selectedPids
              .filter((p) => p !== 0x0c && p !== 0x0d && p !== 0x05)
              .map((pid) => {
                const reading = readings[pid];
                const primary = reading?.measurements[0];
                if (!primary) return null;
                const converted = convertMeasurement(primary.value, primary.unit, units);
                const hex = `0x${pid.toString(16).toUpperCase().padStart(2, '0')}`;
                return (
                  <div
                    key={pid}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t(primary.labelKey, primary.labelParams ?? {})}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{hex}</span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {converted.decimals > 0
                          ? converted.value.toFixed(converted.decimals)
                          : Math.round(converted.value)}
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {converted.displayUnit}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: ROLLING CHARTS */}
      {activeTab === 'charts' && (
        <div className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {selectedPids.map((pid) => {
              const pts = history[pid] ?? [];
              const def = AVAILABLE_PIDS.find((p) => p.pid === pid);
              const reading = readings[pid];
              const m = reading?.measurements[0];
              const unit = m ? convertMeasurement(m.value, m.unit, units).displayUnit : '';
              const label = def
                ? t(def.labelKey, { bank: 1, sensor: 1 })
                : `PID 0x${pid.toString(16)}`;

              // Convert history values according to units preference
              const convertedPts = pts.map((pt) => ({
                ts: pt.ts,
                value: m ? convertMeasurement(pt.value, m.unit, units).value : pt.value,
              }));

              return (
                <LiveChart key={pid} label={label} data={convertedPts} unit={unit} height={190} />
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FUEL TRIMS */}
      {activeTab === 'fuelTrim' && <FuelTrimView readings={readings} />}

      {/* TAB 4: O2 SENSORS */}
      {activeTab === 'o2' && <O2SensorView readings={readings} history={history} />}
    </div>
  );
}
