/**
 * URL pública de la app: usada para los códigos QR (registro/agendar por barbería).
 * En web abierta desde el navegador se usa la URL actual; en app nativa (Android/iOS)
 * y cuando no hay VITE_APP_PUBLIC_URL se usa esta.
 */
export const DEFAULT_PUBLIC_APP_URL = 'https://barbershow.net';

/**
 * Modo promocional global: evita pantallas de suscripción vencida y bloqueos por plan.
 * Requerido para cumplir Guideline 3.1.1 en App Store mientras no se use IAP de Apple.
 * Cambiar a false cuando se integre In-App Purchase nativo.
 */
export const GLOBAL_FREE_MODE = true;
