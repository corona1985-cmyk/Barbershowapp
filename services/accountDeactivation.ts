import { Capacitor } from '@capacitor/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, get, remove } from 'firebase/database';
import { db, firestore, ensureAnonymousAuth, logAnalyticsEvent, APP_VERSION } from './firebase';
import { DataService, isAccountDeactivated } from './data';
import { verifyPassword } from './passwordHash';
import { AccountDeactivationFeedback, DeactivationReason, SystemUser } from '../types';

const ROOT = 'barbershow';
const MAX_REASON_LENGTH = 2000;
const ACCOUNT_DELETE_TIMEOUT_MS = 15000;
// Timeout corto para el feedback opcional: si Firestore se cuelga, no retrasamos el borrado.
const FEEDBACK_TIMEOUT_MS = 6000;
// URL REST de Realtime Database: en el WKWebView de iOS el SDK de Firebase se cuelga,
// así que en nativo leemos/borramos vía HTTP (igual que services/data.ts).
const RTDB_BASE_URL = 'https://gen-lang-client-0624135070-default-rtdb.firebaseio.com';

export const DEACTIVATION_REASON_OPTIONS: Array<{ value: DeactivationReason; label: string }> = [
  { value: 'no_longer_need_app', label: 'Ya no necesito la aplicación' },
  { value: 'found_another_barbershop', label: 'Encontré otra barbería' },
  { value: 'technical_issues', label: 'Problemas técnicos' },
  { value: 'hard_to_use', label: 'La aplicación es difícil de usar' },
  { value: 'too_many_notifications', label: 'Demasiadas notificaciones' },
  { value: 'account_issues', label: 'Problemas con mi cuenta' },
  { value: 'privacy_security', label: 'Privacidad o seguridad' },
  { value: 'other', label: 'Otro' },
];

export interface DeactivateAccountPayload {
  password: string;
  reason: DeactivationReason;
  customReason?: string;
  improvementFeedback?: string;
}

function normalizeOptionalText(value?: string): string | null {
  const next = String(value ?? '').trim();
  return next ? next : null;
}

function getPlatformLabel(): 'web' | 'ios' | 'android' | 'unknown' {
  if (!Capacitor.isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return platform;
  return 'unknown';
}

function validatePayload(payload: DeactivateAccountPayload): void {
  if (!payload.password?.trim()) throw new Error('Confirma tu contraseña.');
  if (!payload.reason) throw new Error('Selecciona un motivo.');
  if (payload.reason === 'other' && !String(payload.customReason ?? '').trim()) {
    throw new Error('Si seleccionas "Otro", debes escribir más detalles.');
  }
  if ((payload.customReason ?? '').length > MAX_REASON_LENGTH) {
    throw new Error('El motivo personalizado es demasiado largo.');
  }
  if ((payload.improvementFeedback ?? '').length > MAX_REASON_LENGTH) {
    throw new Error('El campo de mejora es demasiado largo.');
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Resuelve la clave real del usuario en RTDB ignorando mayúsculas/minúsculas.
 * En nativo usa el endpoint REST shallow (el SDK se cuelga en el WKWebView de iOS).
 */
async function resolveUserKey(username: string): Promise<string | null> {
  const searchLower = username.trim().toLowerCase();
  if (!searchLower) return null;
  // En web las cuentas se guardan en minúscula y el SDK funciona; usamos la clave directa.
  if (!Capacitor.isNativePlatform()) return searchLower;

  const res = await withTimeout(
    fetch(`${RTDB_BASE_URL}/${ROOT}/users.json?shallow=true`),
    ACCOUNT_DELETE_TIMEOUT_MS,
    'resolveUserKey'
  );
  if (!res.ok) throw new Error(`resolveUserKey HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown> | null;
  const keys = data ? Object.keys(data) : [];
  return keys.find((k) => k.toLowerCase() === searchLower) ?? null;
}

/** Lee el nodo del usuario (REST en nativo, SDK en web). */
async function loadUser(dbKey: string): Promise<SystemUser | null> {
  if (Capacitor.isNativePlatform()) {
    const res = await withTimeout(
      fetch(`${RTDB_BASE_URL}/${ROOT}/users/${encodeURIComponent(dbKey)}.json`),
      ACCOUNT_DELETE_TIMEOUT_MS,
      'loadUserForDeactivation'
    );
    if (!res.ok) throw new Error(`loadUserForDeactivation HTTP ${res.status}`);
    return (await res.json()) as SystemUser | null;
  }
  const snap = await withTimeout(
    get(ref(db, `${ROOT}/users/${dbKey}`)),
    ACCOUNT_DELETE_TIMEOUT_MS,
    'loadUserForDeactivation'
  );
  return snap.exists() ? (snap.val() as SystemUser) : null;
}

/** Elimina el nodo del usuario (REST DELETE en nativo, SDK en web). */
async function removeUser(dbKey: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const res = await withTimeout(
      fetch(`${RTDB_BASE_URL}/${ROOT}/users/${encodeURIComponent(dbKey)}.json`, { method: 'DELETE' }),
      ACCOUNT_DELETE_TIMEOUT_MS,
      'removeUserAccount'
    );
    if (!res.ok) throw new Error(`removeUserAccount HTTP ${res.status}`);
    return;
  }
  await withTimeout(
    remove(ref(db, `${ROOT}/users/${dbKey}`)),
    ACCOUNT_DELETE_TIMEOUT_MS,
    'removeUserAccount'
  );
}

/**
 * Elimina permanentemente la cuenta del usuario (Guideline 5.1.1(v) App Store).
 */
export async function deactivateCurrentAccount(payload: DeactivateAccountPayload): Promise<void> {
  validatePayload(payload);

  const current = DataService.getCurrentUser();
  if (!current?.username) throw new Error('No hay sesión iniciada.');
  if (current.role === 'platform_owner' || current.role === 'superadmin') {
    throw new Error('Esta cuenta no puede eliminarse desde la app.');
  }

  const dbKey = await resolveUserKey(current.username);
  if (!dbKey) throw new Error('Usuario no encontrado.');
  const username = dbKey.toLowerCase();

  const freshUser = await loadUser(dbKey);
  if (!freshUser) throw new Error('Usuario no encontrado.');
  if (isAccountDeactivated(freshUser)) {
    throw new Error('Tu cuenta ya fue eliminada.');
  }
  if (freshUser.role === 'platform_owner' || freshUser.role === 'superadmin') {
    throw new Error('Esta cuenta no puede eliminarse desde la app.');
  }
  if (!freshUser.password) {
    throw new Error('Este usuario no tiene contraseña configurada.');
  }

  const passwordIsValid = await verifyPassword(payload.password, freshUser.password);
  if (!passwordIsValid) {
    throw new Error('La contraseña es incorrecta.');
  }

  const reason = payload.reason;
  const customReason = normalizeOptionalText(payload.customReason);
  const improvementFeedback = normalizeOptionalText(payload.improvementFeedback);
  const platform = getPlatformLabel();

  // El feedback es opcional (analítica/soporte) y NUNCA debe impedir el borrado de la cuenta.
  // Requiere sesión anónima + Firestore, que en el WebView de iOS puede colgarse; por eso va
  // en best-effort con su propio timeout corto y los errores se ignoran.
  try {
    await withTimeout(ensureAnonymousAuth(), FEEDBACK_TIMEOUT_MS, 'ensureAnonymousAuth');

    const feedback: AccountDeactivationFeedback = {
      userId: username,
      username,
      reason,
      customReason: customReason ?? null,
      improvementFeedback: improvementFeedback ?? null,
      createdAt: serverTimestamp(),
      platform,
      appVersion: APP_VERSION,
    };

    await withTimeout(
      addDoc(collection(firestore, 'account_deactivation_feedback'), feedback),
      FEEDBACK_TIMEOUT_MS,
      'saveDeactivationFeedback'
    );
  } catch (err) {
    console.warn('[accountDeletion] No se pudo guardar el feedback (se continúa con el borrado):', err);
  }

  // Paso crítico: eliminar la cuenta del usuario en Realtime DB (no requiere auth).
  await removeUser(dbKey);

  await logAnalyticsEvent('account_deleted_permanently', {
    reason,
    timestamp: Date.now(),
    platform,
    appVersion: APP_VERSION,
  });

  DataService.setActivePosId(null);

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // ignore
  }

  window.location.href = '/';
}
