import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { ElmError, errorMessage } from './errors';
import type { Transport } from './transport';

export interface SerialPortInfo {
  name: string;
  kind: 'usb' | 'bluetooth' | 'pci' | 'unknown';
  label: string | null;
}

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  if (!('__TAURI_INTERNALS__' in window)) {
    // Browser preview (Vite) has no Tauri bridge; keep the message human instead of
    // surfacing `invoke is undefined`.
    throw new ElmError('open-failed', 'COM ports are only available in the desktop app.');
  }

  try {
    return await invoke<SerialPortInfo[]>('list_ports');
  } catch (error) {
    throw new ElmError('open-failed', errorMessage(error));
  }
}

export function createSerialTransport(portName: string, baudRate: number): Transport {
  return new SerialTransport(portName, baudRate);
}

class SerialTransport implements Transport {
  private readonly portName: string;
  private readonly baudRate: number;
  private readonly dataHandlers = new Set<(chunk: string) => void>();
  private readonly closedHandlers = new Set<(reason: string | null) => void>();
  private unlisteners: UnlistenFn[] = [];
  private decoder = new TextDecoder('utf-8', { fatal: true });
  private isOpen = false;

  constructor(portName: string, baudRate: number) {
    this.portName = portName;
    this.baudRate = baudRate;
  }

  async open(): Promise<void> {
    this.decoder = new TextDecoder('utf-8', { fatal: true });

    // Register before opening so no early bytes are lost.
    this.unlisteners.push(
      await listen<number[]>('serial-data', (event) => {
        this.handleBytes(event.payload);
      }),
      await listen<{ reason: string | null }>('serial-closed', (event) => {
        this.emitClosed(event.payload.reason);
      }),
    );

    try {
      await invoke('open_port', { port: this.portName, baud: this.baudRate });
      this.isOpen = true;
    } catch (error) {
      this.detach();
      throw new ElmError('open-failed', errorMessage(error));
    }
  }

  async write(data: string): Promise<void> {
    if (!this.isOpen) {
      throw new ElmError('closed', 'The serial port is not open');
    }

    try {
      await invoke('write_port', { data: Array.from(new TextEncoder().encode(data)) });
    } catch (error) {
      throw new ElmError('transport', errorMessage(error));
    }
  }

  async close(): Promise<void> {
    // Always clear the Rust-side state, even after the OS already dropped the port
    // (unplug/Bluetooth loss). Otherwise the next open_port reports "already open".
    await invoke('close_port').catch(() => undefined);
    this.isOpen = false;
    this.detach();
  }

  onData(handler: (chunk: string) => void): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClosed(handler: (reason: string | null) => void): () => void {
    this.closedHandlers.add(handler);
    return () => this.closedHandlers.delete(handler);
  }

  private handleBytes(bytes: number[]): void {
    let chunk: string;
    try {
      chunk = this.decoder.decode(new Uint8Array(bytes), { stream: true });
    } catch {
      this.emitClosed('The adapter sent data that is not valid text.');
      return;
    }

    for (const handler of this.dataHandlers) {
      handler(chunk);
    }
  }

  private emitClosed(reason: string | null): void {
    this.isOpen = false;
    for (const handler of this.closedHandlers) {
      handler(reason);
    }
  }

  private detach(): void {
    const unlisteners = this.unlisteners;
    this.unlisteners = [];
    for (const unlisten of unlisteners) {
      unlisten();
    }
  }
}
