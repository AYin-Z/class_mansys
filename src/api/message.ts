import { get, post, del } from '@/utils/request'

export interface MessageItem {
  id: number
  content: string
  user_id: number
  user_name?: string
  user_avatar?: string
  target_id: number
  target_type: string
  parent_id?: number | null
  created_at: string
}

export function getMessages(target_type: string, target_id: number): Promise<{ success: boolean; messages: MessageItem[] }> {
  return get('/api/message', { target_type, target_id })
}

export function postMessage(params: { content: string; target_id: number; target_type: string; parent_id?: number }): Promise<{ success: boolean; id: number }> {
  return post('/api/message', params)
}

export function deleteMessage(id: number): Promise<{ success: boolean }> {
  return del(`/api/message/${id}`)
}
