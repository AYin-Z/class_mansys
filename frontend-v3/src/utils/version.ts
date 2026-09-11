/**
 * 应用版本号工具
 *
 * 版本来自构建时注入的 __APP_VERSION__（见 vite.config.ts 的 define，源头是
 * frontend-v3/package.json）。CI 生成 APK 的 versionName 也读同一个 package.json，
 * 所以「设置 → 当前版本」始终等于实际安装的版本（此前是写死的 v1.0.0）。
 */

/** 当前应用版本号（如 1.3.0） */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'

function parse(v: string): number[] {
  const parts = String(v || '')
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10))
  return [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0))
}

/** 语义化版本比较：a > b → 1，a === b → 0，a < b → -1 */
export function compareVersion(a: string, b: string): number {
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  }
  return 0
}

/** 服务端最新版本是否高于当前版本 */
export function hasUpdate(latest: string, current: string = APP_VERSION): boolean {
  return compareVersion(latest, current) > 0
}
