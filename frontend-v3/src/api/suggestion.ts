/**
 * 匿名建议 API
 *
 * 设计：
 *  - 后端 suggestions 表无 user_id，纯匿名。
 *  - 提交时后端返回 viewToken，前端本地保存 token，
 *    "我的提交"通过 GET /api/suggestion/mine?tokens=xxx 反查，
 *    避免按顺序 id 枚举读取他人建议。
 */
import { get, post } from '../utils/request'

const MY_TOKENS_KEY = 'my_suggestion_tokens'

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

export function getMyTokens(): string[] {
  try {
    const raw = localStorage.getItem(MY_TOKENS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const arr = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

export function appendMyToken(token: string) {
  const tokens = getMyTokens()
  if (!tokens.includes(token)) tokens.unshift(token)
  localStorage.setItem(MY_TOKENS_KEY, JSON.stringify(tokens.slice(0, 200)))
}

export async function submitSuggestion(params: SuggestionSubmitParams) {
  const res = await post<{ success: boolean; id: number; viewToken?: string; message: string }>('/api/suggestion', params)
  if (res?.viewToken) appendMyToken(res.viewToken)
  return res
}

export function getMineSuggestions(): Promise<{ success: boolean; suggestions: SuggestionItem[] }> {
  const tokens = getMyTokens()
  if (tokens.length === 0) return Promise.resolve({ success: true, suggestions: [] })
  return get('/api/suggestion/mine', { tokens: tokens.join(',') })
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
