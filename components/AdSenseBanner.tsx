import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const AD_CLIENT = 'ca-pub-6169287781659857';
/** Reemplaza por el ID de tu unidad de anuncio (Ad unit) desde la consola de AdSense. */
const AD_SLOT = '0000000000';

interface AdSenseBannerProps {
  show: boolean;
}

/**
 * Renderiza un bloque de anuncio de Google AdSense solo en web.
 * No se muestra en app nativa (Android/iOS); ahí se usa AdMob.
 */
const AdSenseBanner: React.FC<AdSenseBannerProps> = ({ show }) => {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const isWeb = Capacitor.getPlatform() === 'web';

  useEffect(() => {
    if (!show || !isWeb) return;
    const el = insRef.current;
    if (!el || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense push is fire-and-forget
    }
  }, [show, isWeb]);

  if (!show || !isWeb) return null;

  return (
    <div className="w-full flex justify-center bg-slate-100/80 py-2 min-h-[90px] no-print">
      <ins
        ref={insRef}
        className="adsbygoogle"
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default AdSenseBanner;
