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

/** 列表分页参数（P1-3）：不传 = 后端返回全量，行为与分页前一致 */
export interface PagingParams {
  /** 第几页，最小 1 */
  page?: number
  /** 每页条数 1–100（超过按 100 处理） */
  pageSize?: number
}

/** 仅分页请求会返回的附加字段（notices 等老字段原样保留） */
export interface PageMeta {
  page?: number
  pageSize?: number
  total?: number
  hasMore?: boolean
}

/**
 * 获取通知列表
 *
 * 不传 paging = 全量（老客户端）；传了 page/pageSize 才走分页 SQL，
 * 响应额外带 page/pageSize/total/hasMore。
 */
export function getNotices(paging?: PagingParams): Promise<{ success: boolean; notices: NoticeItem[] } & PageMeta> {
  return get('/api/notice', paging)
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
