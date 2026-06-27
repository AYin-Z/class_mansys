/**
 * 默认头像工具
 *
 * 历史背景：早期代码依赖 `/static/images/avatar.png`，但该文件大小为 0 字节，
 * 导致 H5 / App 端渲染出一个破损图标。此处改为即时生成 SVG DataURI，
 * 不再依赖静态图片资源。
 *
 * - 无参数调用：返回一枚通用的灰底人像占位图
 * - 传入 seed（如 displayName / 学号）：生成带首字母的彩色头像
 */

const PALETTE = [
  '#5B8DEF', '#667EEA', '#F6A623', '#E06C75', '#2BB673',
  '#8E54E9', '#00B8D9', '#FF7A59', '#36B37E', '#6554C0'
]

function hashToIndex(str: string, mod: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h) % mod
}

function pickLetter(seed: string): string {
  const trimmed = (seed || '').trim()
  if (!trimmed) return '?'
  const ch = trimmed.charAt(0)
  return /[a-zA-Z]/.test(ch) ? ch.toUpperCase() : ch
}

function encodeSvg(svg: string): string {
  // uni-app H5/App 都支持 utf8 data uri，不走 base64 以减小体积
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * 获取默认头像 DataURI
 * @param seed 种子字符串，用于决定颜色和首字母；不传则返回通用占位图
 */
export function getDefaultAvatar(seed?: string): string {
  if (!seed) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect width="160" height="160" rx="80" fill="#E4E9F2"/>' +
      '<circle cx="80" cy="64" r="28" fill="#B6C2D9"/>' +
      '<path d="M32 148c0-26 22-44 48-44s48 18 48 44" fill="#B6C2D9"/>' +
      '</svg>'
    return encodeSvg(svg)
  }

  const color = PALETTE[hashToIndex(seed, PALETTE.length)]
  const letter = pickLetter(seed)
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
    `<rect width="160" height="160" rx="80" fill="${color}"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,sans-serif" ` +
    `font-size="76" font-weight="600" fill="#ffffff">${letter}</text>` +
    '</svg>'
  return encodeSvg(svg)
}

/** 预生成的通用占位图，可用于模板直接引用 */
export const DEFAULT_AVATAR = getDefaultAvatar()
