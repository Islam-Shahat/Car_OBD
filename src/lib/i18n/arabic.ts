/**
 * Arabic-aware search normalization.
 *
 * Arabic spelling is not stable in user input: alef can be written with any
 * hamza form, final ya is often written as alef maqsura, and ta marbuta is
 * often typed as ha. Diacritics (tashkeel) and tatweel are decorative and must
 * never decide whether a car is found. Collapsing the differences here means
 * the UI, the in-memory repository and SQLite all compare the same key.
 */

/** Tashkeel, Quranic marks, superscript alef and the small waqf signs. */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const ALEF_FORMS = /[\u0622\u0623\u0625\u0671]/g;

/** Normalizes one string. Whitespace is collapsed but kept as a separator. */
export function normalizeArabic(value: string): string {
  return value
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(/\u0640/g, '') // tatweel (kashida)
    .replace(ALEF_FORMS, '\u0627')
    .replace(/\u0649/g, '\u064A') // alef maqsura -> ya
    .replace(/\u0629/g, '\u0647') // ta marbuta -> ha
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The value stored in `vehicle_catalog.search_text` and compared with the
 * normalized query. All whitespace is removed so "لاند كروزر" and
 * "لاندكروزر" match the same row.
 */
export function searchKey(...parts: readonly string[]): string {
  return parts.map(normalizeArabic).join(' ').replace(/\s+/g, '');
}
