import { describe, expect, it } from 'vitest';

import { Elm327Driver } from '../src/lib/elm327/driver';
import { trafficLogger } from '../src/lib/elm327/trafficLogger';
import { MockTransport } from '../src/lib/elm327/mockTransport';

function adapterScript(
  overrides: Record<string, string | null> = {},
  identity = 'ELM327 v1.5',
): (command: string) => string | null {
  const table: Record<string, string | null> = {
    ATZ: `ATZ\r\r\r${identity}\r\r>`,
    ATI: `${identity}\r\r>`,
    'AT@1': 'OBDII to RS232 Interpreter\r\r>',
    ATE0: 'OK\r\r>',
    ATL0: 'OK\r\r>',
    ATS0: 'OK\r\r>',
    ATH0: 'OK\r\r>',
    ATST32: 'OK\r\r>',
    ATAT1: 'OK\r\r>',
    ATSP0: 'OK\r\r>',
    '0100': 'SEARCHING...\r4100BE3FA813\r\r>',
    ATDP: 'AUTO, ISO 15765-4 (CAN 11/500)\r\r>',
    '03': '43 01 33 00 00 00 00\r\r>',
    ...overrides,
  };

  return (command) => {
    const response = table[command];
    return response === undefined ? '?\r\r>' : response;
  };
}

const INIT_SEQUENCE = [
  'ATZ',
  'ATE0',
  'ATL0',
  'ATS0',
  'ATH0',
  'ATI',
  'AT@1',
  'ATST32',
  'ATAT1',
  'ATSP0',
  '0100',
  'ATDP',
];

describe('Elm327Driver initialization', () => {
  it('runs the full init sequence and reports adapter, protocol and ECU', async () => {
    const transport = new MockTransport(adapterScript());
    await transport.open();
    const driver = new Elm327Driver(transport);

    const info = await driver.initialize();

    expect(transport.written).toEqual(INIT_SEQUENCE);
    expect(info).toEqual({
      identity: 'ELM327 v1.5',
      description: 'OBDII to RS232 Interpreter',
      version: '1.5',
      protocol: 'AUTO, ISO 15765-4 (CAN 11/500)',
      ecuPresent: true,
      likelyClone: true,
      limitedCommands: false,
      adapterTimeoutMs: 200,
    });
  });

  it('falls back to limited commands when ATST or AT@1 are rejected', async () => {
    const transport = new MockTransport(adapterScript({ 'AT@1': '?\r\r>', ATST32: '?\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const info = await driver.initialize();

    expect(info.limitedCommands).toBe(true);
    expect(info.description).toBeNull();
    expect(info.identity).toBe('ELM327 v1.5');
  });

  it('treats a blank optional response as limited command support', async () => {
    const transport = new MockTransport(adapterScript({ ATI: '\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const info = await driver.initialize();

    expect(info.identity).toBe('Unknown adapter');
    expect(info.limitedCommands).toBe(true);
  });

  it('keeps the connection when the engine ECU does not answer 0100', async () => {
    const transport = new MockTransport(adapterScript({ '0100': 'NO DATA\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const info = await driver.initialize();

    expect(info.ecuPresent).toBe(false);
    expect(info.protocol).toBe('AUTO, ISO 15765-4 (CAN 11/500)');
  });

  it('does not flag branded adapters as clones', async () => {
    const transport = new MockTransport(adapterScript({}, 'STN1170 v5.6.2'));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const info = await driver.initialize();

    expect(info.identity).toBe('STN1170 v5.6.2');
    expect(info.version).toBeNull();
    expect(info.likelyClone).toBe(false);
  });

  it('fails the connection when a mandatory init command is rejected', async () => {
    const transport = new MockTransport(adapterScript({ ATSP0: '?\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    await expect(driver.initialize()).rejects.toMatchObject({ code: 'unknown-command' });
  });
});

describe('Elm327Driver command handling', () => {
  it('serializes concurrent commands through one queue', async () => {
    const transport = new MockTransport(adapterScript());
    await transport.open();
    const driver = new Elm327Driver(transport);

    const results = await Promise.all([driver.send('0100'), driver.send('03'), driver.send('ATI')]);

    expect(transport.written).toEqual(['0100', '03', 'ATI']);
    expect(results[0]?.lines).toEqual(['4100BE3FA813']);
  });

  it('maps adapter failure tokens to typed errors', async () => {
    const transport = new MockTransport(adapterScript({ '03': 'NO DATA\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    await expect(driver.send('03')).rejects.toMatchObject({ code: 'no-data' });
  });

  it('keeps multi-frame lines intact', async () => {
    const vin = '014\r0: 49 02 01 31 44 34\r1: 47 50 30 30 52 35 35\r>';
    const transport = new MockTransport(adapterScript({ '0902': vin }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const response = await driver.send('0902');

    expect(response.lines).toEqual(['014', '0: 49 02 01 31 44 34', '1: 47 50 30 30 52 35 35']);
  });

  it('times out silently when the adapter never sends a prompt, then recovers', async () => {
    const transport = new MockTransport(adapterScript({ NOOP: null, '0100': '4100BE3FA813\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    await expect(driver.send('NOOP', { timeoutMs: 25 })).rejects.toMatchObject({ code: 'timeout' });

    const response = await driver.send('0100');
    expect(response.lines).toEqual(['4100BE3FA813']);
  });

  it('rejects the in-flight command when the adapter is unplugged', async () => {
    const transport = new MockTransport(adapterScript({ NOOP: null }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const pending = driver.send('NOOP', { timeoutMs: 500 });
    transport.emitClosed('USB device removed');

    await expect(pending).rejects.toMatchObject({ code: 'closed' });
    await expect(driver.send('ATI')).rejects.toMatchObject({ code: 'closed' });
    expect(driver.isOpen).toBe(false);
  });

  it('records raw TX/RX frames through TrafficLogger during commands with timing and redaction', async () => {
    trafficLogger.clear();
    trafficLogger.setEnabled(true);

    const transport = new MockTransport(adapterScript({ '010C': '41 0C 1A F8\r\r>' }));
    await transport.open();
    const driver = new Elm327Driver(transport);

    const res = await driver.send('010C');
    expect(res.lines).toEqual(['41 0C 1A F8']);

    const entries = trafficLogger.getEntries();
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const tx = entries.find((e) => e.direction === 'TX' && e.content === '010C');
    expect(tx).toBeDefined();

    const rx = entries.find((e) => e.direction === 'RX' && e.content.includes('41 0C 1A F8'));
    expect(rx).toBeDefined();
    expect(typeof rx?.durationMs).toBe('number');

    // Verify exported text contains the frames with VIN Redacted header
    const exported = trafficLogger.exportLog();
    expect(exported).toContain('VIN Redacted: YES');
    expect(exported).toContain('TX: 010C');
    expect(exported).toContain('RX');

    trafficLogger.setEnabled(false);
    trafficLogger.clear();
  });
});
