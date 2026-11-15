import type { Repositories } from '../../lib/db/repositories';
import type { LiveDataLogInput } from '../../lib/db/types';
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
