import { describe, expect, it } from 'vitest';

import type { ScanBackup, ScanBackupRepository } from '../src/lib/obd/backup';
import { ScanService } from '../src/lib/obd/scanService';
import type { ScanProgress } from '../src/lib/obd/scanTypes';
import { VehicleIdentityCache } from '../src/lib/obd/vehicleIdentity';
import {
  createScriptedAdapter,
  fullScanScript,
  reply,
  TEST_ADAPTER,
  type Script,
} from './helpers/obdScript';

class FakeBackupRepository implements ScanBackupRepository {
  readonly saved: ScanBackup[] = [];
  private readonly log: string[];
  private readonly fail: boolean;

  constructor(log: string[], fail = false) {
    this.log = log;
    this.fail = fail;
  }

  save(backup: ScanBackup): Promise<void> {
    this.log.push('save');
    if (this.fail) return Promise.reject(new Error('quota exceeded'));
    this.saved.push(backup);
    return Promise.resolve();
  }
}

let clock = 1_700_000_000_000;
const nextNow = () => {
  clock += 1000;
  return clock;
};

describe('ScanService.runFullScan', () => {
  it('returns a complete structured scan', async () => {
    const { transport, driver } = createScriptedAdapter(fullScanScript());
    await transport.open();
    clock = 1_700_000_000_000;
    const progress: ScanProgress[] = [];
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });

    const result = await service.runFullScan((event) => progress.push(event));

    expect(result.adapter.identity).toBe('ELM327 v1.5');
    expect(result.protocol).toContain('ISO 15765');
    expect(result.vin?.vin).toBe('WP0ZZZ99ZTS390000');
    expect(result.vin?.makeSlug).toBe('porsche');
    expect(result.vin?.yearCandidates).toEqual([1996, 2026]);
    expect(result.status?.mil).toEqual({ on: true, dtcCount: 1 });
    expect(result.stored.map((dtc) => dtc.code)).toEqual(['P0133']);
    expect(result.pending.map((dtc) => dtc.code)).toEqual(['P0300']);
    expect(result.permanent.map((dtc) => dtc.code)).toEqual(['P0420']);
    expect(result.modeSupport).toEqual({
      stored: true,
      pending: true,
      permanent: true,
      freezeFrame: true,
    });
    expect(result.freezeFrames).toHaveLength(1);
    expect(result.freezeFrames[0]?.dtc?.code).toBe('P0133');
    expect(result.freezeFrames[0]?.readings[0]?.measurements[0]?.value).toBe(1726);
    expect(result.live.find((reading) => reading.pid === 0x0c)?.measurements[0]?.value).toBe(1726);
    expect(result.live.find((reading) => reading.pid === 0x42)?.measurements[0]?.value).toBe(
      14.667,
    );
    expect(result.driveHistory).toEqual({
      runTimeSeconds: 3600,
      distanceWithMilKm: 100,
      warmupsSinceCleared: 5,
      distanceSinceClearedKm: 200,
      timeWithMilMinutes: 30,
      timeSinceClearedMinutes: 100,
    });
    expect(result.supportedPids).toContain(0x20);
    expect(result.supportedPids).toContain(0x60);
    expect(result.warnings).toEqual([]);
    expect(result.durationMs).toBe(1000);
    expect(new Set(progress.map((event) => event.step))).toEqual(
      new Set(['pids', 'status', 'dtc', 'vin', 'live', 'freeze']),
    );
    expect(progress.at(-1)?.step).toBe('freeze');
  });

  it('only requests PIDs claimed by the supported-PID bitmaps', async () => {
    const script: Script = {
      '0100': reply('410000100000'),
      '010C': reply('410C1AF8'),
      '03': reply('4300'),
      '07': reply('4700'),
      '0A': reply('4A00'),
      '0902': reply('NO DATA'),
    };
    const { transport, driver, log } = createScriptedAdapter(script);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });

    await service.runFullScan();

    expect(log).toContain('010C');
    expect(log).not.toContain('0105');
    expect(log).not.toContain('0106');
    expect(log).not.toContain('0101');
  });

  it('reports modes the ECU does not support without failing the scan', async () => {
    const script: Script = {
      '0100': reply('410000100000'),
      '010C': reply('410C1AF8'),
      '03': reply('4300'),
      '07': reply('7F0711'),
      '0A': reply('NO DATA'),
      '0902': reply('NO DATA'),
    };
    const { transport, driver } = createScriptedAdapter(script);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });

    const result = await service.runFullScan();

    expect(result.modeSupport.pending).toBe(false);
    expect(result.modeSupport.permanent).toBe(false);
    expect(result.modeSupport.stored).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'mode-unsupported', mode: 7 }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'mode-unsupported', mode: 10 }),
    );
  });
});

function clearScript(overrides: Script = {}): Script {
  let cleared = false;

  return {
    '0100': () => reply(cleared ? '410000100000' : '410000100000'),
    '010C': reply('410C1AF8'),
    '03': () => reply(cleared ? '4300' : '430133'),
    '07': reply('4700'),
    '0A': reply('4A00'),
    '0902': reply('NO DATA'),
    '020000': reply('NO DATA'),
    '04': () => {
      cleared = true;
      return reply('44');
    },
    ...overrides,
  };
}

describe('ScanService.clearStoredCodes', () => {
  it('saves the backup before Service 04 and re-scans afterwards', async () => {
    const log: string[] = [];
    const { transport, driver } = createScriptedAdapter(clearScript(), log);
    await transport.open();
    const repository = new FakeBackupRepository(log);
    const service = new ScanService(driver, TEST_ADAPTER, {
      now: nextNow,
      idFactory: () => 'backup-1',
    });

    const result = await service.clearStoredCodes({
      backupRepository: repository,
      confirm: true,
    });

    expect(result.backupId).toBe('backup-1');
    expect(result.before.stored.map((dtc) => dtc.code)).toEqual(['P0133']);
    expect(result.after?.stored).toEqual([]);
    expect(result.after?.pending).toEqual([]);
    expect(result.returningCodes).toEqual([]);
    expect(result.verificationError).toBeNull();
    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]?.result.stored[0]?.code).toBe('P0133');

    const saveIndex = log.indexOf('save');
    const clearIndex = log.indexOf('04');
    const rescanIndex = log.lastIndexOf('0100');
    expect(saveIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(saveIndex);
    expect(rescanIndex).toBeGreaterThan(clearIndex);
  });

  it('refuses to clear without explicit confirmation', async () => {
    const log: string[] = [];
    const { transport, driver } = createScriptedAdapter(clearScript(), log);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository(log);

    await expect(
      service.clearStoredCodes({ backupRepository: repository, confirm: false }),
    ).rejects.toMatchObject({ code: 'clear-refused' });
    expect(log).toEqual([]);
    expect(repository.saved).toEqual([]);
  });

  it('refuses to clear when there are no stored or pending codes', async () => {
    const log: string[] = [];
    const script = clearScript({ '03': reply('4300') });
    const { transport, driver } = createScriptedAdapter(script, log);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository(log);

    await expect(
      service.clearStoredCodes({ backupRepository: repository, confirm: true }),
    ).rejects.toMatchObject({ code: 'clear-refused' });
    expect(log).not.toContain('save');
    expect(log).not.toContain('04');
  });

  it('does not send Service 04 when the backup cannot be saved', async () => {
    const log: string[] = [];
    const { transport, driver } = createScriptedAdapter(clearScript(), log);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository(log, true);

    await expect(
      service.clearStoredCodes({ backupRepository: repository, confirm: true }),
    ).rejects.toMatchObject({ code: 'backup-failed' });
    expect(log).toContain('save');
    expect(log).not.toContain('04');
  });

  it('reports a rejected Mode 04 and does not run the verification scan', async () => {
    const log: string[] = [];
    const script = clearScript({ '04': reply('7F0411') });
    const { transport, driver } = createScriptedAdapter(script, log);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository(log);

    await expect(
      service.clearStoredCodes({ backupRepository: repository, confirm: true }),
    ).rejects.toMatchObject({ code: 'clear-failed' });

    const clearIndex = log.indexOf('04');
    expect(log.indexOf('save')).toBeLessThan(clearIndex);
    expect(log.slice(clearIndex + 1)).not.toContain('0100');
  });

  it('reports a clear that succeeded but could not be verified', async () => {
    let cleared = false;
    const script = clearScript({
      '0100': () => (cleared ? reply('CAN ERROR') : reply('410000100000')),
      '04': () => {
        cleared = true;
        return reply('44');
      },
    });
    const log: string[] = [];
    const { transport, driver } = createScriptedAdapter(script, log);
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository(log);

    const result = await service.clearStoredCodes({
      backupRepository: repository,
      confirm: true,
    });

    expect(result.after).toBeNull();
    expect(result.verificationError).not.toBeNull();
    expect(result.returningCodes).toEqual([]);
    expect(repository.saved).toHaveLength(1);
  });

  it('refuses a clear while a scan is running', async () => {
    const { transport, driver } = createScriptedAdapter(fullScanScript());
    await transport.open();
    const service = new ScanService(driver, TEST_ADAPTER, { now: nextNow });
    const repository = new FakeBackupRepository([]);

    const scan = service.runFullScan();
    await expect(
      service.clearStoredCodes({ backupRepository: repository, confirm: true }),
    ).rejects.toMatchObject({ code: 'busy' });

    await scan;
    expect(repository.saved).toEqual([]);
  });
});
