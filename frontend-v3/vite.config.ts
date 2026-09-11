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
  build: {
    /**
     * 兼容性目标（2026-09 白屏事故修复）
     *
     * Vite 6 默认 target 是 baseline-widely-available（≈ Chrome 107+），
     * 产物里带 `??` / `?.` 等 ES2020 语法。用户手机上的浏览器/内置 WebView
     * 引擎若低于 Chrome 80 或 Safari 13.1，会在**解析阶段**直接 SyntaxError：
     * 整个入口包失效、页面纯白且没有任何提示。
     *
     * 校园场景里这类旧引擎很常见：安卓 OEM 浏览器、部分 WebView 内核、
     * 旧版 iOS。这里显式降级到 es2019（esbuild 会把 `??`/`?.`/`||=` 等
     * 语法糖编译成等价的 if/三元），牺牲一点体积换可用性。
     */
    target: ['es2019'],
    cssTarget: ['chrome61', 'safari11'],
    // 老引擎上 sourcemap 更方便定位问题（不影响运行）
    sourcemap: false
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
