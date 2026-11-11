import { Elm327Driver, type AdapterInfo, type Elm327Options } from './driver';
import { ElmError, errorMessage, isElmError } from './errors';
import { createSerialTransport } from './serialTransport';
import type { Transport } from './transport';

/** USB adapters usually run at 38400; Bluetooth SPP often ships at 115200 or 9600. */
export const DEFAULT_BAUD_RATES = [38400, 115200, 9600] as const;

export interface ConnectOptions {
  baudRates?: readonly number[];
  createTransport?: (portName: string, baudRate: number) => Transport;
  driverOptions?: Elm327Options;
}

export interface ConnectionInfo extends AdapterInfo {
  baudRate: number;
}

export interface SerialConnection {
  driver: Elm327Driver;
  transport: Transport;
  info: ConnectionInfo;
}

/**
 * Tries each baud rate in order until the adapter answers the init sequence.
 * The first successful session is returned; every failed attempt is closed.
 */
export async function connectToSerialPort(
  portName: string,
  options: ConnectOptions = {},
): Promise<SerialConnection> {
  const baudRates = options.baudRates ?? DEFAULT_BAUD_RATES;
  const createTransport = options.createTransport ?? createSerialTransport;
  let lastError: unknown = null;

  for (const baudRate of baudRates) {
    const transport = createTransport(portName, baudRate);
    let driver: Elm327Driver | null = null;

    try {
      await transport.open();
      driver = new Elm327Driver(transport, options.driverOptions);
      const info = await driver.initialize();
      return { driver, transport, info: { ...info, baudRate } };
    } catch (error) {
      lastError = error;
      if (driver) {
        await driver.close().catch(() => undefined);
      } else {
        await transport.close().catch(() => undefined);
      }
    }
  }

  if (isElmError(lastError)) {
    throw lastError;
  }
  throw new ElmError(
    'open-failed',
    lastError ? errorMessage(lastError) : `No response from ${portName} at any baud rate`,
  );
}
