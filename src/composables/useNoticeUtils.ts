/**
 * 通知优先级相关的工具函数。
 * 提取首页中的 priorityClass / priorityLabel / priorityIcon 纯函数。
 */

export function usePriorityClass(p: number): string {
  if (p >= 2) return 'urgent'
  if (p === 1) return 'important'
  return 'normal'
}

export function usePriorityLabel(p: number): string {
  if (p >= 2) return '紧急'
  if (p === 1) return '重要'
  return '日常'
}

export function usePriorityIcon(p: number): string {
  if (p >= 2) return '⚠'
  if (p === 1) return '★'
  return '•'
}
