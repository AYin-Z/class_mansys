import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import fs from "node:fs";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
    // Fix BigInt literals in cloudbase SDK protobuf that esbuild can't transpile with low target.
    // 历史 bug：旧版正则 `(\d+)n(?=[^a-zA-Z0-9_])` 会误伤 `i18n` / `uni-i18n` 等标识符
    // （把 `18n(` 转成 `BigInt(18)(`）。这里补充"前向约束"：前一个字符必须是
    // 非标识符字符（或行首），且跳过 node_modules 里我们不关心的 vue 文件。
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
    // App 平台专用：uni-app CLI + Vite 模式下，构建产物 (dist/*/app) 不会自带
    // manifest.json / pages.json，导致 HBuilderX 无法识别为 uni-app 项目、
    // 无法推送到手机基座。这里在 writeBundle 阶段自动拷贝一份过去。
    {
      name: 'copy-uni-config-to-app-output',
      apply: 'build',
      closeBundle() {
        const platform = process.env.UNI_PLATFORM || '';
        console.log(`[copy-uni-config] UNI_PLATFORM=${platform} NODE_ENV=${process.env.NODE_ENV}`);
        if (!platform.startsWith('app')) return;
        const mode = process.env.NODE_ENV === 'production' ? 'build' : 'dev';
        const outDir = path.resolve(__dirname, `dist/${mode}/app`);
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
