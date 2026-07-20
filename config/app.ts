/**
 * URL pública de la app: usada para los códigos QR (registro/agendar por barbería).
 * En web abierta desde el navegador se usa la URL actual; en app nativa (Android/iOS)
 * y cuando no hay VITE_APP_PUBLIC_URL se usa esta.
 */
import type { AccountTier, PosPlan } from '../types';

export const DEFAULT_PUBLIC_APP_URL = 'https://barbershow.net';

/**
 * Modo promocional global: evita pantallas de suscripción vencida y bloqueos por plan.
 * Desactivado: Plan Barbería se cobra vía App Store / Google Play.
 */
export const GLOBAL_FREE_MODE = true;

/** Permite autoregistro de barberías en app móvil nativa (con IAP cuando aplique). */
export const ALLOW_NATIVE_BARBER_SIGNUP = true;

/**
 * Tier otorgado sin pago mientras GLOBAL_FREE_MODE esté activo.
 * Plan Barbería: varios barberos, una sede, reportes por barbero, etc.
 */
export const PROMOTIONAL_FREE_TIER: AccountTier = 'barberia';

/** Planes disponibles para compra in-app en iOS (fase 1: solo barbería). */
export const IOS_IAP_TIERS: AccountTier[] = ['barberia'];

/** Días de gracia para sedes Barbería del periodo promocional al activar cobro. */
export const PROMO_GRACE_PERIOD_DAYS = 30;

export function tierToDefaultPlan(tier: AccountTier): PosPlan {
  return tier === 'gratuito' || tier === 'solo' ? 'basic' : 'pro';
}

/** Tier y plan interno asignados al autoregistro sin pago. */
export function getFreeSignupTierAndPlan(): { tier: AccountTier; plan: PosPlan } {
  if (GLOBAL_FREE_MODE) {
    return { tier: PROMOTIONAL_FREE_TIER, plan: 'pro' };
  }
  return { tier: 'gratuito', plan: 'basic' };
}

export function isPromotionalFreeTier(tier: AccountTier | null | undefined): boolean {
  return GLOBAL_FREE_MODE && tier === PROMOTIONAL_FREE_TIER;
}

/** Indica si un tier puede comprarse in-app en la plataforma actual. */
export function isTierAvailableForIAP(tier: AccountTier, platform: 'ios' | 'android' | 'web'): boolean {
  if (platform === 'web') return false;
  if (tier === 'gratuito') return false;
  if (platform === 'ios') return IOS_IAP_TIERS.includes(tier);
  return tier === 'solo' || tier === 'barberia' || tier === 'multisede';
}
