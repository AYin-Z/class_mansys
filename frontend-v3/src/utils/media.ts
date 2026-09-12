import { getToken } from './request'
import { ensureSigned, needsSignRefresh, readMediaSignVersion, signedMediaQuery } from './mediaSign'

/** 拼接查询参数（原样保留路径里已有的 query） */
function withQuery(path: string, query: string): string {
  return path + (path.includes('?') ? '&' : '?') + query
}

/**
 * 受保护资源的访问地址（/uploads/**）
 *
 * 优先级（P2-1）：
 *   1) 命中短期媒体签名缓存 → `?mt=<exp.sig>`（15 分钟、按路径限定，泄露了也只对这一张有效）
 *   2) 未命中/已过期 → 先用旧的 `?token=<会话 JWT>` 兜底，**保证首屏不裂图**，
 *      同时后台批量预取签名；签名到位后版本号自增，用过 mediaUrl() 的组件会自动重渲染，
 *      下一次渲染就换成 ?mt=。
 *
 * 注意：这里**不能**因为"签名还没好"就返回不带令牌的地址 —— 那会让图片直接裂掉。
 * 旧 ?token= 方式在过渡期内继续可用（服务端 uploadAuth 保留该分支并打 warning）。
 */
export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  if (!path.startsWith('/uploads')) return path

  // 读取签名版本号：签名到位后本函数所在的组件会重新渲染（Vue 响应式依赖）
  readMediaSignVersion()

  const signed = signedMediaQuery(path)
  if (signed) {
    // 临近过期（默认 2 分钟）时后台续签；本次仍用旧签名，不断图
    if (needsSignRefresh(path)) void ensureSigned(path)
    return withQuery(path, signed)
  }

  void ensureSigned(path)

  const token = getToken()
  if (!token) return path
  return withQuery(path, 'token=' + encodeURIComponent(token))
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

/**
 * 预加载一张图片（查看器滑动前先拉相邻图，切过去不用等）
 * 抽成工具函数是为了可测：直接 stub 全局 Image 即可断言，不必依赖 DOM。
 */
export function preloadImage(url?: string | null): void {
  if (!url) return
  if (typeof Image === 'undefined') return
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  } catch {
    /* 预加载失败无影响 */
  }
}

/** 给定当前下标与总数，返回需要预加载的相邻下标（循环） */
export function neighborIndexes(index: number, total: number): number[] {
  if (!Number.isFinite(total) || total <= 1) return []
  const i = Math.max(0, Math.min(total - 1, index))
  const prev = (i - 1 + total) % total
  const next = (i + 1) % total
  return prev === next ? [next] : [prev, next]
}

/**
 * 下载受保护资源到本地（相册/请假证明/聊天图片的「保存」都用它）
 *
 * 历史问题：每个页面各写一遍 <a download> 逻辑，文件名处理还不一致。
 * 这里统一：带令牌、用 URL 的文件名、可选自定义名。
 */
export function downloadMedia(path?: string | null, filename?: string): boolean {
  const url = mediaUrl(path)
  if (!url) return false
  const name = filename || String(path).split('/').pop()?.split('?')[0] || 'download'
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return true
}

/** 打开受保护资源（新窗口/下载）时也补上令牌 */
export function openMedia(path?: string | null): void {
  const url = mediaUrl(path)
  if (url) window.open(url, '_blank')
}
