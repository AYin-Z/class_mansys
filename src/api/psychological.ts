import { get, post, put } from '@/utils/request'

export interface PsychApplication {
  id: number
  user_id: number
  user_name?: string
  student_id?: string
  content: string
  status: number   // 0=待处理 1=处理中 2=已完成
  handler_id?: number | null
  handler_name?: string | null
  handler_notes?: string | null
  created_at: string
  updated_at: string
}

export const PSYCH_STATUS_LABEL: Record<number, string> = {
  0: '待处理',
  1: '处理中',
  2: '已完成'
}

export function submitPsychApplication(content: string): Promise<{ success: boolean; id: number; message: string }> {
  return post('/api/psychological', { content })
}

export function getMyPsychApplications(): Promise<{ success: boolean; applications: PsychApplication[] }> {
  return get('/api/psychological/mine')
}

export function getAllPsychApplications(filters: { status?: number } = {}): Promise<{ success: boolean; applications: PsychApplication[] }> {
  return get('/api/psychological/all', filters)
}

export function getPsychDetail(id: number): Promise<{ success: boolean; application: PsychApplication }> {
  return get(`/api/psychological/${id}`)
}

export function handlePsychApplication(id: number, params: { status: 0 | 1 | 2; handler_notes?: string }): Promise<{ success: boolean }> {
  return put(`/api/psychological/${id}/handle`, params)
}
