import { get } from '@/utils/request'

export interface AdminMember {
  id: number
  name: string
  nickName?: string
  student_id: string
  class_id: string
  class_name?: string
  role: number
  phone?: string
  email?: string
  avatarUrl?: string
  gender?: number
  created_at?: string
  leave_count: number
  active_leave_count: number
  last_action_at: string | null
}

export interface MemberListResult {
  success: boolean
  page: number
  pageSize: number
  total: number
  members: AdminMember[]
}

export interface LeaveItem {
  id: number
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  status: number
  approver_id: number | null
  approval_time: string | null
  approval_notes: string | null
  is_cancelled: boolean | number
  cancelled_time: string | null
  created_at: string
}

export interface OperationItem {
  id: number
  action: string
  resource_type: string | null
  resource_id: string | null
  method: string | null
  path: string | null
  status_code: number | null
  detail: string | null
  created_at: string
}

export interface MemberDetailResult {
  success: boolean
  user: AdminMember & { openid?: string; updated_at?: string }
  active_leave: LeaveItem | null
  leaves: LeaveItem[]
  operations: OperationItem[]
  stats: {
    leave_count: number
    approved_leave_count: number
    pending_leave_count: number
    total_points: number
  }
}

export function listMembers(params: {
  class_id?: string
  keyword?: string
  page?: number
  pageSize?: number
} = {}): Promise<MemberListResult> {
  return get<MemberListResult>('/api/admin/members', params)
}

export function getMemberDetail(id: number | string): Promise<MemberDetailResult> {
  return get<MemberDetailResult>(`/api/admin/members/${id}`)
}

export function getRecentOperations(params: { class_id?: string; limit?: number } = {}): Promise<{
  success: boolean
  operations: Array<OperationItem & { user_id: number; user_name?: string; student_id?: string; class_id?: string }>
}> {
  return get('/api/admin/operations', params)
}
