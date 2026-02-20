/**
 * Google Play Billing para suscripciones de planes (Solo, Barbería, Multi-Sede).
 * Solo tiene efecto en la app Android (Capacitor). En web no se usa.
 *
 * Configuración: ver PLAY_BILLING.md (product IDs en Play Console y Cloud Function de verificación).
 */

import { Capacitor } from '@capacitor/core';
import { Subscriptions } from '@squareetlabs/capacitor-subscriptions';
import type { AccountTier } from '../types';

const APP_ID = 'com.barbershow.app';

/** URL del endpoint que verifica el purchase token con Google Play API. Crear en functions (ver PLAY_BILLING.md). */
const GOOGLE_VERIFY_ENDPOINT = 'https://us-central1-gen-lang-client-0624135070.cloudfunctions.net/verifyGooglePlayReceipt';

/** Product IDs en Play Console (deben coincidir con las suscripciones creadas). */
const PRODUCT_IDS: Record<AccountTier, { monthly: string; yearly: string }> = {
  solo:      { monthly: 'plan_solo_monthly',      yearly: 'plan_solo_yearly' },
  barberia:  { monthly: 'plan_barberia_monthly', yearly: 'plan_barberia_yearly' },
  multisede: { monthly: 'plan_multisede_monthly', yearly: 'plan_multisede_yearly' },
};

let initialized = false;

/**
 * Indica si la app corre en Android y el plugin de suscripciones está disponible (Capacitor).
 */
export function isPlayBillingAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

/**
 * Obtiene el product ID de Google Play para un plan y ciclo.
 */
export function getPlayProductId(plan: AccountTier, cycle: 'mensual' | 'anual'): string {
  const ids = PRODUCT_IDS[plan];
  return cycle === 'anual' ? ids.yearly : ids.monthly;
}

/**
 * Inicializa la verificación de Google (solo Android). Llamar una vez al arranque de la app.
 * Si no llamas esto, el plugin puede no devolver fechas de vencimiento en Android.
 */
export function initPlayBilling(verificationUrl?: string): void {
  if (!isPlayBillingAvailable()) return;
  try {
    Subscriptions.setGoogleVerificationDetails({
      googleVerifyEndpoint: verificationUrl || GOOGLE_VERIFY_ENDPOINT,
      bid: APP_ID,
    });
    initialized = true;
  } catch {
    // Plugin no disponible o error; ignorar
  }
}

/**
 * Abre el flujo nativo de compra de Google Play para el plan y ciclo indicados.
 * En Android el resultado llega de forma asíncrona; usa addPlayPurchaseListener para reaccionar.
 */
export async function purchasePlan(plan: AccountTier, cycle: 'mensual' | 'anual'): Promise<{ success: boolean; message?: string }> {
  if (!isPlayBillingAvailable()) {
    return { success: false, message: 'Google Play Billing solo está disponible en la app Android.' };
  }
  if (!initialized) initPlayBilling();
  const productId = getPlayProductId(plan, cycle);
  try {
    const result = await Subscriptions.purchaseProduct({ productIdentifier: productId });
    const code = result.responseCode as number;
    // Android: 0 = "Successfully opened native popover"; el resultado real llega por listener.
    if (code === 0) return { success: true };
    return { success: false, message: result.responseMessage || 'No se pudo abrir la tienda.' };
  } catch (e) {
    console.error('Play Billing purchase error', e);
    return { success: false, message: e instanceof Error ? e.message : 'Error al iniciar la compra.' };
  }
}

/**
 * Suscribe al evento de compra completada en Android. El listener se ejecuta cuando el usuario
 * termina el flujo de pago (éxito o cancelación). Úsalo para refrescar estado o llamar al backend.
 */
export function addPlayPurchaseListener(callback: () => void): () => void {
  if (!isPlayBillingAvailable()) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  Subscriptions.addListener('ANDROID-PURCHASE-RESPONSE', () => {
    callback();
  }).then((h) => { handle = h; });
  return () => { handle?.remove?.(); };
}

/**
 * Devuelve si el usuario tiene al menos una suscripción activa (cualquier plan).
 */
export async function hasActivePlaySubscription(): Promise<boolean> {
  if (!isPlayBillingAvailable()) return false;
  try {
    const res = await Subscriptions.getCurrentEntitlements();
    return res.responseCode === 0 && Array.isArray(res.data) && res.data.length > 0;
  } catch {
    return false;
  }
}

/** Transacción activa (para enviar purchaseToken al backend). */
export interface PlayTransaction {
  productIdentifier: string;
  purchaseToken?: string;
  expiryDate: string;
}

/**
 * Devuelve las transacciones activas (entitlements). Útil tras una compra para enviar
 * purchaseToken a la Cloud Function activatePlanFromPlay.
 */
export async function getActivePlayTransactions(): Promise<PlayTransaction[]> {
  if (!isPlayBillingAvailable()) return [];
  try {
    const res = await Subscriptions.getCurrentEntitlements();
    if (res.responseCode !== 0 || !Array.isArray(res.data)) return [];
    return res.data.map((t) => ({
      productIdentifier: t.productIdentifier,
      purchaseToken: t.purchaseToken,
      expiryDate: t.expiryDate,
    }));
  } catch {
    return [];
  }
}
