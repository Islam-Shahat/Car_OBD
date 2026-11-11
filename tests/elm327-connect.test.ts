import { describe, expect, it } from 'vitest';

import { DEFAULT_BAUD_RATES, connectToSerialPort } from '../src/lib/elm327/connect';
import { MockTransport } from '../src/lib/elm327/mockTransport';

function adapterScript(identity = 'ELM327 v1.4b'): (command: string) => string | null {
  const table: Record<string, string> = {
    ATZ: `${identity}\r\r>`,
    ATI: `${identity}\r\r>`,
    'AT@1': 'OBDII to RS232 Interpreter\r\r>',
    ATE0: 'OK\r\r>',
    ATL0: 'OK\r\r>',
    ATS0: 'OK\r\r>',
    ATH0: 'OK\r\r>',
    ATST32: 'OK\r\r>',
    ATAT1: 'OK\r\r>',
    ATSP0: 'OK\r\r>',
    '0100': '4100BE3FA813\r\r>',
    ATDP: 'ISO 15765-4 (CAN 11/500)\r\r>',
  };

  return (command) => table[command] ?? '?\r\r>';
}

describe('connectToSerialPort', () => {
  it('probes the baud rates in order and returns the first working session', async () => {
    const attempts: number[] = [];
    const transports: MockTransport[] = [];

    const connection = await connectToSerialPort('COM3', {
      createTransport: (_portName, baudRate) => {
        attempts.push(baudRate);
        const transport = new MockTransport(baudRate === 9600 ? adapterScript() : () => null);
        transports.push(transport);
        return transport;
      },
      driverOptions: { timeoutMs: 20, resetTimeoutMs: 25, maxTimeoutMs: 50 },
    });

    expect(attempts).toEqual([...DEFAULT_BAUD_RATES]);
    expect(connection.info.baudRate).toBe(9600);
    expect(connection.info.identity).toBe('ELM327 v1.4b');
    expect(transports[0]?.isOpen).toBe(false);
    expect(transports[1]?.isOpen).toBe(false);
    expect(transports[2]?.isOpen).toBe(true);

    await connection.driver.close();
  });

  it('reports the last adapter error when every baud rate fails', async () => {
    await expect(
      connectToSerialPort('COM9', {
        createTransport: () => new MockTransport(() => null),
        driverOptions: { timeoutMs: 10, resetTimeoutMs: 15, maxTimeoutMs: 20 },
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('reconnects after the adapter is unplugged and replugged', async () => {
    const transports: MockTransport[] = [];
    const createTransport = () => {
      const transport = new MockTransport(adapterScript());
      transports.push(transport);
      return transport;
    };

    const first = await connectToSerialPort('COM3', { baudRates: [38400], createTransport });
    expect(first.info.ecuPresent).toBe(true);

    transports[0]?.emitClosed('USB device removed');
    await expect(first.driver.send('03')).rejects.toMatchObject({ code: 'closed' });
    expect(first.driver.isOpen).toBe(false);

    const second = await connectToSerialPort('COM3', { baudRates: [38400], createTransport });
    expect(second.info.identity).toBe('ELM327 v1.4b');
    expect(transports[1]?.isOpen).toBe(true);

    await second.driver.close();
  });
});
