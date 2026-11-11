import { describe, expect, it } from 'vitest';

import fixtures from './fixtures/elm327-responses.json';
import { assessAdapter, parseElmVersion } from '../src/lib/elm327/adapter';
import { classifyElmFailure, isEchoLine, normalizeResponse } from '../src/lib/elm327/parse';

const responses = fixtures.responses;

describe('normalizeResponse', () => {
  it('strips the command echo, the prompt and blank carriage-return noise', () => {
    expect(normalizeResponse(responses.ati, 'ATI')).toEqual(['ELM327 v1.5']);
    expect(normalizeResponse(responses.ate0, 'ATE0')).toEqual(['OK']);
  });

  it('drops SEARCHING progress and BUS INIT OK chatter but keeps payload', () => {
    expect(normalizeResponse(responses.pid0100, '0100')).toEqual(['4100BE3FA813']);
    expect(normalizeResponse(responses.busInitOk, '0100')).toEqual(['4100BE3FA813']);
  });

  it('keeps every line of a multi-frame response', () => {
    expect(normalizeResponse(responses.vin0902, '0902')).toEqual([
      '014',
      '0: 49 02 01 31 44 34',
      '1: 47 50 30 30 52 35 35',
      '2: 42 31 32 33 34 35 36',
    ]);
  });

  it('strips an echoed command that was sent with spaces', () => {
    expect(normalizeResponse(responses.spaces, 'ATZ')).toEqual(['ELM327 v1.5']);
  });

  it('treats an echoed command case-insensitively', () => {
    expect(isEchoLine('at z', 'ATZ')).toBe(true);
    expect(isEchoLine('ATZ ', 'ATZ')).toBe(true);
    expect(isEchoLine('ELM327 v1.5', 'ATZ')).toBe(false);
  });
});

describe('classifyElmFailure', () => {
  const cases: Array<[string, string]> = [
    ['noData', 'no-data'],
    ['unableToConnect', 'unable-to-connect'],
    ['busInitError', 'bus-init-error'],
    ['canError', 'can-error'],
    ['bufferFull', 'buffer-full'],
    ['unknownCommand', 'unknown-command'],
    ['adapterError', 'adapter-error'],
    ['dataError', 'adapter-error'],
    ['stopped', 'adapter-error'],
  ];

  for (const [fixture, code] of cases) {
    it(`maps ${fixture} to ${code}`, () => {
      const command =
        fixture === 'noData' || fixture === 'bufferFull'
          ? '03'
          : fixture === 'unknownCommand'
            ? 'AT@1'
            : '0100';
      const lines = normalizeResponse(responses[fixture as keyof typeof responses], command);
      expect(classifyElmFailure(lines)).toBe(code);
    });
  }

  it('returns null for a healthy payload', () => {
    expect(classifyElmFailure(normalizeResponse(responses.pid0100, '0100'))).toBeNull();
    expect(classifyElmFailure(['014', '0: 49 02 01'])).toBeNull();
  });
});

describe('adapter assessment', () => {
  it('reads the ELM327 version from an identity string', () => {
    expect(parseElmVersion(fixtures.identities.neverGenuineV15)).toBe('1.5');
    expect(parseElmVersion(fixtures.identities.branded)).toBeNull();
  });

  it('flags versions that are never genuine or strongly associated with clones', () => {
    expect(assessAdapter(fixtures.identities.neverGenuineV15).likelyClone).toBe(true);
    expect(assessAdapter(fixtures.identities.cloneV21).likelyClone).toBe(true);
    expect(assessAdapter(fixtures.identities.unknownVersion).likelyClone).toBe(true);
  });

  it('does not warn on genuine or branded adapters', () => {
    expect(assessAdapter(fixtures.identities.genuineV14b).likelyClone).toBe(false);
    expect(assessAdapter(fixtures.identities.genuineV22).likelyClone).toBe(false);
    expect(assessAdapter(fixtures.identities.branded)).toEqual({
      version: null,
      likelyClone: false,
    });
  });
});
