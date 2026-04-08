/**
 * Servicio AdMob: inicialización y banner solo en plataforma nativa (Android/iOS).
 * Uso exclusivo para plan gratuito; no se ejecuta en web.
 */

import { Capacitor } from '@capacitor/core';

export const ADMOB_AVAILABLE = Capacitor.isNativePlatform();
const BANNER_AD_UNIT_ID = 'ca-app-pub-6169287781659857/2859576248';

export interface AdMobInitResult {
  ok: boolean;
  error?: string;
}

export interface AdMobBannerResult {
  ok: boolean;
  error?: string;
}

let initialized = false;
let initPromise: Promise<AdMobInitResult> | null = null;

/**
 * Inicializa el SDK de AdMob. Idempotente; solo efectúa la llamada nativa una vez.
 */
export async function initAdMob(): Promise<AdMobInitResult> {
  if (!ADMOB_AVAILABLE || Capacitor.getPlatform() === 'web') {
    console.log('[AdMob] init skipped (web/non-native)');
    return { ok: true };
  }
  if (initialized) {
    console.log('[AdMob] already initialized');
    return { ok: true };
  }
  if (initPromise) {
    console.log('[AdMob] waiting existing init');
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('[AdMob] initializing...');
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.initialize({
        initializeForTesting: false,
        testingDevices: [],
      });
      initialized = true;
      console.log('[AdMob] initialized successfully');
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[AdMob] init failed:', message);
      return { ok: false, error: message };
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Muestra el banner en la parte inferior. Solo en plataforma nativa.
 * Debe llamarse después de initAdMob().
 */
export async function showBannerAd(): Promise<AdMobBannerResult> {
  if (!ADMOB_AVAILABLE || Capacitor.getPlatform() === 'web') {
    console.log('[AdMob] show skipped (web/non-native)');
    return { ok: true };
  }

  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');

    // Evita banners duplicados/superpuestos al re-renderizar.
    await AdMob.removeBanner().catch(() => {});

    await AdMob.showBanner({
      adId: BANNER_AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    });
    console.log('[AdMob] banner shown:', BANNER_AD_UNIT_ID);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[AdMob] show banner failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Oculta el banner sin eliminarlo (puede reanudarse con resumeBanner).
 */
export async function hideAdMobBanner(): Promise<void> {
  if (!ADMOB_AVAILABLE || Capacitor.getPlatform() === 'web') return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.hideBanner();
    console.log('[AdMob] banner hidden');
  } catch {
    console.log('[AdMob] hide ignored (no banner)');
  }
}

/**
 * Elimina el banner de la vista.
 */
export async function removeBannerAd(): Promise<void> {
  if (!ADMOB_AVAILABLE || Capacitor.getPlatform() === 'web') return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.removeBanner();
    console.log('[AdMob] banner removed');
  } catch {
    console.log('[AdMob] remove ignored (no banner)');
  }
}

// Compatibilidad con nombres previos usados en la app.
export const initializeAdMob = initAdMob;
export const showAdMobBanner = showBannerAd;
export const removeAdMobBanner = removeBannerAd;
