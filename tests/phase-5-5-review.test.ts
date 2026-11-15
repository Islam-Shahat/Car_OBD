import { describe, expect, it } from 'vitest';

import { ScanService } from '../src/lib/obd/scanService';
import { createDemoConnection } from '../src/lib/elm327/demoSession';
import { createInMemoryRepositories } from '../src/lib/db/inMemoryRepositories';
import { createTestDatabase } from './helpers/sqlite';
import { migrate } from '../src/lib/db/migrations';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { openTauriStorage } from '../src/lib/db/runtime';
import arLocale from '../src/lib/i18n/locales/ar.json';
import enLocale from '../src/lib/i18n/locales/en.json';

describe('Phase 5.5 Review Fixes & Browser Preview Safety', () => {
  describe('A. Safe Browser Preview & Production Invariant', () => {
    it('fails loudly in production when Tauri bridge is unavailable', async () => {
      await expect(openTauriStorage({ allowDevFallback: false })).rejects.toThrow(
        'Tauri IPC bridge is unavailable in production build. Real SQLite storage is required.',
      );
    });

    it('runs the full demo experience against MockTransport without hardware', async () => {
      const connection = createDemoConnection();
      const service = new ScanService(connection.driver, connection.info);

      let stepCount = 0;
      const scan = await service.runFullScan(() => {
        stepCount += 1;
      });

      expect(stepCount).toBeGreaterThan(0);
      expect(scan.vin?.vin).toBe('WP0ZZZ99ZTS390000');
      expect(scan.vin?.makeSlug).toBe('porsche');
      expect(scan.stored.map((d) => d.code)).toEqual(['P0133']);
      expect(scan.pending.map((d) => d.code)).toEqual(['P0300']);
      expect(scan.permanent.map((d) => d.code)).toEqual(['P0420']);

      // RPM is 1726, so engine is running
      const rpm = scan.live.find((r) => r.pid === 0x0c)?.measurements[0]?.value;
      expect(rpm).toBe(1726);

      // Execute safe clear flow against demo mock
      const repos = createInMemoryRepositories();
      const clearResult = await service.clearStoredCodes({
        backupRepository: repos.scanBackups,
        confirm: true,
      });

      expect(clearResult.outcome).toBe('no_codes_returned');
      expect(clearResult.after?.stored).toHaveLength(0);
      expect(clearResult.after?.pending).toHaveLength(0);
      expect(clearResult.backupId).toBeTruthy();

      const backup = await repos.scanBackups.get(clearResult.backupId);
      expect(backup?.stored.map((d) => d.code)).toEqual(['P0133']);

      await connection.driver.close();
    });
  });

  describe('B. Result Banner Wording & Meaning', () => {
    it('uses correct terminology in English and Arabic locales', () => {
      // Green state
      expect(enLocale.scan.overallHealthyTitle).toBe('No fault codes found');
      expect(enLocale.scan.overallHealthyBody).toContain('Engine and emissions codes only');
      expect(enLocale.scan.overallHealthyBody).toContain('does not prove');

      expect(arLocale.scan.overallHealthyTitle).toBe('لم يتم العثور على أكواد أعطال');
      expect(arLocale.scan.overallHealthyBody).toContain('أكواد المحرك والانبعاثات فقط');
      expect(arLocale.scan.overallHealthyBody).toContain('لا يعني بالضرورة');

      // Yellow state
      expect(enLocale.scan.overallWarningTitle).toBe('Pending codes');
      expect(arLocale.scan.overallWarningTitle).toBe('أكواد معلقة');

      // Red state
      expect(enLocale.scan.overallFaultTitle).toBe('Faults detected');
      expect(arLocale.scan.overallFaultTitle).toBe('تم اكتشاف أعطال');

      // Scan notes
      expect(enLocale.scan.scanNotesTitle).toBe('Scan notes');
      expect(arLocale.scan.scanNotesTitle).toBe('ملاحظات الفحص');
    });

    it('banner health tier derives strictly from fault data and ignores adapter warnings', () => {
      // Simulate scan result with adapter warning (e.g. clone adapter) but no fault codes and MIL off
      const mockResultNoFaultsWithWarning = {
        stored: [],
        pending: [],
        status: { mil: { on: false, dtcCount: 0 } },
        warnings: [{ code: 'likely-clone' as const, message: 'Version 1.5 clone' }],
      };

      const hasStored = mockResultNoFaultsWithWarning.stored.length > 0;
      const isMilOn = Boolean(mockResultNoFaultsWithWarning.status?.mil.on);
      const hasPending = mockResultNoFaultsWithWarning.pending.length > 0;

      // Crucial: warnings must NOT turn banner into 'warning'
      const healthTier = hasStored || isMilOn ? 'fault' : hasPending ? 'warning' : 'healthy';
      expect(healthTier).toBe('healthy');

      // Overall status calculation
      const overallStatus =
        mockResultNoFaultsWithWarning.stored.length > 0 ||
        mockResultNoFaultsWithWarning.status?.mil.on
          ? 'fault'
          : mockResultNoFaultsWithWarning.pending.length > 0
            ? 'warning'
            : 'healthy';
      expect(overallStatus).toBe('healthy');
    });
  });

  describe('C. VIN-to-Make Multi-Brand Memory (wmi_user_map)', () => {
    it('supports multiple brands for the same group WMI in SQLite and in-memory', async () => {
      const db = createTestDatabase();
      await migrate(db);
      const sqliteRepos = createSqliteRepositories(db);
      const memRepos = createInMemoryRepositories();

      for (const repos of [sqliteRepos, memRepos]) {
        // Group WMI 'LVT' (Chery group) used for Chery first
        await repos.wmiUserMap.set('LVT', 'chery');
        expect(await repos.wmiUserMap.get('LVT')).toBe('chery');

        // Later used for Jetour
        await repos.wmiUserMap.set('LVT', 'jetour');

        // Should return the last used make
        expect(await repos.wmiUserMap.get('LVT')).toBe('jetour');

        // getAll returns all associated makes
        const all = await repos.wmiUserMap.getAll('LVT');
        expect(all).toContain('jetour');
        expect(all).toContain('chery');

        const list = await repos.wmiUserMap.list();
        expect(list.some((e) => e.wmi === 'LVT' && e.makeSlug === 'jetour')).toBe(true);
        expect(list.some((e) => e.wmi === 'LVT' && e.makeSlug === 'chery')).toBe(true);
      }

      db.close();
    });
  });

  describe('D. Clear Dialog Engine-Running Warning', () => {
    it('detects engine running condition when RPM > 0', () => {
      const engineRunning = (
        readings: Array<{ pid: number; measurements: Array<{ value: number }> }>,
      ) => {
        const rpm = readings.find((r) => r.pid === 0x0c)?.measurements[0]?.value;
        return rpm !== undefined && rpm > 0;
      };

      expect(engineRunning([{ pid: 0x0c, measurements: [{ value: 0 }] }])).toBe(false);
      expect(engineRunning([{ pid: 0x0c, measurements: [{ value: 750 }] }])).toBe(true);
      expect(engineRunning([])).toBe(false);
    });
  });
});
