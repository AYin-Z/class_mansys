/**
 * 通知相关 API
 */
import { get, post, put, del } from '../utils/request'

export interface NoticeItem {
  id: number
  title: string
  content: string
  summary?: string
  type?: string
  priority: number
  creator_id: number
  is_pinned?: boolean
  is_todo?: boolean
  is_completed?: boolean
  is_read?: boolean
  attachments?: AttachmentItem[] | null
  created_at: string
  updated_at: string
  creator_name?: string
  creator_nickname?: string
}

export interface AttachmentItem {
  name: string
  url: string
  size: number
  type: string
}

export interface NoticeCreateParams {
  title: string
  content: string
  summary?: string
  type?: string
  priority?: number
  is_pinned?: boolean
  is_todo?: boolean
  attachments?: AttachmentItem[]
}

export interface CompletionUser {
  id: number; name: string; student_id: string; completed_at: string
}

export interface TodoCompletion {
  completed: CompletionUser[]
  pending: CompletionUser[]
  total: number
}

/**
 * 获取通知详情（自动标记已读，待办通知附带完成状态）
 */
export function getNoticeDetail(id: number): Promise<{ success: boolean; notice: NoticeItem & { is_completed?: boolean }; completion?: TodoCompletion }> {
  return get(`/api/notice/${id}`)
}

/**
 * 获取未读通知数量
 */
export function getUnreadCount(): Promise<{ success: boolean; count: number }> {
  return get('/api/notice/unread/count')
}

/**
 * 获取待办通知数量
 */
export function getTodoCount(): Promise<{ success: boolean; count: number }> {
  return get('/api/notice/todo/count')
}

/**
 * 标记待办通知为已完成
 */
export function completeTodo(id: number): Promise<{ success: boolean; message: string }> {
  return post(`/api/notice/${id}/complete`)
}

/**
 * 获取通知列表
 */
export function getNotices(): Promise<{ success: boolean; notices: NoticeItem[] }> {
  return get('/api/notice')
}

/**
 * 发布通知（管理员）
 */
export function createNotice(params: NoticeCreateParams): Promise<{ success: boolean; data: { id: number }; message: string }> {
  return post('/api/notice/create', params)
}

/**
 * 更新通知（管理员）
 */
export function updateNotice(id: number, params: Partial<NoticeCreateParams>): Promise<{ success: boolean; notice: NoticeItem }> {
  return put(`/api/notice/${id}`, params)
}

/**
 * 删除通知（管理员）
 */
export function deleteNotice(id: number): Promise<{ success: boolean }> {
  return del(`/api/notice/${id}`)
}

/** 获取待办通知完成情况 */
export interface TodoCompletionResult {
  success: boolean
  completed: { id: number; name: string; student_id: string; completed_at: string }[]
  pending: { id: number; name: string; student_id: string }[]
  total: number
}
export function getTodoCompletion(id: number): Promise<TodoCompletionResult> {
  return get(`/api/notice/${id}/completion`)
}
