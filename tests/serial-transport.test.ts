import { describe, expect, it, vi } from 'vitest';

import { SerialTransport } from '../src/lib/elm327/serialTransport';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

describe('SerialTransport streaming UTF-8 decoder', () => {
  it('buffers split multi-byte UTF-8 sequences across chunks and survives stray high-bit noise bytes', () => {
    const transport = new SerialTransport('COM1', 115200);

    const receivedChunks: string[] = [];
    let closedReason: string | null = 'not-closed';

    transport.onData((chunk) => {
      receivedChunks.push(chunk);
    });

    transport.onClosed((reason) => {
      closedReason = reason;
    });

    // Arabic letter 'ع' is UTF-8 [0xD8, 0xB9]
    // Feed first half of 'ع' (split multi-byte sequence)
    transport.handleBytes([0xd8]);
    expect(receivedChunks).toEqual([]);

    // Feed second half of 'ع' followed by ASCII '>'
    transport.handleBytes([0xb9, 0x3e]);
    expect(receivedChunks).toEqual(['ع>']);

    // Feed stray high-bit noise byte (0xFF) common on dirty serial lines before baud lock
    transport.handleBytes([0xff]);

    // Feed valid ASCII command response afterwards
    transport.handleBytes([0x4f, 0x4b, 0x0d]); // 'OK\r'

    // Verify connection was NEVER closed by the stray high-bit byte
    expect(closedReason).toBe('not-closed');

    // Verify all valid characters and subsequent data were received
    const combinedOutput = receivedChunks.join('');
    expect(combinedOutput).toContain('ع>');
    expect(combinedOutput).toContain('OK\r');
  });
});
