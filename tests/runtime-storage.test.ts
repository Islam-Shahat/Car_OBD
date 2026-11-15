import { describe, expect, it } from 'vitest';

import { isTauriEnvironment, openBrowserStorage, openTauriStorage } from '../src/lib/db/runtime';

describe('runtime storage environment and browser preview', () => {
  it('detects non-Tauri environment in Node / test runner', () => {
    // In Vitest node/jsdom without __TAURI_INTERNALS__, isTauri is false
    expect(isTauriEnvironment()).toBe(false);
  });

  it('fails loudly when Tauri is unavailable and dev fallback is disabled (production-like)', async () => {
    await expect(openTauriStorage({ allowDevFallback: false })).rejects.toThrow(
      'Tauri IPC bridge is unavailable in production build. Real SQLite storage is required.',
    );
  });

  it('initializes safe in-memory storage with the vehicle catalog in browser preview', async () => {
    const storage = await openBrowserStorage();
    expect(storage.isInMemory).toBe(true);
    expect(storage.seed.catalogCount).toBeGreaterThan(300);

    // Verify catalog repository can search and list makes
    const makes = await storage.repositories.catalog.makes();
    expect(makes.length).toBeGreaterThan(30);

    const corolla = await storage.repositories.catalog.search('Corolla');
    expect(corolla.length).toBeGreaterThan(0);
    expect(corolla[0]?.make).toBe('Toyota');

    // Verify sample DTC codes exist
    const p0300 = await storage.repositories.dtc.lookup('P0300');
    expect(p0300.kind).toBe('generic');
    expect(p0300.category).toBe('powertrain');
    expect(p0300.record?.descriptionEn).toContain('Misfire');
  });

  it('allows openTauriStorage with dev fallback enabled to resolve preview storage', async () => {
    const storage = await openTauriStorage({ allowDevFallback: true });
    expect(storage.isInMemory).toBe(true);
    expect(await storage.repositories.catalog.makes()).not.toHaveLength(0);
  });
});
