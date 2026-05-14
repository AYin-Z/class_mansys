import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import fs from "node:fs";
import path from "node:path";

const VUE_PATCH_MODULE = '\0vue-internal-fix';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    uni(),
    // Fix @dcloudio/uni-app importing Vue internal symbols (injectHook,
    // isInSSRComponentSetup) that aren't exported by any published Vue ESM build.
    // Provides a virtual module that re-exports Vue plus these missing symbols.
    {
      name: 'fix-vue-ssr-export',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'vue' && importer && (importer.includes('@dcloudio/uni-app') || importer.includes('@dcloudio/uni-h5'))) {
          return VUE_PATCH_MODULE;
        }
        return null;
      },
      load(id) {
        if (id === VUE_PATCH_MODULE) {
          return `
export * from 'vue/dist/vue.runtime.esm-bundler.js';
const isInSSRComponentSetup = false;
function logError(err, vm, type) {
  console.error(err, vm, type);
}
function injectHook(type, hook, target, prepend) {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      if (target.isUnmounted) return;
      const prev = currentRenderingInstance;
      setCurrentRenderingInstance(target);
      const res = hook(...args);
      setCurrentRenderingInstance(prev);
      return res;
    });
    if (prepend) hooks.unshift(wrappedHook);
    else hooks.push(wrappedHook);
    return wrappedHook;
  }
}
const currentRenderingInstance = null;
function setCurrentRenderingInstance(instance) {}
function onBeforeActivate(hook, target) { return injectHook('ba', hook, target); }
function onBeforeDeactivate(hook, target) { return injectHook('bd', hook, target); }
export { isInSSRComponentSetup, injectHook, logError, onBeforeActivate, onBeforeDeactivate };
          `;
        }
        return null;
      }
    },
    // Fix BigInt literals in cloudbase SDK protobuf that esbuild can't transpile with low target.
    {
      name: 'fix-bigint-literals',
      transform(code, id) {
        if (id.endsWith('.vue') || id.endsWith('.css') || id.endsWith('.scss')) return null;
        if (!/0x[0-9a-fA-F]+n\b|\d+n\b/.test(code)) return null;
        const hexRe = /(^|[^a-zA-Z0-9_$])(0x[0-9a-fA-F]+)n(?![a-zA-Z0-9_$])/g;
        const decRe = /(^|[^a-zA-Z0-9_$])(\d+)n(?![a-zA-Z0-9_$])/g;
        return code
          .replace(hexRe, (_, pre, num) => `${pre}BigInt("${num}")`)
          .replace(decRe, (_, pre, num) => `${pre}BigInt(${num})`);
      }
    },
    // App 平台专用：复制 manifest.json / pages.json 到产物目录
    {
      name: 'copy-uni-config-to-app-output',
      apply: 'build',
      closeBundle() {
        const platform = process.env.UNI_PLATFORM || '';
        console.log(`[copy-uni-config] UNI_PLATFORM=${platform} NODE_ENV=${process.env.NODE_ENV}`);
        if (!platform.startsWith('app')) return;
        const mode = process.env.NODE_ENV === 'production' ? 'build' : 'dev';
        const outDir = path.resolve(__dirname, `dist/${mode}/${platform}`);
        const src = path.resolve(__dirname, 'src');
        for (const f of ['manifest.json', 'pages.json']) {
          const from = path.join(src, f);
          const to = path.join(outDir, f);
          if (fs.existsSync(from) && fs.existsSync(path.dirname(to))) {
            fs.copyFileSync(from, to);
            console.log(`[copy-uni-config] ${f} -> ${to}`);
          }
        }
      }
    },
    // 移除 script/link 标签的 crossorigin 属性（防止某些浏览器对同域模块脚本的 CORS 检查失败）
    {
      name: 'remove-crossorigin',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(=["'][^"']*["'])?/g, '');
      }
    }
  ],
  build: {
    target: 'esnext',
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/__auth': {
        target: 'https://envId-appid.tcloudbaseapp.com/',
        changeOrigin: true,
      }
    },
    allowedHosts: true
  }
});
