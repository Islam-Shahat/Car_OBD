import { describe, expect, it } from 'vitest';

import { nrcMessageKey } from '../src/lib/i18n/errorKeys';

describe('negative response code messages', () => {
  it('maps the common Mode 03/04/07/0A NRCs to friendly keys', () => {
    expect(nrcMessageKey(0x10)).toBe('errors.nrc.generalReject');
    expect(nrcMessageKey(0x11)).toBe('errors.nrc.serviceNotSupported');
    expect(nrcMessageKey(0x12)).toBe('errors.nrc.subFunctionNotSupported');
    expect(nrcMessageKey(0x13)).toBe('errors.nrc.incorrectLength');
    expect(nrcMessageKey(0x21)).toBe('errors.nrc.busy');
    expect(nrcMessageKey(0x22)).toBe('errors.nrc.conditionsNotCorrect');
    expect(nrcMessageKey(0x31)).toBe('errors.nrc.requestOutOfRange');
    expect(nrcMessageKey(0x33)).toBe('errors.nrc.securityDenied');
    expect(nrcMessageKey(0x78)).toBe('errors.nrc.responsePending');
  });

  it('uses the translated fallback for an unknown NRC', () => {
    expect(nrcMessageKey(0x99)).toBe('errors.nrc.unknown');
  });
});
