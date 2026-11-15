import { describe, expect, it } from 'vitest';

import makesData from '../src/data/makes.json';
import catalogData from '../src/data/vehicle-catalog.json';
import wmiData from '../src/data/wmi.json';
import { normalizeArabic, searchKey } from '../src/lib/i18n/arabic';

const MAKES = makesData;
const ENTRIES = catalogData.entries;
const WMI_SLUGS = [
  ...new Set(
    Object.values(wmiData.entries as Record<string, { makeSlug: string | null }>)
      .map((entry) => entry.makeSlug)
      .filter((slug): slug is string => Boolean(slug)),
  ),
];

describe('Arabic search normalization', () => {
  it('unifies alef, alef maqsura and ta marbuta', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آدم')).toBe('ادم');
    expect(normalizeArabic('مصطفى')).toBe('مصطفي');
    expect(normalizeArabic('سيارة')).toBe('سياره');
  });

  it('removes diacritics and tatweel', () => {
    expect(normalizeArabic('كُورُولَّا')).toBe('كورولا');
    expect(normalizeArabic('كـــورولا')).toBe('كورولا');
    expect(normalizeArabic('إِلِنْتِرَا')).toBe('النترا');
  });

  it('lowercases Latin text and collapses whitespace', () => {
    expect(normalizeArabic('  Land   Cruiser  ')).toBe('land cruiser');
    expect(searchKey('لاند كروزر')).toBe('لاندكروزر');
    expect(searchKey('لاندكروزر')).toBe('لاندكروزر');
    expect(searchKey('Land', 'Cruiser')).toBe('landcruiser');
  });
});

describe('vehicle catalog integrity', () => {
  it('only uses make slugs that makes.json knows', () => {
    const known = new Set(MAKES);
    const catalogSlugs = [...new Set(ENTRIES.map((entry) => entry.makeSlug))];
    expect(catalogSlugs.filter((slug) => !known.has(slug))).toEqual([]);
  });

  it('has at least one model for every make a VIN can decode', () => {
    const catalogSlugs = new Set(ENTRIES.map((entry) => entry.makeSlug));
    expect(WMI_SLUGS.filter((slug) => !catalogSlugs.has(slug))).toEqual([]);
  });

  it('keeps ids unique, preserves source tiers, and leaves verified = false', () => {
    expect(new Set(ENTRIES.map((entry) => entry.id)).size).toBe(ENTRIES.length);
    const cited = ENTRIES.filter((e) => e.sourceTier === 'cited');
    const knowledge = ENTRIES.filter((e) => e.sourceTier === 'knowledge');
    expect(cited.length).toBe(51);
    expect(knowledge.length).toBe(ENTRIES.length - 51);
    for (const entry of ENTRIES) {
      expect(['cited', 'knowledge']).toContain(entry.sourceTier);
      expect(entry.verified).toBe(false);
      expect(entry.yearFrom).toBeNull();
      expect(entry.yearTo).toBeNull();
    }
  });

  it('gives every make the Arabic spellings its models share', () => {
    const expected: Record<string, string> = {
      toyota: searchKey('تويوتا'),
      hyundai: searchKey('هيونداي'),
      nissan: searchKey('نيسان'),
      chevrolet: searchKey('شيفروليه'),
      daihatsu: searchKey('دايهاتسو'),
      isuzu: searchKey('إيسوزو'),
      porsche: searchKey('بورش'),
      ssangyong: searchKey('سانج يونج'),
      subaru: searchKey('سوبارو'),
      tesla: searchKey('تسلا'),
      volvo: searchKey('فولفو'),
    };
    for (const entry of ENTRIES) {
      expect(Array.isArray(entry.makeAliasesAr)).toBe(true);
      expect(entry.aliasesAr.length).toBeGreaterThan(0);
      const keys = entry.makeAliasesAr.map((alias) => searchKey(alias));
      if (expected[entry.makeSlug]) expect(keys).toContain(expected[entry.makeSlug]);
    }
  });

  it('finds common Arabic make and model spellings', () => {
    const has = (needle: string, model: string): boolean =>
      ENTRIES.some(
        (entry) =>
          entry.model === model &&
          searchKey(
            entry.make,
            entry.model,
            ...entry.makeAliasesAr,
            ...entry.aliasesAr,
            ...entry.aliasesEn,
          ).includes(searchKey(needle)),
      );

    expect(has('تويوتا', 'Corolla')).toBe(true);
    expect(has('تيوتا', 'Corolla')).toBe(true);
    expect(has('هونداي', 'Elantra')).toBe(true);
    expect(has('هيوندي', 'Elantra')).toBe(true);
    expect(has('إلنترا', 'Elantra')).toBe(true);
    expect(has('لاند كروزر', 'Land Cruiser')).toBe(true);
    expect(has('لاندكروزر', 'Land Cruiser')).toBe(true);
    expect(has('فولفو', 'XC60')).toBe(true);
    expect(has('تسلا', 'Model 3')).toBe(true);
  });

  it('keeps Daewoo and Chevrolet cross-listed models unique (one entry per model)', () => {
    const lanos = ENTRIES.filter((e) => e.model.toLowerCase() === 'lanos');
    const nubira = ENTRIES.filter((e) => e.model.toLowerCase() === 'nubira');
    const matiz = ENTRIES.filter((e) => e.model.toLowerCase() === 'matiz');
    const cielo = ENTRIES.filter((e) => e.model.toLowerCase() === 'cielo');

    expect(lanos).toHaveLength(1);
    expect(lanos[0]?.makeSlug).toBe('chevrolet');
    expect(nubira).toHaveLength(1);
    expect(nubira[0]?.makeSlug).toBe('chevrolet');
    expect(matiz).toHaveLength(1);
    expect(matiz[0]?.makeSlug).toBe('chevrolet');
    expect(cielo).toHaveLength(1);
    expect(cielo[0]?.makeSlug).toBe('chevrolet');

    // Daewoo retains non-duplicate models
    const daewooModels = ENTRIES.filter((e) => e.makeSlug === 'daewoo').map((e) => e.model);
    expect(daewooModels).toEqual(['Leganza', 'Espero']);
  });
});
