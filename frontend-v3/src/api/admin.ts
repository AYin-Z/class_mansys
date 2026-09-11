import { get, post, put, del, uploadFile, apiUrl } from '../utils/request'
import type { LeaveTypeConfig } from './leave-config'

export interface AdminMember {
  id: number
  name: string
  nickName?: string
  student_id: string
  class_id: string
  class_name?: string
  role: number
  duty_note?: string | null
  member_type?: string
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
  role?: number
  /** 默认不含已离开人员；left=只看已离开；all=全部 */
  member_type?: 'student' | 'left' | 'all'
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

/** 修改成员角色（仅超管） */
export function updateMemberRole(memberId: number, role: number): Promise<{ success: boolean; message: string }> {
  return put(`/api/admin/members/${memberId}/role`, { role })
}

/** 获取请假类型配置（仅超管，含禁用项） */
export function getAdminLeaveConfig(): Promise<{ success: boolean; data: LeaveTypeConfig[] }> {
  return get('/api/admin/leave-config')
}

/** 更新请假类型配置（仅超管） */
export function updateLeaveConfig(id: number, fields: Partial<LeaveTypeConfig>): Promise<{ success: boolean; message: string }> {
  return put(`/api/admin/leave-config/${id}`, fields)
}

// ============================================================
// 超管控制台（新增）
// ============================================================

export interface ConsoleOverview {
  scale: { companies: number; classes: number; users: number; students: number; cadres: number; admins: number; staff: number; left: number }
  today: { date: string; onLeave: number; pendingLeaves: number; overduePending: number; byType: { type: string; count: number }[] }
  todos: { pendingLeaves: number; pendingFee: number; pendingHomework: number; unhandledSuggestion: number; pendingPsych: number; pendingPhoto: number }
  classes: { class_id: string; class_name: string; students: number; cadres: number; left: number }[]
  roleDist: { role: number; count: number }[]
  trend: { day: string; count: number }[]
  recentOps: { id: number; action: string; method: string; path: string; status_code: number; created_at: string; user_name?: string }[]
  agent: { conversations: number; messages: number; messages7d: number; users: number; activeTokens: number; wechatBindings: number }
  health: { errors24h: number; dbSizeMb: number; tables: number }
}

export function getConsoleOverview(): Promise<{ success: boolean; data: ConsoleOverview }> {
  return get('/api/admin/console/overview')
}

export function getConsoleTodos(): Promise<{ success: boolean; data: { items: { key: string; label: string; count: number; path: string }[] } }> {
  return get('/api/admin/console/todos')
}

export interface AgentPanelData {
  daily: { day: string; messages: number; conversations: number }[]
  tokens: { id: number; name: string | null; prefix: string; allow_write: number; last_used_at: string | null; revoked_at: string | null; created_at: string; user_name?: string; student_id?: string; class_id?: string }[]
  bindings: { id: number; channel: string; external_id: string; display_name: string | null; status: string; created_at: string; user_name?: string; class_id?: string }[]
  quota: { messages24h: number; users24h: number; dailyLimitPerUser: number }
  topTools: { tool: string; count: number }[]
  llmMode: string
  wechat: { worker: string; configured: boolean; credentialsFile: string }
}

export function getAgentPanel(): Promise<{ success: boolean; data: AgentPanelData }> {
  return get('/api/admin/console/agent')
}

export function revokeAnyToken(id: number): Promise<{ success: boolean; message?: string }> {
  return del('/api/agent/tokens/' + id)
}

export interface AdminClassRow {
  id: string
  name: string
  company_id: string | null
  company_name?: string | null
  students: number
  cadres: number
  lefts: number
}

export interface ClassesResult {
  success: boolean
  data: {
    classes: AdminClassRow[]
    companies: { id: string; name: string }[]
    leaders: { class_id: string; name: string }[]
  }
}

export function getAdminClasses(): Promise<ClassesResult> {
  return get('/api/admin/classes')
}

export function createAdminClass(body: { id: string; name: string; company_id?: string }): Promise<{ success: boolean; message?: string }> {
  return post('/api/admin/classes', body)
}

export function updateAdminClass(id: string, body: { name?: string; company_id?: string }): Promise<{ success: boolean; message?: string }> {
  return put('/api/admin/classes/' + id, body)
}

export function updateCompany(id: string, name: string): Promise<{ success: boolean; message?: string }> {
  return put('/api/admin/companies/' + id, { name })
}

export function createMember(body: {
  name: string
  student_id: string
  class_id?: string
  role?: number
  duty_note?: string | null
  member_type?: 'student' | 'staff' | 'system'
  password?: string
}): Promise<{ success: boolean; data: { id: number; student_id: string; defaultPassword: string }; message?: string }> {
  return post('/api/admin/members', body)
}

export function updateMember(id: number, body: Partial<{ name: string; student_id: string; class_id: string; role: number; duty_note: string | null; member_type: string }>): Promise<{ success: boolean; message?: string }> {
  return put('/api/admin/members/' + id, body)
}

export function resetMemberPassword(id: number, password?: string): Promise<{ success: boolean; data: { name: string; student_id: string; password: string }; message?: string }> {
  return post('/api/admin/members/' + id + '/reset-password', password ? { password } : {})
}

export function setMemberStatus(id: number, status: 'left' | 'student'): Promise<{ success: boolean; message?: string }> {
  return post('/api/admin/members/' + id + '/status', { status })
}

export function deleteMember(id: number): Promise<{ success: boolean; message?: string }> {
  return del('/api/admin/members/' + id)
}

export function bulkMembers(body: { ids: number[]; action: 'set_class' | 'set_role' | 'set_duty_note' | 'move_out' | 'restore' | 'reset_password'; value?: string | number }): Promise<{ success: boolean; data: { done: number; total: number; skipped: { id: number; reason: string }[] }; message?: string }> {
  return post('/api/admin/members/bulk', body)
}

export interface RosterPreview {
  plan: {
    class_id: string
    class_name: string
    sheet: string
    sheetCount: number
    creates: { student_id: string; name: string; class_id: string }[]
    updates: { id: number; student_id: string; name: string; diffs: { field: string; from: string; to: string }[] }[]
    leaves: { id: number; student_id: string; name: string; member_type: string }[]
    unchangedCount: number
    warnings: { level: string; text: string }[]
  }[]
  summary: { create: number; update: number; leave: number; unchanged: number }
  warnings: { level: string; text: string; class?: string }[]
}

export function uploadRosterPreview(file: File): Promise<{ success: boolean; data: RosterPreview }> {
  return uploadFile('/api/admin/roster/preview', file)
}

export function applyRoster(file: File): Promise<{ success: boolean; data: { summary: RosterPreview['summary']; created: { student_id: string; name: string }[]; defaultPassword: string }; message?: string }> {
  return uploadFile('/api/admin/roster/apply', file)
}

export interface AuditRow {
  id: number
  user_id: number | null
  action: string | null
  method: string
  path: string
  status_code: number
  ip: string | null
  created_at: string
  user_name?: string | null
  student_id?: string | null
  class_id?: string | null
}

export function getAuditLog(params: {
  page?: number
  pageSize?: number
  userId?: number
  keyword?: string
  method?: string
  status?: number
  from?: string
  to?: string
  errorsOnly?: 1
} = {}): Promise<{ success: boolean; data: { page: number; pageSize: number; total: number; rows: AuditRow[]; stats24h: { all_count: number; errors: number; server_errors: number } } }> {
  return get('/api/admin/audit', params)
}

export function auditExportUrl(): string {
  return apiUrl('/api/admin/audit/export')
}

export interface SystemStatus {
  process: { node: string; uptimeSec: number; memoryMb: number; pid: number; env: string; port: number; service: { ok: boolean; out: string; err: string } }
  database: { name: string; tables: number; migrationsApplied: number; lastMigration: { id: string; applied_at: string } | null }
  timers: string[]
  backups: { name: string; size: number; mtime: string }[]
  digests: { name: string; size: number; mtime: string }[]
  errors: { count24h: number; byPath: { path: string; method: string; count: number }[]; topPaths: { path: string; count: number }[] }
  flags: Record<string, string | boolean>
}

export function getSystemStatus(): Promise<{ success: boolean; data: SystemStatus }> {
  return get('/api/admin/system/status')
}

export function runBackup(): Promise<{ success: boolean; data: { ok: boolean; output: string; latest: { name: string; size: number; mtime: string } | null }; message?: string }> {
  return post('/api/admin/system/backup', {})
}

export function rosterCsvUrl(): string {
  return apiUrl('/api/admin/export/roster.csv')
}

export function rosterXlsxUrl(): string {
  return apiUrl('/api/admin/export/roster.xlsx')
}

export interface PermissionKeyRow {
  key: string
  label: string
  roles: number[]
  defaultRoles: number[]
}

export function getPermissionMatrix(): Promise<{ success: boolean; data: { keys: PermissionKeyRow[] } }> {
  return get('/api/admin/permissions')
}

export function updatePermissionMatrix(key: string, roles: number[]): Promise<{ success: boolean; data: { key: string; roles: number[] }; message?: string }> {
  return put('/api/admin/permissions/' + key, { roles })
}
