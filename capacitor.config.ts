import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.barbershow.app',
  appName: 'BarberShow',
  webDir: 'dist',
  server: {
    // Para desarrollo: descomenta y pon tu IP para probar en dispositivo
    // url: 'http://192.168.1.x:3000',
    // cleartext: true
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
