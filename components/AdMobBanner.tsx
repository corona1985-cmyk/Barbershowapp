import React, { useEffect, useRef } from 'react';
import { ADMOB_AVAILABLE, initializeAdMob, showAdMobBanner, removeAdMobBanner } from '../services/adMob';
import type { AccountTier } from '../types';

interface AdMobBannerProps {
  accountTier: AccountTier;
}

/**
 * Gestiona el banner de AdMob en la parte inferior solo cuando:
 * - La app corre en plataforma nativa (Android/iOS) y
 * - El usuario está en plan gratuito.
 */
const AdMobBanner: React.FC<AdMobBannerProps> = ({ accountTier }) => {
  const bannerShown = useRef(false);

  useEffect(() => {
    const shouldShow = ADMOB_AVAILABLE && accountTier === 'gratuito';

    if (!shouldShow) {
      if (bannerShown.current) {
        removeAdMobBanner();
        bannerShown.current = false;
      }
      return;
    }

    let cancelled = false;

    (async () => {
      const init = await initializeAdMob();
      if (cancelled || !init.ok) return;

      const result = await showAdMobBanner();
      if (!cancelled && result.ok) bannerShown.current = true;
    })();

    return () => {
      cancelled = true;
      if (bannerShown.current) {
        removeAdMobBanner();
        bannerShown.current = false;
      }
    };
  }, [accountTier]);

  return null;
};

export default AdMobBanner;
