import { describe, expect, it } from 'vitest';

import { directionFor, isLanguageCode, LANGUAGES } from '../src/lib/i18n/direction';

describe('directionFor', () => {
  it('resolves Arabic to RTL', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('ar-EG')).toBe('rtl');
  });

  it('resolves English and unknown languages to LTR', () => {
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('fr')).toBe('ltr');
  });
});

describe('isLanguageCode', () => {
  it('accepts only the shipped languages', () => {
    expect(isLanguageCode('ar')).toBe(true);
    expect(isLanguageCode('en')).toBe(true);
    expect(isLanguageCode('fr')).toBe(false);
    expect(isLanguageCode(null)).toBe(false);
    expect(isLanguageCode(undefined)).toBe(false);
  });

  it('keeps Arabic first in the picker order', () => {
    expect(LANGUAGES).toEqual(['ar', 'en']);
  });
});
