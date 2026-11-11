/**
 * The ELM327 driver only knows this seam. `SerialTransport` talks to the Rust COM bridge,
 * `MockTransport` replays adapter scripts in tests and in the emulator scenario.
 */
export interface Transport {
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: string): Promise<void>;
  /** Returns an unsubscribe function. */
  onData(handler: (chunk: string) => void): () => void;
  /** Fired when the OS drops the port (unplugged adapter / Bluetooth loss). */
  onClosed(handler: (reason: string | null) => void): () => void;
}
