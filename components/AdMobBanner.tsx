import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADMOB_AVAILABLE, initAdMob, showBannerAd, removeBannerAd } from '../services/adMob';

interface AdMobBannerProps {
  /** true = mostrar banner (plan gratuito, cliente, o pantalla de inicio sin login). Barberos con plan de pago no reciben true. */
  showAds: boolean;
}

/**
 * Gestiona el banner de AdMob en web/PWA.
 * En compilación nativa (iOS/Android) no se cargan anuncios ni ATT (Guideline 2.1).
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ showAds }) => {
  const bannerShown = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) return;

    const shouldShow = ADMOB_AVAILABLE && showAds;

    if (!shouldShow) {
      if (bannerShown.current) {
        removeBannerAd();
        bannerShown.current = false;
      }
      return;
    }

    let cancelled = false;

    (async () => {
      const init = await initAdMob();
      if (cancelled || !init.ok) return;

      const result = await showBannerAd();
      if (!cancelled && result.ok) bannerShown.current = true;
    })();

    return () => {
      cancelled = true;
      if (bannerShown.current) {
        removeBannerAd();
        bannerShown.current = false;
      }
    };
  }, [showAds, isNative]);

  if (isNative) return null;

  return null;
};

export default AdMobBanner;
