/**
 * Suscripciones in-app: Google Play Billing (Android) y App Store / StoreKit 2 (iOS).
 * Solo tiene efecto en apps nativas Capacitor. En web no se usa.
 *
 * Configuración: PLAY_BILLING.md (Android), APPLE_BILLING.md (iOS).
 */

import { Capacitor } from '@capacitor/core';
import { Subscriptions } from '@squareetlabs/capacitor-subscriptions';
import type { AccountTier, PosPlan } from '../types';
import { isTierAvailableForIAP, tierToDefaultPlan } from '../config/app';

const APP_ID = 'com.barbershow.app';

/** URL del endpoint que verifica el purchase token con Google Play API. Crear en functions (ver PLAY_BILLING.md). */
const GOOGLE_VERIFY_ENDPOINT = 'https://us-central1-gen-lang-client-0624135070.cloudfunctions.net/verifyGooglePlayReceipt';

/** Product IDs en Play Console / App Store Connect (deben coincidir con las suscripciones creadas). */
const PRODUCT_IDS: Record<AccountTier, { monthly: string; yearly: string }> = {
  solo:      { monthly: 'plan_solo_monthly',      yearly: 'plan_solo_yearly' },
  barberia:  { monthly: 'plan_barberia_monthly', yearly: 'plan_barberia_yearly' },
  multisede: { monthly: 'plan_multisede_monthly', yearly: 'plan_multisede_yearly' },
};

let initialized = false;

function getPlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

/**
 * Indica si la app corre en Android y el plugin de suscripciones está disponible (Capacitor).
 */
export function isPlayBillingAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

/**
 * Indica si el pago in-app está disponible (Android Google Play o iOS App Store).
 * En web siempre false; solo dispositivos móviles nativos.
 */
export function isNativePaymentAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Indica si un plan puede comprarse in-app en la plataforma actual.
 */
export function isPlanAvailableForPurchase(plan: AccountTier): boolean {
  return isTierAvailableForIAP(plan, getPlatform());
}

/**
 * Obtiene el product ID para un plan y ciclo.
 */
export function getPlayProductId(plan: AccountTier, cycle: 'mensual' | 'anual'): string {
  const ids = PRODUCT_IDS[plan];
  return cycle === 'anual' ? ids.yearly : ids.monthly;
}

/**
 * Inicializa billing nativo. Android: verificación Google. iOS: StoreKit 2 (sin endpoint extra).
 */
export function initPlayBilling(verificationUrl?: string): void {
  if (!isNativePaymentAvailable()) return;
  if (Capacitor.getPlatform() === 'android') {
    try {
      Subscriptions.setGoogleVerificationDetails({
        googleVerifyEndpoint: verificationUrl || GOOGLE_VERIFY_ENDPOINT,
        bid: APP_ID,
      });
      initialized = true;
    } catch {
      // Plugin no disponible o error; ignorar
    }
  } else {
    initialized = true;
  }
}

/**
 * Abre el flujo nativo de compra: Google Play (Android) o App Store (iOS).
 * El resultado llega de forma asíncrona; usa addPlayPurchaseListener para reaccionar.
 */
export async function purchasePlan(plan: AccountTier, cycle: 'mensual' | 'anual'): Promise<{ success: boolean; message?: string }> {
  if (!isNativePaymentAvailable()) {
    return { success: false, message: 'El pago in-app solo está disponible en la app móvil (App Store o Google Play).' };
  }
  if (!isPlanAvailableForPurchase(plan)) {
    return { success: false, message: 'Este plan no está disponible para compra in-app en tu dispositivo.' };
  }
  if (Capacitor.getPlatform() === 'android' && !initialized) initPlayBilling();
  const productId = getPlayProductId(plan, cycle);
  try {
    const result = await Subscriptions.purchaseProduct({ productIdentifier: productId });
    const code = result.responseCode as number;
    if (code === 0) return { success: true };
    return { success: false, message: result.responseMessage || 'No se pudo abrir la tienda.' };
  } catch (e) {
    console.error('In-app purchase error', e);
    return { success: false, message: e instanceof Error ? e.message : 'Error al iniciar la compra.' };
  }
}

/**
 * Abre la pantalla nativa de gestión de suscripciones (App Store / Google Play).
 */
export async function manageSubscriptions(): Promise<void> {
  if (!isNativePaymentAvailable()) return;
  try {
    await Subscriptions.manageSubscriptions();
  } catch (e) {
    console.warn('manageSubscriptions error', e);
  }
}

/**
 * Suscribe al evento de compra completada (Android o iOS).
 */
export function addPlayPurchaseListener(callback: () => void): () => void {
  if (!isNativePaymentAvailable()) return () => {};
  const handles: { remove: () => Promise<void> }[] = [];
  Subscriptions.addListener('ANDROID-PURCHASE-RESPONSE', () => { callback(); }).then((h) => { if (h) handles.push(h); });
  Subscriptions.addListener('IOS-PURCHASE-RESPONSE', () => { callback(); }).then((h) => { if (h) handles.push(h); });
  return () => { handles.forEach((h) => h.remove?.()); };
}

/**
 * Devuelve si el usuario tiene al menos una suscripción activa (cualquier plan).
 */
export async function hasActivePlaySubscription(): Promise<boolean> {
  if (!isNativePaymentAvailable()) return false;
  try {
    const res = await Subscriptions.getCurrentEntitlements();
    return res.responseCode === 0 && Array.isArray(res.data) && res.data.length > 0;
  } catch {
    return false;
  }
}

/** Transacción activa (para enviar al backend). */
export interface PlayTransaction {
  productIdentifier: string;
  purchaseToken?: string;
  expiryDate: string;
}

/**
 * Devuelve las transacciones activas (entitlements).
 */
export async function getActivePlayTransactions(): Promise<PlayTransaction[]> {
  if (!isNativePaymentAvailable()) return [];
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

/**
 * Busca la transacción activa para un plan y ciclo concretos.
 */
export async function getTransactionForPlan(
  plan: AccountTier,
  cycle: 'mensual' | 'anual'
): Promise<PlayTransaction | null> {
  const productId = getPlayProductId(plan, cycle);
  const transactions = await getActivePlayTransactions();
  return transactions.find((t) => t.productIdentifier === productId) ?? transactions[0] ?? null;
}

/** Indica si la transacción tiene datos suficientes para activar en backend. */
export function isTransactionActivatable(tx: PlayTransaction | null | undefined): boolean {
  if (!tx?.productIdentifier) return false;
  return !!(tx.purchaseToken || tx.expiryDate);
}

const PRODUCT_ID_TO_TIER: Record<string, AccountTier> = {
  plan_barberia_monthly: 'barberia',
  plan_barberia_yearly: 'barberia',
  plan_solo_monthly: 'solo',
  plan_solo_yearly: 'solo',
  plan_multisede_monthly: 'multisede',
  plan_multisede_yearly: 'multisede',
};

/** Mapea product ID de la tienda al tier de negocio. */
export function getTierFromProductId(productId: string): { tier: AccountTier; plan: PosPlan } | null {
  const id = productId.trim();
  if (PRODUCT_ID_TO_TIER[id]) {
    const tier = PRODUCT_ID_TO_TIER[id];
    return { tier, plan: tierToDefaultPlan(tier) };
  }
  if (id.includes('barberia')) return { tier: 'barberia', plan: 'pro' };
  if (id.includes('solo')) return { tier: 'solo', plan: 'basic' };
  if (id.includes('multisede')) return { tier: 'multisede', plan: 'pro' };
  return null;
}

/** Calcula vencimiento local si la tienda no devolvió expiryDate (fallback Android). */
export function computeFallbackExpiry(productId: string): string {
  const isYearly = productId.includes('yearly') || productId.includes('anual');
  const now = new Date();
  return isYearly
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
}
