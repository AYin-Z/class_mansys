import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clamansys.app',
  appName: '区队管理系统',
  webDir: 'dist',
  // 生产 APK 不设 server.url → 加载本地静态资源
  // 开发调试时可取消注释启用热更新
  // server: {
  //   url: 'https://cls.ayinserver.xin',
  //   cleartext: false,
  // },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#F5F5F5",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FFFFFF",
      overlaysWebView: false,
    },
    Filesystem: {},
  },
};

export default config;
