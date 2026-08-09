'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dictionaries, Locale, LOCALES } from './translations';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /**
   * Looks up a dot-path key (e.g. "nav.dashboard") in the current locale's
   * dictionary, falling back to English if the current locale is missing
   * that key, and to the raw key itself if even English is missing it —
   * so an unreviewed or incomplete translation never renders as a blank
   * string. {{var}} tokens in the result are replaced from `vars`.
   */
  t: (key: string, vars?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'nuruddeen-sms-locale';

function getByPath(obj: unknown, path: string): string | undefined {
  return path.split('.').reduce<any>((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    const preferred: Locale = stored && LOCALES.includes(stored) ? stored : 'en';
    setLocaleState(preferred);
    document.documentElement.setAttribute('lang', preferred);
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.setAttribute('lang', next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const value = getByPath(dictionaries[locale], key) ?? getByPath(dictionaries.en, key) ?? key;
      if (!vars) return value;
      return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{{${k}}}`, v), value);
    },
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      <div style={{ display: 'contents', visibility: hydrated ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
