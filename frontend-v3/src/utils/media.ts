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

/** 打开受保护资源（新窗口/下载）时也补上令牌 */
export function openMedia(path?: string | null): void {
  const url = mediaUrl(path)
  if (url) window.open(url, '_blank')
}
