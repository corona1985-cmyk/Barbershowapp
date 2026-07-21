import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AppLocale } from '../config/i18n';
import { SUPPORTED_LOCALES } from '../config/i18n';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatTime } from './format';
import { getInitialLocale, persistLocale } from './locale';
import { translateKey, type TranslateParams } from './translate';

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: TranslateParams) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

let moduleLocale: AppLocale = getInitialLocale();
const listeners = new Set<() => void>();

function notifyLocaleChange(): void {
  listeners.forEach((listener) => listener());
}

/** Traducción fuera de React (servicios, handlers). */
export function translate(key: string, params?: TranslateParams): string {
  return translateKey(moduleLocale, key, params);
}

export function getLocale(): AppLocale {
  return moduleLocale;
}

export function setGlobalLocale(locale: AppLocale): void {
  moduleLocale = locale;
  persistLocale(locale);
  notifyLocaleChange();
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    moduleLocale = getInitialLocale();
    persistLocale(moduleLocale);
    return moduleLocale;
  });

  const setLocale = useCallback((next: AppLocale) => {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(next)) return;
    moduleLocale = next;
    persistLocale(next);
    setLocaleState(next);
    notifyLocaleChange();
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translateKey(locale, key, params),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatDate: (date, options) => formatDate(locale, date, options),
      formatTime: (date, options) => formatTime(locale, date, options),
      formatDateTime: (date, options) => formatDateTime(locale, date, options),
      formatNumber: (value, options) => formatNumber(locale, value, options),
      formatCurrency: (value, currency) => formatCurrency(locale, value, currency),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation debe usarse dentro de I18nProvider');
  }
  return ctx;
}

/** Hook opcional para componentes que pueden renderizarse sin provider (p. ej. tests). */
export function useTranslationSafe(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: moduleLocale,
    setLocale: setGlobalLocale,
    t: translate,
    formatDate: (date, options) => formatDate(moduleLocale, date, options),
    formatTime: (date, options) => formatTime(moduleLocale, date, options),
    formatDateTime: (date, options) => formatDateTime(moduleLocale, date, options),
    formatNumber: (value, options) => formatNumber(moduleLocale, value, options),
    formatCurrency: (value, currency) => formatCurrency(moduleLocale, value, currency),
  };
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
