import { get } from '../utils/request'

export interface LeaveTypeConfig {
  id: number
  type_name: string
  start_time: string | null   // "06:00:00" or null
  end_time: string | null     // "07:00:00" or null
  is_fixed: boolean | number  // 1/0 from MySQL, normalized to boolean on read
  reasons: string[]           // parsed JSON array
  enabled: boolean | number
  sort_order: number
}

/** 获取所有启用的请假类型（供申请页 / 仪表盘使用） */
export function getLeaveTypes(): Promise<{ success: boolean; data: LeaveTypeConfig[] }> {
  return get('/api/leave/types')
}
