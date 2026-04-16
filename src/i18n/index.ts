import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// Lazy-load other locales on demand
const LOCALE_LOADERS: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
  it: () => import('./locales/it.json'),
  pt: () => import('./locales/pt.json'),
  nl: () => import('./locales/nl.json'),
  pl: () => import('./locales/pl.json'),
  ar: () => import('./locales/ar.json'),
  zh: () => import('./locales/zh.json'),
  hi: () => import('./locales/hi.json'),
};

// Translation status per locale. Set honestly so the language selector
// can tell a user what they'll actually get before they switch:
//   complete — every string translated (currently: English, the source)
//   mostly   — ~90% translated; one section (Digital) still in English
//   partial  — ~50% translated; a significant portion falls back to English
// When the Digital section is translated, promote de/es/fr to 'complete'.
// When another language is properly translated end-to-end, promote it.
export type TranslationStatus = 'complete' | 'mostly' | 'partial';

export const LANGUAGES: ReadonlyArray<{
  code: string;
  name: string;
  status: TranslationStatus;
}> = [
  { code: 'en', name: 'English', status: 'complete' },
  { code: 'de', name: 'Deutsch', status: 'mostly' },
  { code: 'es', name: 'Español', status: 'mostly' },
  { code: 'fr', name: 'Français', status: 'mostly' },
  { code: 'it', name: 'Italiano', status: 'partial' },
  { code: 'pt', name: 'Português', status: 'partial' },
  { code: 'nl', name: 'Nederlands', status: 'partial' },
  { code: 'pl', name: 'Polski', status: 'partial' },
  { code: 'ar', name: 'العربية', status: 'partial' },
  { code: 'zh', name: '中文', status: 'partial' },
  { code: 'hi', name: 'हिन्दी', status: 'partial' },
];

function getSavedLang(): string {
  try {
    return localStorage.getItem('wig-lang') || 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: getSavedLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function changeLanguage(code: string) {
  if (code !== 'en' && !i18n.hasResourceBundle(code, 'translation')) {
    const loader = LOCALE_LOADERS[code];
    if (loader) {
      const mod = await loader();
      i18n.addResourceBundle(code, 'translation', mod.default);
    }
  }
  await i18n.changeLanguage(code);
  try { localStorage.setItem('wig-lang', code); } catch { /* ignore */ }
  if (code === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.removeAttribute('dir');
  }
}

export default i18n;
