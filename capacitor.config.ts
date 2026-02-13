import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kbsoftwares.afrilink',
  appName: 'Afrilink',
  webDir: 'dist',
  server: {
    url: 'https://shop.afrilink.info',
    cleartext: true
  }
};

export default config;
