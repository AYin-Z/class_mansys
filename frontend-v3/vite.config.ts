import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json'

export default defineConfig({
  base: './',
  plugins: [vue()],
  // 版本号编译进包：CI 生成 APK 的 versionName 也是读同一个 package.json，
  // 所以 App 内「当前版本」与实际安装的版本一致（此前写死 v1.0.0）。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    allowedHosts: ['.ayinserver.xin'],
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
