import type { AppLocale } from '../config/i18n';
import es from '../locales/es.json';
import en from '../locales/en.json';
import pt from '../locales/pt.json';

export type Messages = typeof es;

export const MESSAGES: Record<AppLocale, Messages> = { es, en, pt };
