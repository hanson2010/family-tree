'use client';

import * as React from 'react';
import { Locale, defaultLocale, getStoredLocale, setStoredLocale, t, TranslationKey } from '@/lib/i18n';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = React.createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(defaultLocale);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);
    setMounted(true);
  }, []);

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  const translate = React.useCallback((key: TranslationKey) => {
    return t(locale, key);
  }, [locale]);

  // Prevent hydration mismatch by using default locale during SSR
  const value = React.useMemo(() => ({
    locale: mounted ? locale : defaultLocale,
    setLocale,
    t: translate,
  }), [locale, mounted, setLocale, translate]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
