/**
 * 日期时间相关 composable。
 * 提取首页中的 greeting / currentDate / formatDate 纯函数。
 */

/** 根据小时返回问候语 */
export function useGreeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

/** 格式化当前日期：2026年05月15日 · 周五 */
export function useCurrentDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${y}年${m}月${d}日 · ${w}`
}

/**
 * 格式化日期时间字符串：`05-15 14:30`
 * @param s ISO 日期字符串
 */
export function useFormatDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${hh}:${mm}`
}
