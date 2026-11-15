import { describe, expect, it } from 'vitest';
import { Elm327Driver } from '../src/lib/elm327/driver';
import { MockTransport } from '../src/lib/elm327/mockTransport';
import { isElmError } from '../src/lib/elm327/errors';
import capturesData from './fixtures/real-car-captures.json';

describe('Real Car Captures & Multi-Protocol Hardware Fixtures', () => {
  it('parses real 2018 Toyota Corolla CAN traffic correctly', async () => {
    const capture = capturesData.captures.find(
      (c) => c.id === 'can_toyota_corolla_2018_pic18f25k80',
    );
    expect(capture).toBeDefined();

    const lookup = new Map<string, string>();
    for (const d of capture!.dialogue) {
      lookup.set(d.tx, d.rx);
    }

    const transport = new MockTransport((cmd) => {
      const rx = lookup.get(cmd) ?? 'OK';
      return `${rx}\r\r>`;
    });
    await transport.open();

    const driver = new Elm327Driver(transport);
    const info = await driver.initialize();

    expect(info.ecuPresent).toBe(true);
    expect(info.protocol).toBe('ISO 15765-4 (CAN 11/500)');

    const dtcResponse = await driver.send('03');
    expect(dtcResponse.lines[0]).toBe('43 01 01 33 00 00');
  });

  it('parses real 2006 Hyundai Elantra KWP FAST traffic with bus init quirks', async () => {
    const capture = capturesData.captures.find(
      (c) => c.id === 'kwp_hyundai_elantra_2006_clone_v15',
    );
    expect(capture).toBeDefined();

    const lookup = new Map<string, string>();
    for (const d of capture!.dialogue) {
      lookup.set(d.tx, d.rx);
    }

    const transport = new MockTransport((cmd) => {
      const rx = lookup.get(cmd) ?? 'OK';
      return `${rx}\r\r>`;
    });
    await transport.open();

    const driver = new Elm327Driver(transport);
    const info = await driver.initialize();

    expect(info.ecuPresent).toBe(true);
    expect(info.protocol).toBe('ISO 14230-4 (KWP FAST)');

    const pidsResponse = await driver.send('0101');
    expect(pidsResponse.lines[0]).toBe('41 01 00 07 65 00');
  });

  it('handles ignition off condition with typed unable-to-connect failure', async () => {
    const capture = capturesData.captures.find((c) => c.id === 'ignition_off_scenario');
    expect(capture).toBeDefined();

    const lookup = new Map<string, string>();
    for (const d of capture!.dialogue) {
      lookup.set(d.tx, d.rx);
    }

    const transport = new MockTransport((cmd) => {
      const rx = lookup.get(cmd) ?? 'OK';
      return `${rx}\r\r>`;
    });
    await transport.open();

    const driver = new Elm327Driver(transport);
    const info = await driver.initialize();

    // Adapter responds, but vehicle ECU is unreachable
    expect(info.ecuPresent).toBe(false);

    // Attempting to query PIDs when ignition is OFF throws typed error
    await expect(driver.send('0100')).rejects.toSatisfy((err) => {
      return isElmError(err) && err.code === 'unable-to-connect';
    });
  });
});
