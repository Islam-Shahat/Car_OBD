import type { Repositories } from '../../lib/db/repositories';
import type { LiveDataLogInput, SessionType } from '../../lib/db/types';
import type { AdapterInfo } from '../../lib/elm327/driver';
import type { RecordedSample } from './liveStore';

/**
 * Formats an array of recorded telemetry samples into RFC 4180 compliant CSV.
 */
export function formatTelemetryCsv(samples: readonly RecordedSample[]): string {
  const headers = ['Timestamp', 'PID', 'Hex', 'Parameter', 'Value', 'Unit'];
  const rows = samples.map((sample) => {
    const hex = `0x${sample.pid.toString(16).toUpperCase().padStart(2, '0')}`;
    const name = sample.name.replace('scan.pids.', '');
    return [
      sample.timestamp,
      sample.pid.toString(),
      hex,
      `"${name.replace(/"/g, '""')}"`,
      sample.value.toString(),
      `"${sample.unit.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Triggers a browser/desktop download for the generated CSV text.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Persists recorded samples into SQLite live_data_logs via repositories.
 */
export async function persistRecordedSamples(
  repositories: Repositories,
  sessionId: string,
  samples: readonly RecordedSample[],
): Promise<void> {
  if (samples.length === 0) return;

  const logs: LiveDataLogInput[] = samples.map((s) => ({
    pid: `0x${s.pid.toString(16).toUpperCase().padStart(2, '0')}`,
    value: s.value,
    unit: s.unit,
    ts: s.timestamp,
  }));

  await repositories.scans.addLiveData(sessionId, logs);
}

/**
 * Persists recorded samples into SQLite live_data_logs under a new scan_session via repositories.
 */
export async function saveLiveRecordingSession(
  repositories: Repositories,
  samples: readonly RecordedSample[],
  options?: {
    vehicleId?: string | null;
    protocol?: string | null;
    adapterInfo?: AdapterInfo | null;
    sessionType?: SessionType;
  },
): Promise<string | null> {
  if (samples.length === 0) return null;

  const startedAt = samples[0]?.timestamp ?? new Date().toISOString();
  const finishedAt = samples[samples.length - 1]?.timestamp ?? new Date().toISOString();

  const session = await repositories.scans.createSession({
    vehicleId: options?.vehicleId ?? null,
    startedAt,
    finishedAt,
    protocol: options?.protocol ?? null,
    adapterInfo: options?.adapterInfo ?? null,
    milStatus: null,
    overallStatus: 'healthy',
    mode: 'normal',
    sessionType: options?.sessionType ?? 'unknown',
  });

  await persistRecordedSamples(repositories, session.id, samples);
  return session.id;
}
