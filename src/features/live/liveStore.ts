import { create } from 'zustand';

import type { PidReading } from '../../lib/obd/pids';
import { DEFAULT_UNIT_PREFERENCES, type UnitPreferences } from '../../lib/obd/units';

export interface TimePoint {
  ts: number;
  value: number;
}

export interface RecordedSample {
  pid: number;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

export type LivePollingStatus = 'stopped' | 'polling' | 'paused' | 'recording';

export interface LiveState {
  status: LivePollingStatus;
  selectedPids: number[];
  readings: Record<number, PidReading>;
  history: Record<number, TimePoint[]>;
  rateHz: number;
  units: UnitPreferences;

  // Recording session
  isRecording: boolean;
  recordingStartedAt: string | null;
  recordedSamples: RecordedSample[];

  // Actions
  setStatus: (status: LivePollingStatus) => void;
  setSelectedPids: (pids: number[]) => void;
  togglePid: (pid: number) => void;
  setUnits: (units: Partial<UnitPreferences>) => void;
  updateReading: (reading: PidReading) => void;
  setRateHz: (hz: number) => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearRecording: () => void;
  resetAll: () => void;
}

/** Keep at most 60 seconds or 300 samples per PID in the rolling window */
const MAX_HISTORY_POINTS = 300;
const MAX_HISTORY_WINDOW_MS = 60000;

export const DEFAULT_LIVE_PIDS = [0x0c, 0x0d, 0x05, 0x04]; // RPM, Speed, Coolant, Engine Load

export const useLiveStore = create<LiveState>((set) => ({
  status: 'stopped',
  selectedPids: DEFAULT_LIVE_PIDS,
  readings: {},
  history: {},
  rateHz: 0,
  units: DEFAULT_UNIT_PREFERENCES,

  isRecording: false,
  recordingStartedAt: null,
  recordedSamples: [],

  setStatus: (status) => set({ status }),

  setSelectedPids: (selectedPids) => set({ selectedPids }),

  togglePid: (pid) =>
    set((state) => {
      const exists = state.selectedPids.includes(pid);
      if (exists) {
        if (state.selectedPids.length <= 1) return state; // Keep at least 1 PID
        return { selectedPids: state.selectedPids.filter((p) => p !== pid) };
      }
      return { selectedPids: [...state.selectedPids, pid] };
    }),

  setUnits: (partialUnits) =>
    set((state) => ({
      units: { ...state.units, ...partialUnits },
    })),

  updateReading: (reading) =>
    set((state) => {
      const now = Date.now();
      const primaryMeasurement = reading.measurements[0];
      const val = primaryMeasurement?.value ?? 0;

      // Update rolling history with fixed capacity (no memory growth)
      const existingHistory = state.history[reading.pid] ?? [];
      const cutoff = now - MAX_HISTORY_WINDOW_MS;
      const filtered = existingHistory.filter((pt) => pt.ts >= cutoff);
      filtered.push({ ts: now, value: val });
      if (filtered.length > MAX_HISTORY_POINTS) {
        filtered.splice(0, filtered.length - MAX_HISTORY_POINTS);
      }

      // If recording is active, append to recorded samples
      let newRecordedSamples = state.recordedSamples;
      if (state.isRecording && primaryMeasurement) {
        newRecordedSamples = [
          ...state.recordedSamples,
          {
            pid: reading.pid,
            name: primaryMeasurement.labelKey,
            value: primaryMeasurement.value,
            unit: primaryMeasurement.unit,
            timestamp: new Date(now).toISOString(),
          },
        ];
      }

      return {
        readings: { ...state.readings, [reading.pid]: reading },
        history: { ...state.history, [reading.pid]: filtered },
        recordedSamples: newRecordedSamples,
      };
    }),

  setRateHz: (rateHz) => set({ rateHz }),

  startRecording: () =>
    set({
      isRecording: true,
      status: 'recording',
      recordingStartedAt: new Date().toISOString(),
      recordedSamples: [],
    }),

  stopRecording: () =>
    set((state) => ({
      isRecording: false,
      status: state.status === 'recording' ? 'polling' : state.status,
    })),

  clearRecording: () =>
    set({
      isRecording: false,
      recordingStartedAt: null,
      recordedSamples: [],
    }),

  resetAll: () =>
    set({
      status: 'stopped',
      readings: {},
      history: {},
      rateHz: 0,
      isRecording: false,
      recordingStartedAt: null,
      recordedSamples: [],
    }),
}));
