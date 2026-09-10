/**
 * 中队（公司）级 API —— 多区队聚合 / 实时出勤
 */
import { get } from '../utils/request'

export interface CompanyClassStat {
  class_id: string
  class_name: string
  total_members: number
  member_count: number
  on_leave: number
  present: number
  currently_leave: number
  not_returned: number
}

export interface CompanyOverviewResult {
  success: boolean
  date: string
  classes: CompanyClassStat[]
  summary: {
    total: number
    on_leave: number
    present: number
    currently_leave: number
    not_returned: number
  }
}

export interface CompanyClassItem {
  class_id: string
  class_name: string
  company_id?: string
  member_count?: number
}

export interface CompanyClassesResult {
  success: boolean
  companies: { id: string; name: string; code?: string }[]
  classes: CompanyClassItem[]
}

export interface CompanyLeaveRecord {
  id: number
  user_name: string
  student_id: string
  class_id: string
  class_name?: string
  leave_type: string
  start_time: string
  end_time: string
  reason: string
  status: number
}

export interface CompanyLeaveRecordsResult {
  success: boolean
  date: string
  records: CompanyLeaveRecord[]
}

/** 中队出勤概览（按日期） */
export function getCompanyOverview(date?: string): Promise<CompanyOverviewResult> {
  return get('/api/company/overview', { date })
}

/** 中队下区队列表 */
export function getCompanyClasses(companyId?: string): Promise<CompanyClassesResult> {
  return get('/api/company/classes', { company_id: companyId })
}

/** 当天在假请假明细（跨区队） */
export function getCompanyLeaveRecords(date?: string, companyId?: string): Promise<CompanyLeaveRecordsResult> {
  return get('/api/company/leave-records', { date, company_id: companyId })
}
