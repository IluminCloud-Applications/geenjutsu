import React, { createContext, useContext, useState } from 'react';
import { Locale } from '../../types';
import { translations, TranslationKey } from '../i18n';

interface I18nContextType {
  locale: Locale;
  language: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKey;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang') as Locale;
    if (langParam === 'pt' || langParam === 'en') return langParam;
    const saved = localStorage.getItem('geenjutsu_locale') as Locale;
    return saved || 'pt';
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('geenjutsu_locale', newLocale);
  };

  const t = translations[locale] || translations.pt;

  return (
    <I18nContext.Provider value={{ locale, language: locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};
