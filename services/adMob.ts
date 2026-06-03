/**
 * Servicio AdMob: ATT → consentimiento UMP (si aplica) → inicialización → banner.
 * Solo plataforma nativa (Android/iOS). No se ejecuta en web.
 *
 * Orden en iOS (requisito Apple + Google):
 * 1. App Tracking Transparency (popup ATT)
 * 2. User Messaging Platform / GDPR (si hay formulario disponible)
 * 3. AdMob.initialize() — inicia GADMobileAds
 * 4. showBannerAd()
 */

import { Capacitor } from '@capacitor/core';
import {
  ensureAppTrackingAuthorization,
  shouldUseNonPersonalizedAds,
} from './att';

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
 * Consentimiento de anuncios (UMP) para usuarios en la UE/EEE.
 * No sustituye ATT; se ejecuta después del popup ATT en iOS.
 */
async function ensureAdMobUserConsent(): Promise<void> {
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable) {
      console.log('[AdMob] Mostrando formulario de consentimiento UMP...');
      await AdMob.showConsentForm();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[AdMob] Consentimiento UMP omitido o no disponible:', message);
  }
}

/**
 * Inicializa el SDK de AdMob. Idempotente.
 * En iOS: ATT y UMP se completan antes de GADMobileAds.start().
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
      if (Capacitor.getPlatform() === 'ios') {
        await ensureAppTrackingAuthorization();
        await ensureAdMobUserConsent();
      }

      console.log('[AdMob] initializing SDK...');
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
 * Debe llamarse después de initAdMob() (que ya resolvió ATT en iOS).
 */
export async function showBannerAd(): Promise<AdMobBannerResult> {
  if (!ADMOB_AVAILABLE || Capacitor.getPlatform() === 'web') {
    console.log('[AdMob] show skipped (web/non-native)');
    return { ok: true };
  }

  try {
    const init = await initAdMob();
    if (!init.ok) {
      return { ok: false, error: init.error ?? 'AdMob no inicializado' };
    }

    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');

    await AdMob.removeBanner().catch(() => {});

    const npa = shouldUseNonPersonalizedAds();
    if (npa) {
      console.log('[AdMob] Anuncios no personalizados (usuario denegó ATT)');
    }

    await AdMob.showBanner({
      adId: BANNER_AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
      npa,
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

export const initializeAdMob = initAdMob;
export const showAdMobBanner = showBannerAd;
export const removeAdMobBanner = removeBannerAd;
