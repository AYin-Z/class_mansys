/**
 * 请假相关 API
 */
import { get, post, put } from '@/utils/request'

export interface LeaveItem {
  id: number
  user_id: number
  /** 数据库字段 leave_type（早操 / 早集合 / …） */
  leave_type: string
  reason: string
  start_time: string
  end_time: string
  status: number // 0=待审批, 1=已通过, 2=已驳回
  approval_notes?: string
  approver_id?: number
  approval_time?: string
  is_cancelled?: boolean | number
  cancelled_time?: string
  cancel_time?: string
  created_at: string
  updated_at: string
  /** 管理员列表 JOIN */
  applicant_name?: string
  applicant_student_id?: string
}

export interface LeaveApplyParams {
  type: string
  reason: string
  start_time: string
  end_time: string
}

/**
 * 申请请假
 */
export function applyLeave(params: LeaveApplyParams): Promise<{ success: boolean; leaveId: number; message: string }> {
  return post('/api/leave/apply', params)
}

/**
 * 获取我的请假记录
 */
export function getMyLeaves(): Promise<{ success: boolean; leaves: LeaveItem[] }> {
  return get('/api/leave/my')
}

/**
 * 获取所有请假记录（管理员）
 */
export function getAllLeaves(): Promise<{ success: boolean; leaves: LeaveItem[] }> {
  return get('/api/leave/all')
}

/**
 * 单条详情（本人或管理员）
 */
export function getLeaveById(id: number): Promise<{ success: boolean; leave: LeaveItem }> {
  return get(`/api/leave/${id}`)
}

/**
 * 审批请假（管理员）
 */
export function approveLeave(id: number, status: number, approval_notes?: string): Promise<{ success: boolean; message: string }> {
  return put('/api/leave/approve', { id, status, approval_notes })
}

/**
 * 销假（取消自己的请假）
 */
export function cancelLeave(id: number): Promise<{ success: boolean; message: string }> {
  return put(`/api/leave/cancel/${id}`)
}
