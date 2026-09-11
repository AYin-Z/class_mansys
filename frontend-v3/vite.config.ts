import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import pkg from './package.json'

/**
 * 构建号 = 版本 + 构建时间戳。
 * 用途：出错上报（/api/client-log）与 index.html 的 meta 都带上它，
 * 排查线上问题时能立刻知道用户手上跑的是哪一次构建。
 */
const BUILD_ID = pkg.version + '+' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

/** 把 index.html 里的 __BUILD_ID__ 占位符替换成真实构建号 */
function injectBuildId(): Plugin {
  return {
    name: 'inject-build-id',
    transformIndexHtml(html) {
      return html.replace(/__BUILD_ID__/g, BUILD_ID)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), injectBuildId()],
  // 版本号编译进包：CI 生成 APK 的 versionName 也是读同一个 package.json，
  // 所以 App 内「当前版本」与实际安装的版本一致（此前写死 v1.0.0）。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
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
    /**
     * 保留历史构建产物（2026-09-11 白屏根因修复）
     *
     * Vite 默认 emptyOutDir=true，每次构建都会**删掉上一次的 hash 文件**。
     * 而用户手机上可能还跑着旧版 index.html/入口包（浏览器缓存），
     * 它按需加载的页面 chunk 一旦被删就会 404：
     * 动态 import 失败 → 内容区空白，但已加载的底部导航还在
     * （现象：TabBar 可见、其他全白、个别页面偶尔能看见）。
     *
     * 因此这里保留旧文件，由 scripts/prune-dist.mjs 按时间清理
     * （默认保留 7 天，够覆盖用户缓存过期的窗口）。
     */
    emptyOutDir: false,
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
