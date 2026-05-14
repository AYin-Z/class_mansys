/**
 * 班费管理 API
 * 后端对应 routes/fee.js，覆盖收缴/申请/审批/投票/公示/汇总
 * 角色编码：0=学员, 1=区队长, 2=生活副区, 3=学习副区, 4=心理副区, 
 *          5=团支书, 6=组织委员, 7=宣传委员, 8=系统管理员
 */
import { get, post, put, del } from '@/utils/request'

// ===== 类型定义 =====

export interface FeeCollection {
  id: number
  title: string
  amount_per_person: number
  total_expected: number
  collected_amount: number
  semester: string
  status: number           // 0=收集中 1=已截止 2=已结清
  created_by: number
  creator_name?: string
  paid_count?: number      // 已缴纳人数
  total_count?: number     // 总人数
  created_at: string
}

export interface FeeCollectionRecord {
  id: number
  collection_id: number
  user_id: number
  name?: string
  student_id?: string
  amount: number
  paid_at: string | null
  is_exempt: boolean
  remark: string
}

export interface FeeExpense {
  id: number
  user_id: number
  type: string
  amount: number
  purpose: string
  tier: 'small' | 'medium' | 'large' // small≤100, medium=100-500, large>500
  approval_step: number    // 0=未提交 1=待区队长 2=待辅导员 3=待投票 -1=已完成
  status: number           // 0=待审批 1=已通过 2=已驳回
  proof_url?: string
  details?: any
  semester?: string
  approver_id?: number
  approval_notes?: string
  approval_time?: string
  applicant_name?: string
  student_id?: string
  approval_chain?: ApprovalNode[]
  created_at: string
}

export interface ApprovalNode {
  step: number
  status: number
  approver_name?: string
  notes?: string
}

export interface VoteResult {
  approveCount: number
  rejectCount: number
  totalVotes: number
  thresholdMet: boolean
}

export interface FeeSummary {
  balance: number
  totalIncome: number
  totalExpense: number
  pending_small: number
  pending_medium: number
  pending_large: number
  totalCollections: number
  totalCollected: number
}

export interface FeePublication {
  id: number
  title: string
  period: string
  total_income: number
  total_expense: number
  balance: number
  details_json?: any
  published_by: number
  publisher_name?: string
  published_at: string
}

// ===== 收缴 =====

/** 获取收缴批次列表 */
export function getCollections(): Promise<{ success: boolean; collections: FeeCollection[] }> {
  return get('/api/fee/collections')
}

/** 获取收缴批次详情 */
export function getCollectionDetail(id: number): Promise<{ success: boolean; collection: FeeCollection }> {
  return get(`/api/fee/collections/${id}`)
}

/** 创建收缴批次（仅生活副区） */
export function createCollection(params: { title: string; amount_per_person: number; semester: string }): Promise<{ success: boolean; id: number }> {
  return post('/api/fee/collections', params)
}

/** 缴纳班费 */
export function payCollection(collectionId: number, amount: number): Promise<{ success: boolean; message: string }> {
  return post(`/api/fee/collections/${collectionId}/pay`, { amount })
}

/** 标记免缴（仅生活副区） */
export function exemptCollection(collectionId: number, userId: number, remark: string): Promise<{ success: boolean; message: string }> {
  return post(`/api/fee/collections/${collectionId}/exempt`, { userId, remark })
}

/** 获取缴纳明细（仅干部） */
export function getCollectionRecords(collectionId: number): Promise<{ success: boolean; records: FeeCollectionRecord[] }> {
  return get(`/api/fee/collections/${collectionId}/records`)
}

/** 截止收缴（仅生活副区） */
export function closeCollection(collectionId: number): Promise<{ success: boolean; message: string }> {
  return post(`/api/fee/collections/${collectionId}/close`)
}

// ===== 申请 =====

/** 提交班费申请（含凭证图片） */
export function createExpense(params: {
  amount: number
  type?: string
  purpose: string
  proof_url?: string
  details?: any
  semester?: string
}): Promise<{ success: boolean; expenseId: number; message: string }> {
  return post('/api/fee/expenses', params)
}

/** 获取我的申请列表 */
export function getMyExpenses(): Promise<{ success: boolean; expenses: FeeExpense[] }> {
  return get('/api/fee/expenses/my')
}

/** 获取全部申请（仅干部） */
export function getAllExpenses(): Promise<{ success: boolean; expenses: FeeExpense[] }> {
  return get('/api/fee/expenses')
}

/** 获取申请详情（含审批链+投票结果） */
export function getExpenseDetail(id: number): Promise<{ success: boolean; expense: FeeExpense & { approvals: ApprovalNode[]; voteResult: VoteResult } }> {
  return get(`/api/fee/expenses/${id}`)
}

// ===== 审批 =====

/** 获取待审批列表 */
export function getPendingApprovals(): Promise<{ success: boolean; approvals: FeeExpense[] }> {
  return get('/api/fee/approvals/pending')
}

/** 审批通过 */
export function approveExpense(id: number, notes?: string): Promise<{ success: boolean; message: string }> {
  return post(`/api/fee/approvals/${id}`, { id, notes })
}

/** 驳回 */
export function rejectExpense(id: number, notes?: string): Promise<{ success: boolean; message: string }> {
  return post(`/api/fee/approvals/${id}/reject`, { id, notes })
}

/** 投票（大额审批） */
export function castVote(expenseId: number, vote: 1 | 2): Promise<{ success: boolean; approveCount?: number; error?: string }> {
  return post(`/api/fee/approvals/${expenseId}/vote`, { vote })
}

/** 获取投票结果 */
export function getVoteResult(expenseId: number): Promise<{ success: boolean; approveCount: number; rejectCount: number; totalVotes: number; thresholdMet: boolean }> {
  return get(`/api/fee/approvals/${expenseId}/votes`)
}

// ===== 公示 =====

/** 发布月度公示（仅组织委员） */
export function createPublication(title: string, period: string): Promise<{ success: boolean; id: number; message: string }> {
  return post('/api/fee/publications', { title, period })
}

/** 获取公示列表 */
export function getPublications(): Promise<{ success: boolean; publications: FeePublication[] }> {
  return get('/api/fee/publications')
}

/** 获取公示详情 */
export function getPublicationDetail(id: number): Promise<{ success: boolean; publication: FeePublication }> {
  return get(`/api/fee/publications/${id}`)
}

// ===== 汇总 =====

/** 获取全局统计（余额+待办+收缴） */
export function getSummary(): Promise<{ success: boolean; summary: FeeSummary }> {
  return get('/api/fee/summary')
}

// ===== 老兼容（由 fee/index.vue 等旧页面使用）=====

/** 提交班费记录（旧端点） */
export function createExpenseLegacy(params: { type: string; amount: number; purpose: string }): Promise<{ success: boolean; expenseId: number; message: string }> {
  return post('/api/fee/expense', params)
}

/** 获取班费余额（旧端点） */
export function getBalance(): Promise<{ success: boolean; balance: { balance: number; totalIncome: number; totalExpense: number } }> {
  return get('/api/fee/balance')
}
