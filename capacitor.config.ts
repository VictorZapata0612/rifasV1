import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rifasctph.app',
  appName: 'Gestion Rifas',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
