import { AppLocale, LOCALE_BCP47 } from '../config/i18n';

export function getBcp47(locale: AppLocale): string {
  return LOCALE_BCP47[locale];
}

export function formatDate(
  locale: AppLocale,
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(getBcp47(locale), options);
}

export function formatTime(
  locale: AppLocale,
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString(getBcp47(locale), options);
}

export function formatDateTime(
  locale: AppLocale,
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString(getBcp47(locale), options);
}

export function formatNumber(
  locale: AppLocale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(getBcp47(locale), options);
}

export function formatCurrency(
  locale: AppLocale,
  value: number,
  currency = 'USD',
): string {
  return value.toLocaleString(getBcp47(locale), { style: 'currency', currency });
}
