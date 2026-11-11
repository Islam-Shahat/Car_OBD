import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { readStored, writeStored } from '../storage';
import { directionFor, isLanguageCode, type LanguageCode } from './direction';
import ar from './locales/ar.json';
import en from './locales/en.json';

const LANGUAGE_STORAGE_KEY = 'obd.language';
export const DEFAULT_LANGUAGE: LanguageCode = 'ar';

function storedLanguage(): LanguageCode {
  const stored = readStored(LANGUAGE_STORAGE_KEY);
  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
}

/** The <html> element is the single source of truth for direction and language. */
export function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
  document.documentElement.dir = directionFor(language);
}

export async function initI18n(): Promise<void> {
  const language = storedLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
  });

  applyDocumentLanguage(language);

  i18n.on('languageChanged', (changed: string) => {
    applyDocumentLanguage(changed);
    writeStored(LANGUAGE_STORAGE_KEY, changed);
  });
}

export default i18n;
