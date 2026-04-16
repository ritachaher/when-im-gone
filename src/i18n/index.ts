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

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ar', name: 'العربية' },
  { code: 'zh', name: '中文' },
  { code: 'hi', name: 'हिन्दी' },
] as const;

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
