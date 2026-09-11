import { getToken } from './request'

/**
 * /uploads 下的受保护资源需要携带访问令牌。
 * <img src>/<a href> 无法带请求头，因此以 ?token= 传递；非 /uploads 路径原样返回。
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  if (!path.startsWith('/uploads')) return path
  const token = getToken()
  if (!token) return path
  return path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)
}

/**
 * 派生图地址（与服务端 mediaService 的命名约定一致）
 *
 * 服务端对每张上传的图片生成：
 *   xxx.jpg  →  xxx_thumb.jpg（480px，列表/网格用）
 *               xxx_medium.jpg（1440px，查看器用）
 *
 * 这里按同一约定推导地址，好处是**存量附件（只存了 URL 字符串的老数据）
 * 也能直接用缩略图**，不需要回填数据库字段。
 * 若派生图不存在（例如改造前上传、且未跑回填脚本），
 * 页面应通过 img @error 回退到原图 —— 见 useThumbFallback。
 */
export function thumbUrl(path?: string | null): string {
  if (!path) return ''
  if (!path.startsWith('/uploads')) return path
  if (/_thumb\./.test(path)) return path
  return path.replace(/(\.[a-zA-Z0-9]+)$/, '_thumb$1')
}

export function mediumUrl(path?: string | null): string {
  if (!path) return ''
  if (!path.startsWith('/uploads')) return path
  if (/_medium\./.test(path)) return path
  return path.replace(/(\.[a-zA-Z0-9]+)$/, '_medium$1')
}

/**
 * 图片加载失败时的回退处理（放在 <img @error> 上）
 *
 * 用法：<img :src="mediaUrl(thumbUrl(p.url))" @error="onThumbError($event, p.url)" />
 * 画面自动切回原图，用户不会看到裂图。
 */
export function onThumbError(event: Event, originalPath?: string | null): void {
  const el = event.target as HTMLImageElement | null
  if (!el || !originalPath) return
  // 用标记位判断而不是比较 el.src：el.src 会被浏览器规范化成绝对地址
  // （http://host/uploads/a_thumb.jpg?token=…），与相对形式的 fallback 永远不相等，
  // 于是"都 404"时会反复把同一个 src 赋回去、浏览器反复重试。
  if (el.dataset.thumbFallback === '1') return
  el.dataset.thumbFallback = '1'
  el.src = mediaUrl(originalPath)
}

/** 打开受保护资源（新窗口/下载）时也补上令牌 */
export function openMedia(path?: string | null): void {
  const url = mediaUrl(path)
  if (url) window.open(url, '_blank')
}
