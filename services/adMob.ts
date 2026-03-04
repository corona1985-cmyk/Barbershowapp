/**
 * Servicio AdMob: inicialización y banner solo en plataforma nativa (Android/iOS).
 * Uso exclusivo para plan gratuito; no se ejecuta en web.
 */

import { Capacitor } from '@capacitor/core';

export const ADMOB_AVAILABLE = Capacitor.isNativePlatform();

/** Reemplaza por tu Banner Ad Unit ID de AdMob (Android). En producción usa el ID real desde la consola AdMob. */
const BANNER_AD_UNIT_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
/** Reemplaza por tu Banner Ad Unit ID de AdMob (iOS) si publicas en App Store. */
const BANNER_AD_UNIT_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';

export interface AdMobInitResult {
  ok: boolean;
  error?: string;
}

export interface AdMobBannerResult {
  ok: boolean;
  error?: string;
}

let initialized = false;

/**
 * Inicializa el SDK de AdMob. Idempotente; solo efectúa la llamada nativa una vez.
 */
export async function initializeAdMob(): Promise<AdMobInitResult> {
  if (!ADMOB_AVAILABLE) return { ok: true };
  if (initialized) return { ok: true };

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.initialize();
    initialized = true;
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[AdMob] initialize failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Muestra el banner en la parte inferior. Solo en plataforma nativa.
 * Debe llamarse después de initializeAdMob().
 */
export async function showAdMobBanner(): Promise<AdMobBannerResult> {
  if (!ADMOB_AVAILABLE) return { ok: true };

  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    const adId = Capacitor.getPlatform() === 'android' ? BANNER_AD_UNIT_ID_ANDROID : BANNER_AD_UNIT_ID_IOS;
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[AdMob] showBanner failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Oculta el banner sin eliminarlo (puede reanudarse con resumeBanner).
 */
export async function hideAdMobBanner(): Promise<void> {
  if (!ADMOB_AVAILABLE) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.hideBanner();
  } catch {
    // Ignorar si ya no hay banner
  }
}

/**
 * Elimina el banner de la vista.
 */
export async function removeAdMobBanner(): Promise<void> {
  if (!ADMOB_AVAILABLE) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.removeBanner();
  } catch {
    // Ignorar si no hay banner
  }
}
