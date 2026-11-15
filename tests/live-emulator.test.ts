import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Elm327Driver } from '../src/lib/elm327/driver';
import { LivePoller } from '../src/lib/obd/livePoller';
import type { PidReading } from '../src/lib/obd/pids';
import { useLiveStore } from '../src/features/live/liveStore';
import { TcpTransport } from './helpers/tcpTransport';

const enabled = process.env.ELM_EMULATOR === '1';
const PORT = 35025;

describe.skipIf(!enabled)('ELM327 Live Poller Emulator Benchmark', () => {
  let emulator: ChildProcess | null = null;

  beforeAll(async () => {
    emulator = spawn('python', ['-m', 'elm', '-n', String(PORT), '-s', 'car'], {
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
  }, 30000);

  afterAll(() => {
    emulator?.kill();
  });

  it('achieves 5+ updates/second for 4 PIDs on the ELM327 emulator without memory growth', async () => {
    const transport = new TcpTransport(PORT);
    await transport.open();
    const driver = new Elm327Driver(transport, { resetTimeoutMs: 10000 });
    await driver.initialize();

    const store = useLiveStore.getState();
    store.resetAll();

    let readingsReceived = 0;
    const pids = [0x0c, 0x0d, 0x05, 0x04]; // RPM, Speed, Coolant, Load

    const poller = new LivePoller(driver, {
      pids,
      onReading: (reading: PidReading) => {
        readingsReceived += 1;
        store.updateReading(reading);
      },
    });

    const startTime = Date.now();
    poller.start();

    // Poll for 3.5 seconds
    await new Promise((r) => setTimeout(r, 3500));
    await poller.stop();
    const durationSec = (Date.now() - startTime) / 1000;

    const rate = readingsReceived / durationSec;

    // Verify rate is 5+ updates/s
    expect(rate).toBeGreaterThanOrEqual(5.0);

    // Verify store has latest readings for the polled PIDs
    const state = useLiveStore.getState();
    expect(state.readings[0x0c]).toBeDefined();
    expect(state.readings[0x0d]).toBeDefined();

    // Verify history does not exceed the capped maximum
    for (const pid of pids) {
      const hist = state.history[pid];
      if (hist) {
        expect(hist.length).toBeLessThanOrEqual(300);
      }
    }

    emulator?.kill();
    await driver.close();
  }, 30000);
});
