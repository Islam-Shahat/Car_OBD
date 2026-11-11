import type { Transport } from './transport';

export interface MockTransportOptions {
  /** Split every response into chunks to exercise the driver's buffering. */
  chunkSize?: number;
}

/**
 * Scripted adapter for tests and emulator replay. The responder receives a single
 * command (without CR) and returns the raw adapter text including the `>` prompt,
 * or `null` to simulate a silent adapter (timeout).
 */
export class MockTransport implements Transport {
  private readonly responder: (command: string) => string | null;
  private readonly options: MockTransportOptions;
  private readonly dataHandlers = new Set<(chunk: string) => void>();
  private readonly closedHandlers = new Set<(reason: string | null) => void>();
  private opened = false;

  written: string[] = [];

  constructor(responder: (command: string) => string | null, options: MockTransportOptions = {}) {
    this.responder = responder;
    this.options = options;
  }

  open(): Promise<void> {
    this.opened = true;
    return Promise.resolve();
  }

  get isOpen(): boolean {
    return this.opened;
  }

  close(): Promise<void> {
    this.opened = false;
    return Promise.resolve();
  }

  write(data: string): Promise<void> {
    if (!this.opened) {
      throw new Error('MockTransport is closed');
    }

    for (const command of data.split('\r').filter((part) => part.length > 0)) {
      this.written.push(command);
      const response = this.responder(command);
      if (response !== null) {
        this.emit(response);
      }
    }

    return Promise.resolve();
  }

  onData(handler: (chunk: string) => void): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClosed(handler: (reason: string | null) => void): () => void {
    this.closedHandlers.add(handler);
    return () => this.closedHandlers.delete(handler);
  }

  /** Simulates an unplugged adapter. */
  emitClosed(reason: string | null): void {
    this.opened = false;
    for (const handler of this.closedHandlers) {
      handler(reason);
    }
  }

  private emit(text: string): void {
    const size = this.options.chunkSize ?? text.length;
    for (let offset = 0; offset < text.length; offset += size) {
      const chunk = text.slice(offset, offset + size);
      for (const handler of this.dataHandlers) {
        handler(chunk);
      }
    }
  }
}
