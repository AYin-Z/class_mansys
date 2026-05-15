import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// Strips uni-app conditional compile directives (#ifdef / #ifndef / #endif / #if / #elif / #else)
// from .vue and .ts files. These are preprocessor comments that vue/compiler-sfc doesn't understand.
function stripConditionalCompile() {
  const pattern = /^\s*(\/\/\s*)?[#＃]\s*(ifdef|ifndef|if|elif|else|endif)\b.*$/gm;
  return {
    name: 'strip-conditional-compile',
    transform(code, id) {
      if (!/\.(vue|ts)$/.test(id)) return null;
      const cleaned = code.replace(pattern, '');
      if (cleaned !== code) return cleaned;
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Redirect @dcloudio/uni-app to our lifecycle polyfill
      '@dcloudio/uni-app': path.resolve(__dirname, 'src/shims/uni-lifecycle.ts'),
    },
  },
  plugins: [
    stripConditionalCompile(),
    vue(),
    // Remove crossorigin from built HTML — mobile browsers can silently
    // reject same-origin module scripts with crossorigin attribute.
    {
      name: 'strip-crossorigin',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin/g, '')
      },
    },
    // Fix @dcloudio/uni-app importing Vue internals not in standard ESM builds
    {
      name: 'fix-vue-ssr-export',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'vue' && importer && (importer.includes('@dcloudio/uni-app') || importer.includes('@dcloudio/uni-h5'))) {
          return '\0vue-internal-fix';
        }
        return null;
      },
      load(id) {
        if (id === '\0vue-internal-fix') {
          return `
export * from 'vue/dist/vue.runtime.esm-bundler.js';
const isInSSRComponentSetup = false;
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
function logError(err, vm, type) { console.error(err, vm, type); }
function onBeforeActivate(hook, target) { return injectHook('ba', hook, target); }
function onBeforeDeactivate(hook, target) { return injectHook('bd', hook, target); }
export { isInSSRComponentSetup, injectHook, logError, onBeforeActivate, onBeforeDeactivate };
          `;
        }
        return null;
      }
    },
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
