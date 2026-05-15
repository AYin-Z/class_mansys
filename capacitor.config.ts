import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clamansys.app',
  appName: '区队管理系统',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
