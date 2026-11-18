import { describe, expect, it, beforeEach } from 'vitest';

import { createInMemoryRepositories } from '../src/lib/db/inMemoryRepositories';
import type { Elm327Driver } from '../src/lib/elm327/driver';
import { LivePoller } from '../src/lib/obd/livePoller';
import type { PidReading } from '../src/lib/obd/pids';
import { convertMeasurement } from '../src/lib/obd/units';
import {
  formatTelemetryCsv,
  persistRecordedSamples,
  saveLiveRecordingSession,
} from '../src/features/live/liveRecording';
import { useLiveStore, type RecordedSample } from '../src/features/live/liveStore';

class MockLiveDriver {
  calls: string[] = [];
  concurrentCount = 0;
  maxConcurrent = 0;

  async send(command: string): Promise<{ lines: string[] }> {
    this.concurrentCount += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrentCount);
    this.calls.push(command);

    // Simulate serial latency
    await new Promise((r) => setTimeout(r, 5));
    this.concurrentCount -= 1;

    if (command === '010C') return { lines: ['41 0C 1A F8'] }; // 1726 RPM
    if (command === '010D') return { lines: ['41 0D 3C'] }; // 60 km/h
    if (command === '0105') return { lines: ['41 05 5A'] }; // 50 C
    if (command === '0104') return { lines: ['41 04 80'] }; // 50.2 %
    if (command === '0106') return { lines: ['41 06 85'] }; // STFT1 = +3.9%
    if (command === '0107') return { lines: ['41 07 90'] }; // LTFT1 = +12.5%
    if (command === '0114') return { lines: ['41 14 5A 80'] }; // O2 B1S1 = 0.45V, 0.0%
    if (command === '0115') return { lines: ['41 15 8C 80'] }; // O2 B1S2 = 0.70V, 0.0%

    return { lines: ['NO DATA'] };
  }
}

describe('Phase 6: Live Data, Charts, Recording and Diagnostic Views', () => {
  beforeEach(() => {
    useLiveStore.getState().resetAll();
  });

  it('guarantees strictly sequential polling over ELM327 with no overlapping calls', async () => {
    const driver = new MockLiveDriver();
    const poller = new LivePoller(driver as unknown as Elm327Driver, {
      pids: [0x0c, 0x0d, 0x05, 0x04],
      onReading: (r) => useLiveStore.getState().updateReading(r),
    });

    poller.start();
    await new Promise((r) => setTimeout(r, 120));
    await poller.stop();

    // Verify driver was called sequentially
    expect(driver.calls.length).toBeGreaterThanOrEqual(2);
    expect(driver.maxConcurrent).toBe(1); // Never parallel!
  });

  it('bounds memory consumption to maximum 300 points per PID', () => {
    const store = useLiveStore.getState();

    // Push 400 readings for RPM (0x0C)
    for (let i = 0; i < 400; i++) {
      const mockReading: PidReading = {
        pid: 0x0c,
        data: [0x1a, 0xf8],
        measurements: [
          {
            labelKey: 'scan.pids.rpm',
            value: 800 + i * 2,
            unit: 'rpm',
            decimals: 0,
          },
        ],
      };
      store.updateReading(mockReading);
    }

    const history = useLiveStore.getState().history[0x0c];
    expect(history).toBeDefined();
    expect(history!.length).toBe(300); // Clamped at MAX_HISTORY_POINTS
    expect(history![299]!.value).toBe(800 + 399 * 2);
  });

  it('handles telemetry recording and RFC 4180 CSV export', () => {
    const samples: RecordedSample[] = [
      {
        pid: 0x0c,
        name: 'scan.pids.rpm',
        value: 2450,
        unit: 'rpm',
        timestamp: '2026-11-15T12:00:00.000Z',
      },
      {
        pid: 0x0d,
        name: 'scan.pids.speed',
        value: 85,
        unit: 'kmh',
        timestamp: '2026-11-15T12:00:00.100Z',
      },
    ];

    const csv = formatTelemetryCsv(samples);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Timestamp,PID,Hex,Parameter,Value,Unit');
    expect(lines[1]).toBe('2026-11-15T12:00:00.000Z,12,0x0C,"rpm",2450,"rpm"');
    expect(lines[2]).toBe('2026-11-15T12:00:00.100Z,13,0x0D,"speed",85,"kmh"');
  });

  it('persists telemetry samples to SQLite live_data_logs', async () => {
    const repos = createInMemoryRepositories();

    const session = await repos.scans.createSession({
      vehicleId: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      protocol: 'ISO 15765-4 (CAN 11/500)',
      adapterInfo: null,
      milStatus: null,
      overallStatus: 'healthy',
      mode: 'normal',
    });

    const samples: RecordedSample[] = [
      {
        pid: 0x05,
        name: 'scan.pids.coolantTemp',
        value: 92,
        unit: 'celsius',
        timestamp: new Date().toISOString(),
      },
    ];

    await persistRecordedSamples(repos, session.id, samples);

    const rows = await repos.scans.liveDataFor(session.id);
    expect(rows.length).toBe(1);
    expect(rows[0]!.pid).toBe('0x05');
    expect(rows[0]!.value).toBe(92);
    expect(rows[0]!.unit).toBe('celsius');
  });

  it('converts units correctly between metric and imperial', () => {
    const speed = convertMeasurement(100, 'kmh', {
      temperature: 'celsius',
      speed: 'mph',
    });
    expect(speed.displayUnit).toBe('mph');
    expect(Math.round(speed.value)).toBe(62);

    const temp = convertMeasurement(100, 'celsius', {
      temperature: 'fahrenheit',
      speed: 'kmh',
    });
    expect(temp.displayUnit).toBe('°F');
    expect(temp.value).toBe(212);
  });

  it('creates a scan session and stores recorded live samples in live_data_logs', async () => {
    const repos = createInMemoryRepositories();

    const samples: RecordedSample[] = [
      {
        pid: 0x0c,
        name: 'scan.pids.rpm',
        value: 2100,
        unit: 'rpm',
        timestamp: '2026-11-18T10:00:00.000Z',
      },
      {
        pid: 0x0d,
        name: 'scan.pids.speed',
        value: 55,
        unit: 'kmh',
        timestamp: '2026-11-18T10:00:00.500Z',
      },
    ];

    const sessionId = await saveLiveRecordingSession(repos, samples, {
      vehicleId: 'test-vehicle-1',
      protocol: 'ISO 15765-4',
      sessionType: 'demo',
    });

    expect(sessionId).not.toBeNull();
    const session = await repos.scans.getSession(sessionId!);
    expect(session).toBeDefined();
    expect(session?.vehicleId).toBe('test-vehicle-1');
    expect(session?.sessionType).toBe('demo');

    const logs = await repos.scans.liveDataFor(sessionId!);
    expect(logs.length).toBe(2);
    expect(logs[0]?.pid).toBe('0x0C');
    expect(logs[0]?.value).toBe(2100);
    expect(logs[1]?.pid).toBe('0x0D');
    expect(logs[1]?.value).toBe(55);
  });
});
