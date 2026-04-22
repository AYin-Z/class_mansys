/**
 * 通知相关 API
 */
import { get, post, del } from '@/utils/request'

export interface NoticeItem {
  id: number
  title: string
  content: string
  summary?: string
  type?: string     // 系统通知/集合通知/学习通知/活动通知/其他
  priority: number  // 0=日常, 1=重要, 2=紧急
  creator_id: number
  is_pinned?: boolean
  created_at: string
  updated_at: string
  creator_name?: string
  creator_nickname?: string
  is_read?: boolean
}

export interface NoticeCreateParams {
  title: string
  content: string
  summary?: string
  type?: string
  priority?: number
  is_pinned?: boolean
}

/**
 * 获取通知列表
 */
export function getNotices(): Promise<{ success: boolean; notices: NoticeItem[] }> {
  return get('/api/notice')
}

/**
 * 获取通知详情（自动标记已读）
 */
export function getNoticeDetail(id: number): Promise<{ success: boolean; notice: NoticeItem }> {
  return get(`/api/notice/${id}`)
}

/**
 * 获取未读通知数量
 */
export function getUnreadCount(): Promise<{ success: boolean; count: number }> {
  return get('/api/notice/unread/count')
}

/**
 * 发布通知（管理员）
 */
export function createNotice(params: NoticeCreateParams): Promise<{ success: boolean; noticeId: number; message: string }> {
  return post('/api/notice/create', params)
}

/**
 * 删除通知（管理员）
 */
export function deleteNotice(id: number): Promise<{ success: boolean }> {
  return del(`/api/notice/${id}`)
}
