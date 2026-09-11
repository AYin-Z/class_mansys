import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getUnreadCount, getTodoCount } from '@/api/notice'
import { getToken } from '@/utils/request'

/**
 * 待办 / 未读角标
 *
 * 2026-09（B5）：此前 getUnreadCount / getTodoCount 接口已存在，
 * 但只在「我的」页拉一次、且不展示在首页与 TabBar，
 * 导致「必须标记完成」的待办通知最容易被漏掉。这里做成全局轻量 store：
 *   - TabBar 与首页共用同一份数字
 *   - 页面处理完待办后调用 refresh(true) 立即回源（默认 30s 节流）
 */
export const useBadgeStore = defineStore('badge', () => {
  const unreadCount = ref(0)
  const todoCount = ref(0)
  const loading = ref(false)

  /** 首页 / TabBar 用的醒目合计 */
  const totalUrgent = computed(() => unreadCount.value + todoCount.value)

  let _lastFetch = 0
  let _inFlight: Promise<void> | null = null

  /** @param force 跳过 30s 节流（处理完待办后调用） */
  async function refresh(force = false): Promise<void> {
    if (!getToken()) {
      unreadCount.value = 0
      todoCount.value = 0
      return
    }
    const now = Date.now()
    if (!force && now - _lastFetch < 30000) return
    if (_inFlight) return _inFlight

    loading.value = true
    _inFlight = (async () => {
      try {
        const [unread, todo] = await Promise.all([
          getUnreadCount().catch(() => null),
          getTodoCount().catch(() => null),
        ])
        // 拉取失败时保持旧值而不是归零：显示 0 会让用户以为"没有待办"
        const u = pickCount(unread)
        const t = pickCount(todo)
        if (u !== null) unreadCount.value = u
        if (t !== null) todoCount.value = t
        _lastFetch = Date.now()
      } finally {
        loading.value = false
        _inFlight = null
      }
    })()
    return _inFlight
  }

  function reset() {
    unreadCount.value = 0
    todoCount.value = 0
    _lastFetch = 0
  }

  return { unreadCount, todoCount, totalUrgent, loading, refresh, reset }
})

/** 兼容 { count } 与 { data: { count } } 两种返回壳 */
function pickCount(res: unknown): number | null {
  if (!res || typeof res !== 'object') return null
  const r = res as Record<string, any>
  const value = typeof r.count === 'number' ? r.count : r.data?.count
  return typeof value === 'number' ? value : null
}
