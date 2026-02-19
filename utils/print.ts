import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

const ANDROID_PRINT_MESSAGE =
  'En Android la impresión desde la app no abre el diálogo de impresión. ' +
  'Puedes hacer una captura de pantalla (encendido + volumen bajo) para guardar o compartir esta pantalla.';

/**
 * Intenta imprimir: en web usa window.print(); en Android/iOS muestra un mensaje útil
 * y opcionalmente ofrece compartir como texto.
 */
export function handlePrint(options?: { name?: string; shareText?: string }): void {
  if (!isNative) {
    window.print();
    return;
  }
  const name = options?.name ?? 'Documento';
  const shareText = options?.shareText;
  if (shareText && typeof navigator !== 'undefined' && navigator.share) {
    navigator
      .share({
        title: name,
        text: shareText,
      })
      .catch(() => alert(ANDROID_PRINT_MESSAGE));
  } else {
    alert(ANDROID_PRINT_MESSAGE);
  }
}

/**
 * Para uso en QR: en nativo no hay ventana de impresión; mostramos mensaje.
 * El flujo de Settings ya hace window.print() después de montar el QR en #qr-print-area.
 */
export function handlePrintQR(): void {
  if (!isNative) {
    window.print();
    return;
  }
  alert(
    'En Android no se puede imprimir directamente. Haz una captura de pantalla de la pantalla del QR (encendido + volumen bajo) y compártela o imprímela desde la galería.'
  );
}
