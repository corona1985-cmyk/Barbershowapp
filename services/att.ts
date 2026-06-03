/**
 * App Tracking Transparency (ATT) — iOS 14+
 *
 * Apple exige mostrar el diálogo ATT (ATTrackingManager.requestTrackingAuthorization)
 * antes de inicializar SDKs de anuncios que usen el IDFA.
 *
 * Este servicio usa los métodos nativos del plugin @capacitor-community/admob,
 * que ya enlaza AppTrackingTransparency en el proyecto iOS.
 *
 * Requisito en Info.plist: NSUserTrackingUsageDescription (ver ios/App/App/Info.plist).
 */

import { Capacitor } from '@capacitor/core';

export type TrackingAuthStatus = 'authorized' | 'denied' | 'notDetermined' | 'restricted';

/** Estado final tras la primera solicitud en la sesión (solo iOS). */
let resolvedStatus: TrackingAuthStatus | null = null;
let attFlowPromise: Promise<TrackingAuthStatus> | null = null;

/**
 * Devuelve true si el usuario denegó o no puede autorizar el seguimiento.
 * Útil para solicitar anuncios no personalizados (npa) en AdMob.
 */
export function shouldUseNonPersonalizedAds(): boolean {
  if (Capacitor.getPlatform() !== 'ios') return false;
  if (resolvedStatus === null) return false;
  return resolvedStatus === 'denied' || resolvedStatus === 'restricted';
}

/** Último estado conocido de ATT (null si aún no se ha consultado en iOS). */
export function getTrackingAuthorizationStatus(): TrackingAuthStatus | null {
  return resolvedStatus;
}

/**
 * Consulta el estado ATT y, si es .notDetermined, muestra el popup de Apple.
 * Idempotente: una sola solicitud por sesión de la app.
 *
 * Debe ejecutarse ANTES de AdMob.initialize() en iOS.
 */
export async function ensureAppTrackingAuthorization(): Promise<TrackingAuthStatus> {
  if (Capacitor.getPlatform() !== 'ios') {
    return 'authorized';
  }

  if (resolvedStatus !== null) {
    return resolvedStatus;
  }

  if (attFlowPromise) {
    return attFlowPromise;
  }

  attFlowPromise = (async () => {
    try {
      const { AdMob } = await import('@capacitor-community/admob');

      const current = await AdMob.trackingAuthorizationStatus();
      let status = current.status as TrackingAuthStatus;

      if (status === 'notDetermined') {
        // Popup ATT de Apple — obligatorio para pasar App Store Review
        console.log('[ATT] Solicitando autorización de seguimiento (iOS)...');
        await AdMob.requestTrackingAuthorization();
        const after = await AdMob.trackingAuthorizationStatus();
        status = after.status as TrackingAuthStatus;
        console.log('[ATT] Respuesta del usuario:', status);
      } else {
        console.log('[ATT] Estado ya definido:', status);
      }

      resolvedStatus = status;
      return status;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[ATT] Error al solicitar autorización:', message);
      resolvedStatus = 'denied';
      return 'denied';
    }
  })();

  try {
    return await attFlowPromise;
  } finally {
    attFlowPromise = null;
  }
}
