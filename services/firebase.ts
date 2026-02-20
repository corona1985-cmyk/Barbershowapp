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

/** Crea sesión de pago para un plan (Stripe/MP). La Cloud Function createPlanCheckout debe existir y devolver { url: string }. */
export async function createPlanCheckout(params: {
  plan: string;
  ciclo: 'mensual' | 'anual';
  email: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
}): Promise<{ url: string }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<typeof params, { url: string }>(functions, 'createPlanCheckout');
  const result = await fn(params);
  return result.data;
}

/** Activa el plan en Firebase tras una compra en Google Play. La Cloud Function debe verificar el token con Google y crear la sede. */
export async function activatePlanFromPlay(params: {
  purchaseToken: string;
  productId: string;
  email: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
}): Promise<{ success: boolean; message?: string }> {
  const functions = getFunctions(app);
  const fn = httpsCallable<typeof params, { success: boolean; message?: string }>(functions, 'activatePlanFromPlay');
  const result = await fn(params);
  return result.data;
}
