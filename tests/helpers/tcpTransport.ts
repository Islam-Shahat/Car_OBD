import { Socket } from 'node:net';

import type { Transport } from '../../src/lib/elm327/transport';

/** Test-only transport: talks to the Python ELM327-emulator's TCP mode. */
export class TcpTransport implements Transport {
  private readonly port: number;
  private readonly host: string;
  private readonly socket = new Socket();
  private readonly dataHandlers = new Set<(chunk: string) => void>();
  private readonly closedHandlers = new Set<(reason: string | null) => void>();
  private intentionallyClosed = false;

  constructor(port: number, host = '127.0.0.1') {
    this.port = port;
    this.host = host;

    this.socket.on('data', (buffer: Buffer) => {
      const chunk = buffer.toString('utf8');
      for (const handler of this.dataHandlers) {
        handler(chunk);
      }
    });

    this.socket.on('close', () => {
      if (this.intentionallyClosed) return;
      for (const handler of this.closedHandlers) {
        handler(null);
      }
    });

    this.socket.on('error', (error: Error) => {
      if (this.intentionallyClosed) return;
      for (const handler of this.closedHandlers) {
        handler(error.message);
      }
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('error', reject);
      this.socket.connect(this.port, this.host);
    });
  }

  close(): Promise<void> {
    this.intentionallyClosed = true;
    this.socket.destroy();
    return Promise.resolve();
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(data, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  onData(handler: (chunk: string) => void): () => void {
    this.dataHandlers.add(handler);
    return () => this.dataHandlers.delete(handler);
  }

  onClosed(handler: (reason: string | null) => void): () => void {
    this.closedHandlers.add(handler);
    return () => this.closedHandlers.delete(handler);
  }
}
