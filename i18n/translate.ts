import type { AppLocale } from '../config/i18n';
import { MESSAGES, type Messages } from './messages';

export type TranslateParams = Record<string, string | number>;

function getNested(obj: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

export function translateKey(
  locale: AppLocale,
  key: string,
  params?: TranslateParams,
  fallbackLocale: AppLocale = 'es',
): string {
  const parts = key.split('.');
  const primary = getNested(MESSAGES[locale] as unknown as Record<string, unknown>, parts);
  if (primary) return interpolate(primary, params);
  const fallback = getNested(MESSAGES[fallbackLocale] as unknown as Record<string, unknown>, parts);
  if (fallback) return interpolate(fallback, params);
  return key;
}

/** Resuelve claves anidadas con fallback al español. */
export function translateFromMessages(
  messages: Messages,
  key: string,
  params?: TranslateParams,
): string {
  const value = getNested(messages as unknown as Record<string, unknown>, key.split('.'));
  return value ? interpolate(value, params) : key;
}
