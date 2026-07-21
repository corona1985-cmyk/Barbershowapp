export const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'es';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export const LOCALE_STORAGE_KEY = 'appLocale';

/** Mapeo locale app → BCP 47 para Intl / toLocaleDateString */
export const LOCALE_BCP47: Record<AppLocale, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR',
};
