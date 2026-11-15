import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isDevPreview,
  isTauriEnvironment,
  openBrowserStorage,
  openTauriStorage,
} from '../src/lib/db/runtime';
import { createDemoConnection } from '../src/lib/elm327/demoSession';
import { createInMemoryRepositories } from '../src/lib/db/inMemoryRepositories';
import { createSqliteRepositories } from '../src/lib/db/sqliteRepositories';
import { createTestDatabase } from './helpers/sqlite';
import { migrate } from '../src/lib/db/migrations';
import { MockTransport } from '../src/lib/elm327/mockTransport';
import { Elm327Driver } from '../src/lib/elm327/driver';
import { ScanService } from '../src/lib/obd/scanService';

describe('runtime storage environment and browser preview', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('detects non-Tauri environment in Node / test runner', () => {
    // In Vitest node/jsdom without __TAURI_INTERNALS__.invoke, isTauri is false
    expect(isTauriEnvironment()).toBe(false);
  });

  it('fails loudly when Tauri is unavailable and dev fallback is disabled (production-like)', async () => {
    await expect(openTauriStorage({ allowDevFallback: false })).rejects.toThrow(
      'Tauri IPC bridge is unavailable in production build. Real SQLite storage is required.',
    );
  });

  it('throws directly and never creates in-memory storage when Tauri environment is present but SQLite fails', async () => {
    const mockInvoke = vi.fn().mockRejectedValue(new Error('SQLite disk I/O error'));
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke: mockInvoke,
      },
    };

    expect(isTauriEnvironment()).toBe(true);

    // openTauriStorage MUST throw the error directly and NOT fall back to in-memory storage
    await expect(openTauriStorage()).rejects.toThrow('SQLite disk I/O error');
  });

  it('initializes safe in-memory storage with the vehicle catalog in browser preview', async () => {
    const storage = await openBrowserStorage();
    expect(storage.isInMemory).toBe(true);
    expect(storage.seed.catalogCount).toBe(377);

    // Verify catalog repository can search and list makes
    const makes = await storage.repositories.catalog.makes();
    expect(makes.length).toBe(46);

    const corolla = await storage.repositories.catalog.search('Corolla');
    expect(corolla.length).toBeGreaterThan(0);
    expect(corolla[0]?.make).toBe('Toyota');

    // Verify sample DTC codes exist (exactly the 3 preview codes: P0133, P0300, P0420)
    const p0300 = await storage.repositories.dtc.lookup('P0300');
    expect(p0300.kind).toBe('generic');
    expect(p0300.category).toBe('powertrain');
    expect(p0300.record?.descriptionEn).toContain('Misfire');

    const p0133 = await storage.repositories.dtc.lookup('P0133');
    expect(p0133.record?.code).toBe('P0133');

    const p0420 = await storage.repositories.dtc.lookup('P0420');
    expect(p0420.record?.code).toBe('P0420');
  });

  it('allows openTauriStorage with dev fallback enabled to resolve preview storage only when not in Tauri', async () => {
    const storage = await openTauriStorage({ allowDevFallback: true });
    expect(storage.isInMemory).toBe(true);
    expect(await storage.repositories.catalog.makes()).not.toHaveLength(0);
  });

  it('ensures demo scan is strictly unreachable when dev preview is disabled', () => {
    // When in Tauri environment, isDevPreview is false and createDemoConnection must throw
    (globalThis as unknown as { window: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke: vi.fn(),
      },
    };
    expect(isTauriEnvironment()).toBe(true);
    expect(isDevPreview()).toBe(false);
    expect(() => createDemoConnection()).toThrow(
      'Demo mode is only available in development preview mode.',
    );
  });

  it('guarantees demo scan and preview banner are disabled in production build', () => {
    const originalProd = import.meta.env.PROD;
    try {
      (import.meta.env as unknown as { PROD: boolean }).PROD = true;
      expect(isDevPreview()).toBe(false);
      expect(() => createDemoConnection()).toThrow(
        'Demo mode is only available in development preview mode.',
      );
    } finally {
      (import.meta.env as unknown as { PROD: boolean }).PROD = originalProd;
    }
  });

  it('refuses Mode 04 clear in the real app when backup repository is in-memory (requireDurable)', async () => {
    const sentCommands: string[] = [];
    let codesCleared = false;
    const transport = new MockTransport((cmd) => {
      sentCommands.push(cmd);
      if (cmd === '0100') return '4100BE3EB811\r\r>';
      if (cmd === '0101') return '410181076504\r\r>';
      if (cmd === '03') return codesCleared ? '4300\r\r>' : '430101330000\r\r>';
      if (cmd === '07') return '4700\r\r>';
      if (cmd === '0A') return '4A00\r\r>';
      if (cmd === '010C') return '410C0000\r\r>'; // RPM = 0
      if (cmd === '04') {
        codesCleared = true;
        return '44\r\r>';
      }
      return 'NO DATA\r\r>';
    });

    const driver = new Elm327Driver(transport);
    await transport.open();
    const adapter = {
      identity: 'ELM327 v1.5',
      description: 'ELM327 v1.5 Mock Adapter',
      version: '1.5',
      protocol: 'ISO 15765-4 (CAN 11/500)',
      ecuPresent: true,
      likelyClone: false,
      limitedCommands: false,
      adapterTimeoutMs: 200,
    };
    const service = new ScanService(driver, adapter);

    const memRepos = createInMemoryRepositories();
    expect(memRepos.scanBackups.isDurable).toBe(false);

    // Attempting clear with requireDurable: true must fail BEFORE sending '04'
    await expect(
      service.clearStoredCodes({
        backupRepository: memRepos.scanBackups,
        confirm: true,
        requireDurable: true,
      }),
    ).rejects.toThrow('Durable SQLite backup is required before clearing codes in the desktop app');

    // Confirm that Mode 04 command was NEVER sent to the transport
    expect(sentCommands).not.toContain('04');

    // Now test with durable SQLite repository
    const db = createTestDatabase();
    await migrate(db);
    const sqliteRepos = createSqliteRepositories(db);
    expect(sqliteRepos.scanBackups.isDurable).toBe(true);

    const clearResult = await service.clearStoredCodes({
      backupRepository: sqliteRepos.scanBackups,
      confirm: true,
      requireDurable: true,
    });

    expect(clearResult.outcome).toBe('no_codes_returned');
    expect(sentCommands).toContain('04');

    // Verify durable backup exists in SQLite
    const savedBackup = await sqliteRepos.scanBackups.get(clearResult.backupId);
    expect(savedBackup).not.toBeNull();
    expect(savedBackup?.stored.map((d) => d.code)).toEqual(['P0133']);

    db.close();
    await driver.close();
  });
});
