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
