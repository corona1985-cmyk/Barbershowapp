import React, { useEffect, useRef } from 'react';
import { ADMOB_AVAILABLE, initAdMob, showBannerAd, removeBannerAd } from '../services/adMob';

interface AdMobBannerProps {
  /** true = mostrar banner (plan gratuito, cliente, o pantalla de inicio sin login). Barberos con plan de pago no reciben true. */
  showAds: boolean;
}

/**
 * Gestiona el banner de AdMob en la parte inferior cuando:
 * - La app corre en plataforma nativa (Android/iOS) y
 * - showAds es true (plan gratuito, rol cliente, o pantalla de bienvenida).
 * Barberos con planes de pago (solo, barberia, multisede) no ven anuncios.
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ showAds }) => {
  const bannerShown = useRef(false);

  useEffect(() => {
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
  }, [showAds]);

  return null;
};

export default AdMobBanner;
