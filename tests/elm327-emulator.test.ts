import { spawn, type ChildProcess } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Elm327Driver } from '../src/lib/elm327/driver';
import { TcpTransport } from './helpers/tcpTransport';

/**
 * Live check against the open-source ELM327-emulator (Python).
 * Opt-in because it needs Python + `pip install elm327-emulator`:
 *   $env:ELM_EMULATOR = '1'; npm test
 * It uses the emulator's TCP mode, which needs no COM-port driver. The serial
 * bridge itself is exercised with com0com (see docs/emulator.md).
 */
const enabled = process.env.ELM_EMULATOR === '1';
const PORT = 35019;

describe.skipIf(!enabled)('ELM327 emulator (live)', () => {
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

  it('initialises, identifies the adapter and reads codes', async () => {
    const transport = new TcpTransport(PORT);
    await transport.open();
    const driver = new Elm327Driver(transport, { resetTimeoutMs: 10000 });

    const info = await driver.initialize();

    expect(info.identity).toMatch(/ELM327 v\d/i);
    expect(info.ecuPresent).toBe(true);
    expect(info.protocol).toContain('ISO 15765');

    const codes = await driver.send('03');
    // The stock 'car' scenario stores no DTCs, so the answer is `43 00` (service 43, count 0).
    expect(codes.lines.join(' ')).toMatch(/^43/i);

    // Kill the emulator before the client socket closes: its TCP mode logs an
    // error storm on abrupt disconnects.
    emulator?.kill();
    await driver.close();
  }, 30000);
});
