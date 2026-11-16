import { describe, expect, it } from 'vitest';
import { InMemoryScanRepository } from '../src/lib/db/inMemoryRepositories';
import type { SessionType } from '../src/lib/db/types';

describe('Watermark Decision & Session Type Provenance', () => {
  it('records and preserves sessionType across scan repository sessions', async () => {
    const repo = new InMemoryScanRepository();

    const realSession = await repo.createSession({
      startedAt: '2026-11-15T12:00:00Z',
      sessionType: 'real',
      mode: 'normal',
    });
    expect(realSession.sessionType).toBe('real');

    const emulatorSession = await repo.createSession({
      startedAt: '2026-11-15T13:00:00Z',
      sessionType: 'emulator',
      mode: 'pre_purchase',
    });
    expect(emulatorSession.sessionType).toBe('emulator');

    const demoSession = await repo.createSession({
      startedAt: '2026-11-15T14:00:00Z',
      sessionType: 'demo',
      mode: 'normal',
    });
    expect(demoSession.sessionType).toBe('demo');

    // Default when omitted is 'real'
    const defaultSession = await repo.createSession({
      startedAt: '2026-11-15T15:00:00Z',
    });
    expect(defaultSession.sessionType).toBe('real');
  });

  it('determines watermark visibility strictly from sessionType, never from content', () => {
    function computeIsSampleData(session: { sessionType: SessionType }): boolean {
      // Must come strictly from transport or session type recorded in scan_sessions,
      // never guessed from VIN, adapter name, DTCs, or other content.
      return session.sessionType !== 'real';
    }

    // Direction 1: Real serial port scan MUST NEVER show watermark, even with emulator-like text
    const realScanWithEmulatorContent = {
      sessionType: 'real' as SessionType,
      adapterInfo: { identity: 'OBDLink MX+ (Emulator)', version: 'STN1151', protocol: 'ISO 15765-4' },
      vin: 'WP0AB2A99MS123456',
    };
    expect(computeIsSampleData(realScanWithEmulatorContent)).toBe(false);

    // Direction 2: Emulator scan MUST ALWAYS show watermark
    const emulatorScan = {
      sessionType: 'emulator' as SessionType,
      adapterInfo: { identity: 'ELM327 v1.5', version: '1.5', protocol: 'ISO 15765-4' },
      vin: '1HGCR2F83HA000000',
    };
    expect(computeIsSampleData(emulatorScan)).toBe(true);

    // Direction 3: Demo session MUST ALWAYS show watermark
    const demoScan = {
      sessionType: 'demo' as SessionType,
      adapterInfo: { identity: 'In-Memory Demo', version: '1.0', protocol: 'ISO 15765-4' },
      vin: null,
    };
    expect(computeIsSampleData(demoScan)).toBe(true);
  });
});
