import { create } from 'zustand';

import {
  connectToSerialPort,
  type ConnectionInfo,
  type SerialConnection,
} from '../../lib/elm327/connect';
import { errorMessage, isElmError, type ElmErrorCode } from '../../lib/elm327/errors';
import type { Elm327Driver } from '../../lib/elm327/driver';
import { listSerialPorts, type SerialPortInfo } from '../../lib/elm327/serialTransport';
import { VehicleIdentityCache } from '../../lib/obd/vehicleIdentity';

export type ConnectionErrorCode = ElmErrorCode | 'disconnected' | 'ports-unavailable' | 'unknown';

export interface ConnectionFailure {
  code: ConnectionErrorCode;
  /** Technical detail from the OS/adapter, shown as secondary information. */
  detail?: string;
}

export interface ConnectionState {
  phase: 'idle' | 'connecting' | 'connected';
  ports: SerialPortInfo[];
  portsLoading: boolean;
  selectedPort: string | null;
  info: ConnectionInfo | null;
  failure: ConnectionFailure | null;
  driver: Elm327Driver | null;
  isDemo: boolean;
  /** One VIN identity per connection, warmed right after a successful init. */
  identityCache: VehicleIdentityCache | null;
  refreshPorts: () => Promise<void>;
  selectPort: (portName: string) => void;
  connect: () => Promise<void>;
  startDemo: () => Promise<void>;
  disconnect: () => Promise<void>;
}

let detachClosed: (() => void) | null = null;

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  phase: 'idle',
  ports: [],
  portsLoading: false,
  selectedPort: null,
  info: null,
  failure: null,
  driver: null,
  isDemo: false,
  identityCache: null,

  refreshPorts: async () => {
    set({ portsLoading: true });

    try {
      const ports = await listSerialPorts();
      set((state) => ({
        ports,
        portsLoading: false,
        selectedPort:
          state.selectedPort && ports.some((port) => port.name === state.selectedPort)
            ? state.selectedPort
            : (ports[0]?.name ?? null),
        failure: state.failure?.code === 'ports-unavailable' ? null : state.failure,
      }));
    } catch (error) {
      set({
        portsLoading: false,
        ports: [],
        failure: { code: 'ports-unavailable', detail: errorMessage(error) },
      });
    }
  },

  selectPort: (portName) => set({ selectedPort: portName }),

  connect: async () => {
    const { selectedPort, phase } = get();
    if (!selectedPort || phase !== 'idle') return;

    set({ phase: 'connecting', failure: null });

    let connection: SerialConnection;
    try {
      connection = await connectToSerialPort(selectedPort);
    } catch (error) {
      set({
        phase: 'idle',
        info: null,
        driver: null,
        identityCache: null,
        failure: {
          code: isElmError(error) ? error.code : 'unknown',
          detail: errorMessage(error),
        },
      });
      return;
    }

    const connectedDriver = connection.driver;
    detachClosed = connection.transport.onClosed((reason) => {
      detachClosed?.();
      detachClosed = null;
      void connectedDriver.close().catch(() => undefined);
      set({
        phase: 'idle',
        info: null,
        driver: null,
        identityCache: null,
        failure: { code: 'disconnected', detail: reason ?? undefined },
      });
    });

    const identityCache = new VehicleIdentityCache(connectedDriver);
    set({
      phase: 'connected',
      info: connection.info,
      driver: connectedDriver,
      identityCache,
      failure: null,
    });
    // Warm the cache right after a successful connection; a missing VIN is
    // never an error and the promise is reused by the first scan.
    void identityCache.load();
  },

  startDemo: async () => {
    const { phase } = get();
    if (phase !== 'idle') return;

    set({ phase: 'connecting', failure: null });

    try {
      const { createDemoConnection } = await import('../../lib/elm327/demoSession');
      const connection = createDemoConnection();
      const connectedDriver = connection.driver;

      detachClosed = connection.transport.onClosed((reason) => {
        detachClosed?.();
        detachClosed = null;
        void connectedDriver.close().catch(() => undefined);
        set({
          phase: 'idle',
          isDemo: false,
          info: null,
          driver: null,
          identityCache: null,
          failure: { code: 'disconnected', detail: reason ?? undefined },
        });
      });

      const identityCache = new VehicleIdentityCache(connectedDriver);
      set({
        phase: 'connected',
        isDemo: true,
        info: connection.info,
        driver: connectedDriver,
        identityCache,
        failure: null,
      });

      void identityCache.load();
    } catch (error) {
      set({
        phase: 'idle',
        isDemo: false,
        failure: {
          code: 'unknown',
          detail: errorMessage(error),
        },
      });
    }
  },

  disconnect: async () => {
    const { driver, phase } = get();
    if (phase !== 'connected') return;

    detachClosed?.();
    detachClosed = null;
    set({
      phase: 'idle',
      isDemo: false,
      info: null,
      driver: null,
      identityCache: null,
      failure: null,
    });
    await driver?.close().catch(() => undefined);
  },
}));
