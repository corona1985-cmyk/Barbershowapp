import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

/** Envía un mensaje de WhatsApp desde la app (requiere Cloud Function + Twilio configurados). */
export async function sendWhatsAppFromApp(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
  const functions = getFunctions(app);
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
  const functions = getFunctions(app);
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
  const functions = getFunctions(app);
  const fn = httpsCallable<typeof params, { url: string }>(functions, 'createPlanCheckout');
  const result = await fn(params);
  return result.data;
}

/** Activa el plan en Firebase tras una compra en Google Play o Apple. Si se pasa username, activa ese signup pendiente. */
export async function activatePlanFromPlay(params: {
  purchaseToken: string;
  productId: string;
  email: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
  /** Usuario creado en signup pendiente (móvil); si se envía, se activa ese usuario y su POS. */
  username?: string;
}): Promise<{ success: boolean; message?: string }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<typeof params, { success: boolean; message?: string }>(functions, 'activatePlanFromPlay');
  const result = await fn(params);
  return result.data;
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
}

/** Completa el autoregistro con plan gratuito: crea usuario admin + POS en una sola llamada. */
export async function completeSelfSignupFree(params: CompleteSelfSignupFreeParams): Promise<{ success: true }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<CompleteSelfSignupFreeParams, { success: true }>(functions, 'completeSelfSignupFree');
  const result = await fn(params);
  return result.data;
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
  plan: 'solo' | 'barberia' | 'multisede';
  ciclo: 'mensual' | 'anual';
}

/** Crea usuario y POS en estado pendiente y devuelve URL de checkout (solo web/Stripe). En móvil no se usa. */
export async function createPendingBarberSignup(params: CreatePendingBarberSignupParams): Promise<{ url: string }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<CreatePendingBarberSignupParams, { url: string }>(functions, 'createPendingBarberSignup');
  const result = await fn(params);
  return result.data;
}

/** Crea usuario y POS en estado pendiente para pago en app (Apple Pay / Google Wallet). No redirige a Stripe. */
export async function createPendingBarberSignupMobile(params: CreatePendingBarberSignupParams): Promise<{ success: true }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<CreatePendingBarberSignupParams, { success: true }>(functions, 'createPendingBarberSignupMobile');
  const result = await fn(params);
  return result.data;
}
