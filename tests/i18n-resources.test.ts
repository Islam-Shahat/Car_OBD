import { describe, expect, it } from 'vitest';

import ar from '../src/lib/i18n/locales/ar.json';
import en from '../src/lib/i18n/locales/en.json';

function flatten(value: unknown, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();

  if (typeof value !== 'object' || value === null) {
    entries.set(prefix, String(value));
    return entries;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    for (const [nestedPath, text] of flatten(child, path)) {
      entries.set(nestedPath, text);
    }
  }

  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? '').sort();
}

const arKeys = flatten(ar);
const enKeys = flatten(en);

describe('i18n resources', () => {
  it('ships exactly the same keys in Arabic and English', () => {
    expect([...enKeys.keys()].sort()).toEqual([...arKeys.keys()].sort());
  });

  it('keeps interpolation placeholders in sync', () => {
    for (const [key, arText] of arKeys) {
      expect(placeholders(enKeys.get(key) ?? ''), `placeholders for ${key}`).toEqual(
        placeholders(arText),
      );
    }
  });
});
