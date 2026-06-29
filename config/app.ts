/**
 * URL pública de la app: usada para los códigos QR (registro/agendar por barbería).
 * En web abierta desde el navegador se usa la URL actual; en app nativa (Android/iOS)
 * y cuando no hay VITE_APP_PUBLIC_URL se usa esta.
 */
import type { AccountTier, PosPlan } from '../types';

export const DEFAULT_PUBLIC_APP_URL = 'https://barbershow.net';

/**
 * Modo promocional global: evita pantallas de suscripción vencida y bloqueos por plan.
 * Requerido para cumplir Guideline 3.1.1 en App Store mientras no se use IAP de Apple.
 * Cambiar a false cuando se integre In-App Purchase nativo y se cobren planes.
 */
export const GLOBAL_FREE_MODE = true;

/** Permite el autoregistro de barberías en Android nativo sin IAP. iOS siempre bloqueado (Guideline 3.1.1). */
export const ALLOW_NATIVE_BARBER_SIGNUP = GLOBAL_FREE_MODE;

/**
 * Tier otorgado sin pago mientras GLOBAL_FREE_MODE esté activo.
 * Plan Barbería: varios barberos, una sede, reportes por barbero, etc.
 */
export const PROMOTIONAL_FREE_TIER: AccountTier = 'barberia';

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
