import { describe, expect, it } from 'vitest';

import {
  decodeDtcPair,
  decodeDtcPayload,
  isZeroDtc,
  uniqueDtcs,
  type Dtc,
} from '../src/lib/obd/dtc';

describe('decodeDtcPair', () => {
  it('decodes the known example 43 01 33 -> P0133', () => {
    const dtc = decodeDtcPair(0x01, 0x33);
    expect(dtc.code).toBe('P0133');
    expect(dtc.system).toBe('P');
    expect(dtc.raw).toBe('0133');
    expect(isZeroDtc(dtc)).toBe(false);
  });

  it('maps the top two bits to P/C/B/U', () => {
    expect(decodeDtcPair(0x01, 0x23).code).toBe('P0123');
    expect(decodeDtcPair(0x41, 0x23).code).toBe('C0123');
    expect(decodeDtcPair(0x81, 0x23).code).toBe('B0123');
    expect(decodeDtcPair(0xc1, 0x23).code).toBe('U0123');
  });

  it('uses the manufacturer-specific P1xxx/P2xxx/P3xxx ranges', () => {
    expect(decodeDtcPair(0x10, 0x01).code).toBe('P1001');
    expect(decodeDtcPair(0x21, 0x00).code).toBe('P2100');
    expect(decodeDtcPair(0x30, 0x42).code).toBe('P3042');
  });
});

describe('decodeDtcPayload', () => {
  it('returns no codes for an empty or zero answer', () => {
    expect(decodeDtcPayload([])).toEqual([]);
    expect(decodeDtcPayload([0x00])).toEqual([]);
    expect(decodeDtcPayload([0x00, 0x00, 0x00, 0x00])).toEqual([]);
  });

  it('decodes CAN answers without a count byte', () => {
    expect(decodeDtcPayload([0x01, 0x33]).map((dtc) => dtc.code)).toEqual(['P0133']);
    expect(decodeDtcPayload([0x01, 0x33, 0x03, 0x00, 0x00, 0x00]).map((dtc) => dtc.code)).toEqual([
      'P0133',
      'P0300',
    ]);
  });

  it('decodes ISO 9141/14230 answers with a count byte', () => {
    expect(decodeDtcPayload([0x01, 0x01, 0x33]).map((dtc) => dtc.code)).toEqual(['P0133']);
    expect(decodeDtcPayload([0x02, 0x01, 0x33, 0x03, 0x00]).map((dtc) => dtc.code)).toEqual([
      'P0133',
      'P0300',
    ]);
  });

  it('drops multi-frame zero padding', () => {
    expect(
      decodeDtcPayload([
        0x01, 0x43, 0x03, 0x00, 0x01, 0x96, 0x02, 0x34, 0x00, 0x00, 0x00, 0x00,
      ]).map((dtc) => dtc.code),
    ).toEqual(['P0143', 'P0300', 'P0196', 'P0234']);
  });
});

describe('uniqueDtcs', () => {
  it('keeps the first DTC for each code', () => {
    const first = decodeDtcPair(0x01, 0x33);
    const second = decodeDtcPair(0x03, 0x00);
    const duplicate = decodeDtcPair(0x01, 0x33);

    expect(uniqueDtcs([first, second, duplicate]).map((dtc) => dtc.code)).toEqual([
      'P0133',
      'P0300',
    ]);
  });

  it('accepts a readonly list', () => {
    const codes: readonly Dtc[] = [decodeDtcPair(0x01, 0x33)];
    expect(uniqueDtcs(codes)).toHaveLength(1);
  });
});
