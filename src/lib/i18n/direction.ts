export type LanguageCode = 'ar' | 'en';

/** UI order: Arabic first. */
export const LANGUAGES: readonly LanguageCode[] = ['ar', 'en'];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'ar' || value === 'en';
}

/** Arabic is the only RTL language in scope today; everything else falls back to LTR. */
export function directionFor(language: string): 'rtl' | 'ltr' {
  return language.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr';
}
