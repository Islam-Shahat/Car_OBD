import { describe, expect, it } from 'vitest';

import {
  commandWithPid,
  decodeMessages,
  firstPayload,
  messagesFor,
  negativeResponse,
  parseHexBytes,
  pidLabel,
} from '../src/lib/obd/frames';

describe('parseHexBytes', () => {
  it('parses compact and spaced hex', () => {
    expect(parseHexBytes('4100BE3FA813')).toEqual([0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13]);
    expect(parseHexBytes('41 00 be 3f a8 13')).toEqual([0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13]);
  });

  it('rejects odd-length hex and non-data lines', () => {
    expect(parseHexBytes('014')).toBeNull();
    expect(parseHexBytes('NO DATA')).toBeNull();
    expect(parseHexBytes('')).toBeNull();
  });
});

describe('decodeMessages', () => {
  it('keeps single-frame answers as one message each', () => {
    const messages = decodeMessages(['410C1AF8', '410D0A']);
    expect(messages).toEqual([
      { bytes: [0x41, 0x0c, 0x1a, 0xf8], lines: ['410C1AF8'] },
      { bytes: [0x41, 0x0d, 0x0a], lines: ['410D0A'] },
    ]);
  });

  it('reassembles numbered ISO-TP frames and skips the length line', () => {
    const messages = decodeMessages([
      '014',
      '0: 49 02 01 57 50 30',
      '1: 5A 5A 5A 39 39 5A 54',
      '2: 53 33 39 30 30 30 30',
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.bytes).toEqual([
      0x49, 0x02, 0x01, 0x57, 0x50, 0x30, 0x5a, 0x5a, 0x5a, 0x39, 0x39, 0x5a, 0x54, 0x53, 0x33,
      0x39, 0x30, 0x30, 0x30, 0x30,
    ]);
  });

  it('starts a new message at every 0: block (several ECUs)', () => {
    const messages = decodeMessages([
      '0: 41 0C 1A F8',
      '1: 00 00 00 00 00 00',
      '0: 41 0C 0F A0',
      '1: 00 00 00 00 00 00',
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.bytes.slice(0, 4)).toEqual([0x41, 0x0c, 0x1a, 0xf8]);
    expect(messages[1]?.bytes.slice(0, 4)).toEqual([0x41, 0x0c, 0x0f, 0xa0]);
  });

  it('keeps multi-frame padding bytes (decoders must drop zero DTCs/VIN padding)', () => {
    const messages = decodeMessages(['0: 43 01 43 03 00 01 96', '1: 02 34 00 00 00 00 00']);
    expect(messages[0]?.bytes).toEqual([
      0x43, 0x01, 0x43, 0x03, 0x00, 0x01, 0x96, 0x02, 0x34, 0, 0, 0, 0, 0,
    ]);
  });

  it('parses ATH1 single frames and keeps the CAN identifier', () => {
    const messages = decodeMessages([
      '7E8 06 41 00 BE 3F A8 13',
      '7E9 04 41 0C 0F A0',
      '7EA 02 43 00',
    ]);

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      bytes: [0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13],
      ecuId: '7E8',
    });
    expect(messages[1]).toMatchObject({ bytes: [0x41, 0x0c, 0x0f, 0xa0], ecuId: '7E9' });
    expect(messages[2]).toMatchObject({ bytes: [0x43, 0x00], ecuId: '7EA' });
  });

  it('reassembles ATH1 multi-frame answers per ECU without merging them', () => {
    const messages = decodeMessages([
      '7E8 10 14 49 02 01 57 50 30',
      '7E8 21 5A 5A 5A 39 39 5A 54',
      '7E8 22 53 33 39 30 30 30 30',
      '7E9 10 14 49 02 01 31 4D 38',
      '7E9 21 47 44 4D 39 41 58 4B',
      '7E9 22 50 30 34 32 37 38 38',
    ]);

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.ecuId)).toEqual(['7E8', '7E9']);
    expect(messages.map((message) => message.bytes.length)).toEqual([20, 20]);
    expect(messages[0]?.bytes.slice(0, 3)).toEqual([0x49, 0x02, 0x01]);
    expect(messages[1]?.bytes.slice(0, 3)).toEqual([0x49, 0x02, 0x01]);
  });

  it('leaves 29-bit-style and non-CAN headers untouched', () => {
    expect(decodeMessages(['18DAF110 04 41 0C 1A F8'])[0]?.ecuId).toBeUndefined();
  });
});

describe('message helpers', () => {
  const messages = decodeMessages(['410C1AF8', '410D0A', '7F 02 12']);

  it('filters by service and PID', () => {
    expect(messagesFor(messages, 0x41)).toHaveLength(2);
    expect(messagesFor(messages, 0x41, 0x0d)).toHaveLength(1);
    expect(firstPayload(messages, 0x41, 0x0c)).toEqual([0x1a, 0xf8]);
  });

  it('finds a negative response', () => {
    expect(negativeResponse(messages)).toEqual({ service: 0x02, nrc: 0x12 });
  });

  it('formats commands and PID labels', () => {
    expect(commandWithPid(0x01, 0x0c)).toBe('010C');
    expect(commandWithPid(0x0a, 0x00)).toBe('0A00');
    expect(pidLabel(0x0c)).toBe('0x0C');
  });
});
