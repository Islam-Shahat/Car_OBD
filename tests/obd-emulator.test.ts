import { spawn, type ChildProcess } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Elm327Driver, type AdapterInfo } from '../src/lib/elm327/driver';
import type { ScanBackup, ScanBackupRepository } from '../src/lib/obd/backup';
import { ScanService } from '../src/lib/obd/scanService';
import { TcpTransport } from './helpers/tcpTransport';

/**
 * Live Phase 3 scan against the open-source ELM327-emulator (Python), with a
 * patched scenario that stores DTCs so Modes 03/07/0A and Mode 04 are real.
 * Opt-in because it needs Python + `pip install elm327-emulator`:
 *   $env:ELM_EMULATOR = '1'; npm test
 */
const enabled = process.env.ELM_EMULATOR === '1';
const PORT = 35020;

class MemoryBackupRepository implements ScanBackupRepository {
  readonly saved: ScanBackup[] = [];

  save(backup: ScanBackup): Promise<void> {
    this.saved.push(backup);
    return Promise.resolve();
  }
}

describe.skipIf(!enabled)('OBD scan against the ELM327 emulator (live)', () => {
  let emulator: ChildProcess | null = null;
  let driver: Elm327Driver | null = null;
  let adapter: AdapterInfo | null = null;

  beforeAll(async () => {
    emulator = spawn('python', ['scripts/emulator-dtc.py', '-n', String(PORT), '-s', 'car'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('The ELM327 emulator did not report a listening port in time'));
      }, 25000);

      const onOutput = (buffer: Buffer) => {
        if (buffer.toString('utf8').includes('TCP/IP network port')) {
          clearTimeout(timeout);
          resolve();
        }
      };

      emulator?.stdout?.on('data', onOutput);
      emulator?.stderr?.on('data', onOutput);
      emulator?.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`The ELM327 emulator exited early (code ${code ?? 'unknown'})`));
      });
    });

    const transport = new TcpTransport(PORT);
    await transport.open();
    driver = new Elm327Driver(transport, { resetTimeoutMs: 10000 });
    adapter = await driver.initialize();
  }, 45000);

  afterAll(async () => {
    // Kill the emulator before closing the client socket: its TCP mode logs an
    // error storm on abrupt disconnects.
    emulator?.kill();
    await driver?.close();
  });

  it('runs a full scan and decodes the emulated car', async () => {
    if (!driver || !adapter) throw new Error('The emulator session was not initialised');
    const service = new ScanService(driver, adapter);

    const result = await service.runFullScan();

    expect(result.adapter.identity).toMatch(/ELM327 v\d/i);
    expect(result.protocol).toContain('ISO 15765');
    expect(result.vin?.vin).toBe('WP0ZZZ99ZTS390000');
    expect(result.status?.mil).toEqual({ on: true, dtcCount: 3 });
    expect(result.stored.map((dtc) => dtc.code)).toEqual(['P0143', 'P0196', 'P0234']);
    expect(result.pending.map((dtc) => dtc.code)).toEqual(['P0300']);
    expect(result.permanent.map((dtc) => dtc.code)).toEqual(['P0420']);
    expect(result.modeSupport).toMatchObject({
      stored: true,
      pending: true,
      permanent: true,
    });
    expect(result.supportedPids).toContain(0x0c);
    expect(result.live.length).toBeGreaterThan(0);
    expect(result.freezeFrames).toHaveLength(1);
    expect(result.freezeFrames[0]).toMatchObject({
      frame: 0,
      dtc: { code: 'P0143' },
    });
    expect(
      result.freezeFrames[0]?.readings.map((reading) => [
        reading.pid,
        reading.measurements[0]?.value,
      ]),
    ).toEqual([
      [0x05, 55],
      [0x0c, 1726],
      [0x0d, 10],
    ]);
    expect(result.driveHistory).toEqual({
      runTimeSeconds: 117,
      distanceWithMilKm: 0,
      warmupsSinceCleared: 4,
      distanceSinceClearedKm: 50,
      timeWithMilMinutes: 0,
      timeSinceClearedMinutes: 91,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  }, 90000);

  it('backs up before Mode 04 and reports the cleared state', async () => {
    if (!driver || !adapter) throw new Error('The emulator session was not initialised');
    const service = new ScanService(driver, adapter);
    const repository = new MemoryBackupRepository();

    const result = await service.clearStoredCodes({ backupRepository: repository, confirm: true });

    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]?.result.stored).toHaveLength(3);
    expect(result.before.stored).toHaveLength(3);
    expect(result.after).not.toBeNull();
    expect(result.after?.stored).toEqual([]);
    expect(result.after?.pending).toEqual([]);
    expect(result.after?.status?.mil).toEqual({ on: false, dtcCount: 0 });
    expect(result.verificationError).toBeNull();
    expect(result.returningCodes).toEqual([]);
  }, 90000);
});
