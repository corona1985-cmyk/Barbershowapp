import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { DEFAULT_PUBLIC_APP_URL } from '../config/app';

/** Equivalente a Platform.OS === 'ios' en apps Capacitor. */
export function isIOSPlatform(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export function isAndroidPlatform(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** URL pública de la app web (registro de barberías, QR, etc.). */
export function getPublicAppUrl(): string {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_PUBLIC_URL;
  if (envUrl) return String(envUrl).replace(/\/+$/, '');
  return DEFAULT_PUBLIC_APP_URL;
}

/** Abre una URL en Safari / Chrome del sistema en nativo, o nueva pestaña en web. */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Abre el sitio web para registrar una nueva barbería (solo uso fuera de iOS in-app). */
export async function openWebsiteSignup(): Promise<void> {
  await openExternalUrl(getPublicAppUrl());
}
