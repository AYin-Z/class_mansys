import { marked } from 'marked'
import { sanitizeHtml } from './sanitize'
import { mediaUrl } from './media'

/**
 * 助手回复的 Markdown 渲染
 *
 * 1. 把 Markdown 链接目标与裸露的 URL 统一交给 mediaUrl()（/uploads 自动补 ?token=）；
 * 2. 图片类 URL 直接升级为 Markdown 图片，保证「助手发图片」可用；
 * 3. marked 渲染后用 sanitizeHtml 白名单清洗，杜绝 XSS；
 * 4. 外链一律新窗口打开，避免把 SPA 导航出去。
 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i

const TOKEN_RE = new RegExp(
  [
    '(!?\\[[^\\]]*\\]\\()([^)\\s]+)(\\))', // 1) ![alt](url) / [alt](url)
    '(\\bhttps?:\\/\\/[^\\s<>"\u201c\u201d，。、；：！？（）【】《》]+|\\/uploads\\/[^\\s<>"\u201c\\u201d，。、；：！？（）【】《》]+)', // 2) 裸露 URL
  ].join('|'),
  'g',
)

function rewrite(text: string): string {
  return text.replace(TOKEN_RE, (match, _bang, mdUrl, mdClose, bareUrl) => {
    if (mdUrl) return _bang + mediaUrl(mdUrl) + mdClose
    if (bareUrl) {
      // 去掉中文标点/句末符号里被误吞的尾巴
      const cleaned = bareUrl.replace(/[.,;:!?、。；：！？]+$/, '')
      const tail = bareUrl.slice(cleaned.length)
      const url = mediaUrl(cleaned)
      return (IMAGE_EXT.test(cleaned) ? '![' + '图片' + '](' + url + ')' : '[' + cleaned + '](' + url + ')') + tail
    }
    return match
  })
}

marked.setOptions({ gfm: true, breaks: true })

export function renderMarkdown(text?: string | null): string {
  const raw = String(text || '')
  if (!raw.trim()) return ''
  let html: string
  try {
    html = marked.parse(rewrite(raw), { async: false }) as string
  } catch {
    html = '<p>' + raw.replace(/</g, '&lt;') + '</p>'
  }
  return sanitizeHtml(html).replace(/<a href=/g, '<a target="_blank" rel="noopener" href=')
}

/** 纯文本摘要（会话列表、通知气泡等场景） */
export function plainText(text?: string | null): string {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*>`_]/g, '')
    .trim()
}
