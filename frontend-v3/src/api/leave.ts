/**
 * 请假相关 API
 */
import { get, post, put } from '../utils/request'

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
  /** 审批人 JOIN */
  approver_name?: string
  /** 证明材料图片 URL 数组（JSON） */
  attachments?: string[] | string
}

export interface LeaveApplyParams {
  type: string
  reason: string
  start_time: string
  end_time: string
  /** 证明材料图片 URL 数组（后端 schema 与 model 都已支持，落库为 JSON） */
  attachments?: string[]
}

/**
 * 申请请假
 */
export function applyLeave(params: LeaveApplyParams): Promise<{ success: boolean; data: { id: number }; message: string }> {
  return post('/api/leave/apply', params)
}

/** 列表分页参数（P1-3）：不传 = 后端返回全量，行为与分页前一致 */
export interface PagingParams {
  /** 第几页，最小 1 */
  page?: number
  /** 每页条数 1–100（超过按 100 处理） */
  pageSize?: number
}

/** 仅分页请求会返回的附加字段（leaves 原样保留） */
export interface PageMeta {
  page?: number
  pageSize?: number
  total?: number
  hasMore?: boolean
}

/**
 * 获取我的请假记录
 *
 * 不传 paging = 全量（老客户端）；传了 page/pageSize 才走分页 SQL。
 */
export function getMyLeaves(paging?: PagingParams): Promise<{ success: boolean; leaves: LeaveItem[] } & PageMeta> {
  return get('/api/leave/my', paging)
}

/**
 * 获取所有请假记录（管理员）
 *
 * 不传 paging = 全量（老客户端）；传了 page/pageSize 才走分页 SQL。
 */
export function getAllLeaves(paging?: PagingParams): Promise<{ success: boolean; leaves: LeaveItem[] } & PageMeta> {
  return get('/api/leave/all', paging)
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
