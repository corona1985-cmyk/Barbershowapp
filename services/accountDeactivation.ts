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
 * Elimina permanentemente la cuenta del usuario (Guideline 5.1.1(v) App Store).
 */
export async function deactivateCurrentAccount(payload: DeactivateAccountPayload): Promise<void> {
  validatePayload(payload);

  const current = DataService.getCurrentUser();
  if (!current?.username) throw new Error('No hay sesión iniciada.');
  if (current.role === 'platform_owner' || current.role === 'superadmin') {
    throw new Error('Esta cuenta no puede eliminarse desde la app.');
  }

  const username = current.username.trim().toLowerCase();
  const snap = await withTimeout(
    get(ref(db, `${ROOT}/users/${username}`)),
    ACCOUNT_DELETE_TIMEOUT_MS,
    'loadUserForDeactivation'
  );
  if (!snap.exists()) throw new Error('Usuario no encontrado.');

  const freshUser = snap.val() as SystemUser;
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

  await withTimeout(ensureAnonymousAuth(), ACCOUNT_DELETE_TIMEOUT_MS, 'ensureAnonymousAuth');

  const reason = payload.reason;
  const customReason = normalizeOptionalText(payload.customReason);
  const improvementFeedback = normalizeOptionalText(payload.improvementFeedback);
  const platform = getPlatformLabel();

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
    ACCOUNT_DELETE_TIMEOUT_MS,
    'saveDeactivationFeedback'
  );

  await withTimeout(
    remove(ref(db, `${ROOT}/users/${username}`)),
    ACCOUNT_DELETE_TIMEOUT_MS,
    'removeUserAccount'
  );

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
