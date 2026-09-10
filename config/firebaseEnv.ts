/**
 * Configuración de Firebase por ambiente.
 * En `npm run dev` se usan emuladores salvo VITE_USE_FIREBASE_EMULATOR=false.
 * El build de producción no usa emuladores.
 */
/// <reference types="vite/client" />
export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const PRODUCTION_FALLBACK: FirebaseWebConfig = {
  apiKey: "AIzaSyDDHc3BVRBU8CE2SRPhIzqK0aLQ_gcgAhA",
  authDomain: "gen-lang-client-0624135070.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0624135070-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0624135070",
  storageBucket: "gen-lang-client-0624135070.firebasestorage.app",
  messagingSenderId: "826588844097",
  appId: "1:826588844097:web:4e5db3f03d7bb52ec7b6c0",
  measurementId: "G-1QKXNNZCWM",
};

export function useFirebaseEmulators(): boolean {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR !== "false";
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!projectId) return PRODUCTION_FALLBACK;
  return {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || PRODUCTION_FALLBACK.apiKey),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`),
    databaseURL: String(import.meta.env.VITE_FIREBASE_DATABASE_URL || PRODUCTION_FALLBACK.databaseURL),
    projectId,
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`),
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || PRODUCTION_FALLBACK.messagingSenderId),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || PRODUCTION_FALLBACK.appId),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
  };
}

export function getRecaptchaSiteKey(): string {
  return String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || "");
}

export const FUNCTIONS_REGION = "us-central1";
