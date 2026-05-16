/**
 * 匿名建议 API
 *
 * 设计：
 *  - 后端 suggestions 表无 user_id，纯匿名。
 *  - 前端把每次提交的 id 存进 LocalStorage（MY_IDS_KEY），
 *    "我的提交"通过 GET /api/suggestion/mine?ids=1,2,3 反查。
 */
import { get, post } from '@/utils/request'

const MY_IDS_KEY = 'my_suggestion_ids'

export interface SuggestionItem {
  id: number
  content: string
  category: string
  status: number          // 0=待处理, 1=处理中, 2=已处理
  handler_id?: number | null
  handler_name?: string | null
  handler_notes?: string | null
  created_at: string
  updated_at: string
}

export interface SuggestionSubmitParams {
  content: string
  category?: string
}

export interface SuggestionHandleParams {
  status: 0 | 1 | 2
  handler_notes?: string
}

export const SUGGESTION_STATUS_LABEL: Record<number, string> = {
  0: '待处理',
  1: '处理中',
  2: '已处理'
}

export function getMyIds(): number[] {
  const raw = JSON.parse(localStorage.getItem(MY_IDS_KEY) || 'null')
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr.filter(Number.isFinite) : []
  } catch {
    return []
  }
}

export function appendMyId(id: number) {
  const ids = getMyIds()
  if (!ids.includes(id)) ids.unshift(id)
  localStorage.setItem(MY_IDS_KEY, JSON.stringify(JSON.stringify(ids.slice(0, 200))))
}

export async function submitSuggestion(params: SuggestionSubmitParams) {
  const res = await post<{ success: boolean; id: number; message: string }>('/api/suggestion', params)
  if (res?.id) appendMyId(res.id)
  return res
}

export function getMineSuggestions(): Promise<{ success: boolean; suggestions: SuggestionItem[] }> {
  const ids = getMyIds()
  if (ids.length === 0) return Promise.resolve({ success: true, suggestions: [] })
  return get('/api/suggestion/mine', { ids: ids.join(',') })
}

/** 管理员：获取全部 */
export function getAllSuggestions(filters: { status?: number; category?: string } = {}): Promise<{ success: boolean; suggestions: SuggestionItem[] }> {
  return get('/api/suggestion', filters)
}

export function getSuggestionDetail(id: number): Promise<{ success: boolean; suggestion: SuggestionItem }> {
  return get(`/api/suggestion/${id}`)
}

export function handleSuggestion(id: number, params: SuggestionHandleParams): Promise<{ success: boolean }> {
  return post(`/api/suggestion/${id}/handle`, params)
}
