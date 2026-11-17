import { describe, expect, it } from 'vitest';
import { InMemoryScanRepository } from '../src/lib/db/inMemoryRepositories';
import { generateWhatsAppSummary, maskVin } from '../src/features/reports/whatsAppSummary';
import type { DiagnosticReportData } from '../src/features/reports/reportTypes';

describe('History and Scan comparison flow', () => {
  it('manages sessions, lists by vehicle, and supports soft-delete', async () => {
    const repo = new InMemoryScanRepository();

    const session1 = await repo.createSession({
      vehicleId: 'veh-1',
      startedAt: '2026-11-10T10:00:00Z',
      overallStatus: 'fault',
      mode: 'normal',
    });

    const session2 = await repo.createSession({
      vehicleId: 'veh-1',
      startedAt: '2026-11-12T10:00:00Z',
      overallStatus: 'healthy',
      mode: 'pre_purchase',
    });

    const sessionOther = await repo.createSession({
      vehicleId: 'veh-2',
      startedAt: '2026-11-14T10:00:00Z',
      overallStatus: 'healthy',
      mode: 'normal',
    });

    // List all
    const all = await repo.listSessions();
    expect(all).toHaveLength(3);
    expect(all.map((s) => s.id)).toContain(sessionOther.id);

    // List filtered by vehicle
    const veh1Scans = await repo.listSessions('veh-1');
    expect(veh1Scans).toHaveLength(2);
    expect(veh1Scans[0]?.id).toBe(session2.id); // sorted desc

    // Soft delete session 1
    await repo.softDelete(session1.id);

    const afterDelete = await repo.listSessions('veh-1');
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]?.id).toBe(session2.id);

    const deletedGet = await repo.getSession(session1.id);
    expect(deletedGet).toBeNull();
  });

  it('masks VIN correctly for safe sharing (preserves manufacturer/model, hides serial)', () => {
    // 17-character standard VIN: preserves first 9 chars (WMI + VDS + check digit), hides last 8 chars (VIS serial)
    expect(maskVin('WAUZZZ4G1EN123456')).toBe('WAUZZZ4G1********');
    expect(maskVin('WP0AB2A99MS123456')).toBe('WP0AB2A99********');
    expect(maskVin('1HGCR2F83HA000000')).toBe('1HGCR2F83********');

    // Edge cases
    expect(maskVin(null)).toBe('N/A');
    expect(maskVin('')).toBe('N/A');
    expect(maskVin('   ')).toBe('N/A');

    // Non-standard length VINs: hides the trailing 6 to 8 serial digits
    expect(maskVin('123456789012')).toBe('123456******');
  });

  it('generates a cautious WhatsApp summary with masked VIN and disclaimer', () => {
    const report: DiagnosticReportData = {
      mode: 'pre_purchase',
      scanDate: '2026-11-15 14:00',
      vehicle: {
        make: 'Volkswagen',
        model: 'Golf',
        year: 2018,
        engine: '1.4 TSI',
        vin: 'WVWZZZAUZJP123456',
      },
      adapter: {
        identity: 'vLinker FD+',
        version: 'v2.2',
        protocol: 'ISO 15765-4 (CAN 11/500)',
      },
      protocol: 'ISO 15765-4 (CAN 11/500)',
      milStatus: { on: false, dtcCount: 0 },
      overallStatus: 'healthy',
      storedCodes: [],
      pendingCodes: [],
      permanentCodes: [],
      readiness: null,
      driveHistory: {
        distanceSinceClearedKm: 15,
        warmupsSinceCleared: 1,
        timeSinceClearedMinutes: 30,
        runTimeSeconds: 500,
        distanceWithMilKm: null,
        timeWithMilMinutes: null,
      },
      freezeFrames: [],
      prePurchase: {
        level: 'several_indicators',
        headlineKey: 'prePurchase.levels.several.headline',
        bodyKey: 'prePurchase.levels.several.body',
        limitationsKey: 'prePurchase.limitationsNotice',
        factors: [],
        rawCounters: {
          distanceSinceClearedKm: 15,
          warmupsSinceCleared: 1,
          timeSinceClearedMinutes: 30,
          runTimeSeconds: 500,
          distanceWithMilKm: null,
          incompleteMonitorsCount: 3,
          supportedMonitorsCount: 6,
          permanentDtcCount: 0,
        },
      },
    };

    // Default when maskVin option is omitted is masked (true)
    const defaultSummary = generateWhatsAppSummary(report);
    expect(defaultSummary).toContain('WVWZZZAUZ********');
    expect(defaultSummary).not.toContain('WVWZZZAUZJP123456');

    const arabicSummary = generateWhatsAppSummary(report, { language: 'ar', maskVin: true });
    expect(arabicSummary).toContain('WVWZZZAUZ********');
    expect(arabicSummary).toContain('Volkswagen Golf');
    expect(arabicSummary).toContain('عدة مؤشرات ترجح احتمالية مسح الأعطال مؤخراً');
    expect(arabicSummary).toContain('الفحص استرشادي ويقتصر على منظومة المحرك والانبعاثات');

    const englishSummary = generateWhatsAppSummary(report, { language: 'en', maskVin: false });
    expect(englishSummary).toContain('WVWZZZAUZJP123456');
    expect(englishSummary).toContain(
      'Several indicators suggest codes may have been cleared recently',
    );
    expect(englishSummary).toContain(
      'Diagnostic information only, limited to generic powertrain OBD-II',
    );
  });
});
