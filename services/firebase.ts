import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Capacitor } from '@capacitor/core';
const firebaseConfig = {
  apiKey: "AIzaSyDDHc3BVRBU8CE2SRPhIzqK0aLQ_gcgAhA",
  authDomain: "gen-lang-client-0624135070.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0624135070-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0624135070",
  storageBucket: "gen-lang-client-0624135070.firebasestorage.app",
  messagingSenderId: "826588844097",
  appId: "1:826588844097:web:4e5db3f03d7bb52ec7b6c0",
  measurementId: "G-1QKXNNZCWM"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
// En WebViews nativos (Capacitor/iOS) el transporte WebChannel de Firestore suele quedarse
// colgado; forzamos long-polling para evitar timeouts. En web usamos autodetección.
export const firestore = initializeFirestore(
  app,
  Capacitor.isNativePlatform()
    ? { experimentalForceLongPolling: true }
    : { experimentalAutoDetectLongPolling: true }
);

export const APP_VERSION = '1.0.10';

/** Región donde están desplegadas las Cloud Functions (debe coincidir con functions/src). */
const FUNCTIONS_REGION = 'us-central1';

/** Garantiza una sesión anónima para servicios que requieren auth, sin tocar el login principal. */
export async function ensureAnonymousAuth(): Promise<void> {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

/** Obtiene Analytics solo si está soportado en este runtime. */
export async function getAnalyticsIfSupported() {
  if (!(await isSupported())) return null;
  return getAnalytics(app);
}

/** Registra eventos de Analytics de forma segura y silenciosa. */
export async function logAnalyticsEvent(name: string, params: Record<string, unknown>): Promise<void> {
  try {
    const analytics = await getAnalyticsIfSupported();
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch {
    // Fallback silencioso: la app no debe depender de Analytics para completar el flujo.
  }
}

/** Envía un mensaje de WhatsApp desde la app (requiere Cloud Function + Twilio configurados). */
export async function sendWhatsAppFromApp(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const sendMessage = httpsCallable<{ to: string; body: string }, { success: boolean; sid?: string }>(functions, 'sendWhatsAppMessage');
  const result = await sendMessage({ to, body });
  return result.data;
}

/** Resultado de login Master (validado en servidor; la contraseña no se comprueba en el cliente). */
export interface MasterAuthResult {
  user: { username: string; role: 'platform_owner'; name: string; posId: number | null };
}

/** Valida usuario y contraseña Master en Cloud Function. Usar para login Master en lugar de comprobar en frontend. */
export async function authenticateMasterWithPassword(username: string, password: string): Promise<MasterAuthResult> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const fn = httpsCallable<{ username: string; password: string }, MasterAuthResult>(functions, 'authenticateMasterWithPassword');
  const result = await fn({ username: username.trim(), password });
  return result.data;
}

/** Proveedor de pago para el checkout del plan. La Cloud Function puede crear sesión en Stripe, Mercado Pago o PayPal. */
export type PlanCheckoutProvider = 'stripe' | 'mercadopago' | 'paypal';

/** Crea sesión de pago para un plan (Stripe, Mercado Pago o PayPal). La Cloud Function createPlanCheckout debe existir y devolver { url: string }. */
export async function createPlanCheckout(params: {
  plan: string;
  ciclo: 'mensual' | 'anual';
  email: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
  /** Opcional: elegir proveedor de pago. Si no se envía, el backend usa su default (ej. Stripe). */
  provider?: PlanCheckoutProvider;
}): Promise<{ url: string }> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const fn = httpsCallable<typeof params, { url: string }>(functions, 'createPlanCheckout');
  const result = await fn(params);
  return result.data;
}

/** Activa el plan en Firebase tras una compra in-app (App Store / Google Play). Sin Cloud Functions. */
export async function activatePlanFromPlay(params: {
  purchaseToken?: string;
  productId: string;
  email?: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
  expiryDate?: string;
  username?: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!params.username?.trim()) {
    return { success: false, message: 'Falta username.' };
  }
  const { DataService } = await import('./data');
  return DataService.activatePlanFromPlay({
    productId: params.productId,
    expiryDate: params.expiryDate,
    username: params.username,
  });
}

/** Payload para completar autoregistro gratuito (plan gratuito). */
export interface CompleteSelfSignupFreeParams {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  barbershopName: string;
  address: string;
  country: string;
  city: string;
  barrio: string;
  lat?: number;
  lng?: number;
}

/** Completa el autoregistro con plan gratuito: crea usuario y barbería en Realtime Database (sin Cloud Functions). */
export async function completeSelfSignupFree(params: CompleteSelfSignupFreeParams): Promise<{ success: true }> {
  const { DataService } = await import('./data');
  return DataService.completeSelfSignupFree(params);
}

/** Payload para crear signup pendiente y obtener URL de pago. */
export interface CreatePendingBarberSignupParams {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  barbershopName: string;
  address: string;
  country?: string;
  city?: string;
  barrio?: string;
  lat?: number;
  lng?: number;
  plan: 'solo' | 'barberia' | 'multisede';
  ciclo: 'mensual' | 'anual';
}

/** Crea usuario y POS en estado pendiente y devuelve URL de checkout (solo web/Stripe). En móvil no se usa. */
export async function createPendingBarberSignup(params: CreatePendingBarberSignupParams): Promise<{ url: string }> {
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const fn = httpsCallable<CreatePendingBarberSignupParams, { url: string }>(functions, 'createPendingBarberSignup');
  const result = await fn(params);
  return result.data;
}

/** Crea usuario y POS en estado pendiente para pago in-app (App Store / Google Play). Sin Cloud Functions. */
export async function createPendingBarberSignupMobile(params: CreatePendingBarberSignupParams): Promise<{ success: true }> {
  const { DataService } = await import('./data');
  return DataService.createPendingBarberSignupMobile(params);
}
