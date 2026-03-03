import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.barbershow.app',
  appName: 'BarberShow',
  webDir: 'dist',
  server: {
    // Desarrollo en dispositivo: descomenta y usa tu IP (ej: 192.168.1.10)
    // url: 'http://192.168.1.10:3000',
    // cleartext: true
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
    },
  },
};

export default config;
