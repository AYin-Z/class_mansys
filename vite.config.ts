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
    // Convert uni-app template tags & events to HTML/Vue equivalents
    {
      name: 'uni-to-vue',
      enforce: 'pre',
      transform(code, id) {
        if (!/\.vue$/.test(id)) return null
        const templateMatch = code.match(/<template[\s\S]*?<\/template>/)
        if (!templateMatch) return null
        let tpl = templateMatch[0]
        let changed = false

        // 1. Replace @tap with @click (for clickable elements)
        if (tpl.includes('@tap')) {
          tpl = tpl.replace(/@tap(?!ple)/g, '@click')
          changed = true
        }

        // 2. Replace uni-app tags with standard HTML
        const tags: [RegExp, string][] = [
          [/\bview\b/g, 'div'],
          [/\btext\b/g, 'span'],
          [/\bnavigator\b/g, 'a'],
          [/\bimage\b/g, 'img'],
          [/\bscroll-view\b/g, 'div'],
          [/\bpicker\b/g, 'uni-picker'],
        ]
        // Only replace inside tag names (between < and space/>)
        for (const [pattern, replacement] of tags) {
          const newTpl = tpl.replace(new RegExp(`<(${pattern.source})(\\s|>)`, 'g'), `<${replacement}$2`)
            .replace(new RegExp(`<\\/(${pattern.source})>`, 'g'), `</${replacement}>`)
          if (newTpl !== tpl) { tpl = newTpl; changed = true }
        }

        // 3. Convert <navigator url="X"> to <a href="#X"> (vue-router hash mode)
        const navMatch = tpl.match(/<a\s+url="/g)
        if (navMatch) {
          tpl = tpl.replace(/<a\s+url="([^"]+)"/g, `<a href="#$1"`)
          changed = true
        }

        // 4. Convert $emit('tap', ...) to $emit('click', ...) so child/parent event names stay in sync
        //    after @tap→@click conversion on the listener side
        if (tpl.includes("$emit('tap'")) {
          tpl = tpl.replace(/\$emit\('tap'/g, "$emit('click'")
          changed = true
        }

        if (!changed) return null
        return code.replace(templateMatch[0], tpl)
      }
    },
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
