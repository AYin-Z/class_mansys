import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    // Fix BigInt literals in cloudbase SDK protobuf that esbuild can't transpile with low target
    {
      name: 'fix-bigint-literals',
      transform(code, id) {
        // Only process files that contain BigInt literals
        if (code.includes('0xffffffffn') || code.match(/\d+n[^a-zA-Z0-9_]/)) {
          // Replace BigInt literals like 0xffffffffn with BigInt("0xffffffff")
          return code.replace(/(0x[0-9a-fA-F]+)n(?=[^a-zA-Z0-9_])/g, 'BigInt("$1")')
                     .replace(/(\d+)n(?=[^a-zA-Z0-9_])/g, 'BigInt($1)');
        }
        return null;
      }
    }
  ],
  base: './',
  build: {
    target: 'esnext',
  },
  // optimizeDeps: {
  //   exclude: ['@cloudbase/adapter-uni-app'],  // 排除 @cloudbase/adapter-uni-app 依赖
  // },
  server: {
    host: '0.0.0.0',  // 使用IP地址代替localhost
    proxy: {
      '/__auth': {
        target: 'https://envId-appid.tcloudbaseapp.com/',
        changeOrigin: true,
      }
    },
    allowedHosts: true
  }
});
