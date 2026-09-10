import { Capacitor } from '@capacitor/core';
import { APP_VERSION, deleteMyAccount } from './firebase';
import { DataService } from './data';
import { DeactivationReason } from '../types';

export const DEACTIVATION_REASON_OPTIONS: Array<{ value: DeactivationReason; labelKey: string }> = [
  { value: 'no_longer_need_app', labelKey: 'deactivate.reasons.noLongerNeedApp' },
  { value: 'found_another_barbershop', labelKey: 'deactivate.reasons.foundAnotherBarbershop' },
  { value: 'technical_issues', labelKey: 'deactivate.reasons.technicalIssues' },
  { value: 'hard_to_use', labelKey: 'deactivate.reasons.hardToUse' },
  { value: 'too_many_notifications', labelKey: 'deactivate.reasons.tooManyNotifications' },
  { value: 'account_issues', labelKey: 'deactivate.reasons.accountIssues' },
  { value: 'privacy_security', labelKey: 'deactivate.reasons.privacySecurity' },
  { value: 'other', labelKey: 'deactivate.reasons.other' },
];

export interface DeactivateAccountPayload {
  password: string;
  reason: DeactivationReason;
  customReason?: string;
  improvementFeedback?: string;
}

const MAX_REASON_LENGTH = 2000;

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

export async function deactivateCurrentAccount(payload: DeactivateAccountPayload): Promise<void> {
  validatePayload(payload);
  const current = DataService.getCurrentUser();
  if (!current?.username) throw new Error('No hay sesión iniciada.');
  if (current.role === 'platform_owner' || current.role === 'superadmin') {
    throw new Error('Esta cuenta no puede eliminarse desde la app.');
  }

  await deleteMyAccount({
    password: payload.password,
    reason: payload.reason,
    customReason: payload.customReason,
    improvementFeedback: payload.improvementFeedback,
    platform: getPlatformLabel(),
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
