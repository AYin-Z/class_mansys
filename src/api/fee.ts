/**
 * 班费相关 API
 */
import { get, post, put } from '@/utils/request'

export interface FeeExpense {
  id: number
  user_id: number
  type: string       // 'income' | 'expense'
  amount: number
  purpose: string
  status: number     // 0=待审批, 1=已通过, 2=已驳回
  approval_notes?: string
  approver_id?: number
  approval_time?: string
  created_at: string
  updated_at: string
  user_name?: string
}

export interface FeeBalance {
  balance: number
  totalIncome: number
  totalExpense: number
}

export interface FeeExpenseParams {
  type: string
  amount: number
  purpose: string
}

/**
 * 提交班费记录
 */
export function createExpense(params: FeeExpenseParams): Promise<{ success: boolean; expenseId: number; message: string }> {
  return post('/api/fee/expense', params)
}

/**
 * 获取我的班费记录
 */
export function getMyExpenses(): Promise<{ success: boolean; expenses: FeeExpense[] }> {
  return get('/api/fee/my')
}

/**
 * 获取所有班费记录（管理员）
 */
export function getAllExpenses(): Promise<{ success: boolean; expenses: FeeExpense[] }> {
  return get('/api/fee/all')
}

/**
 * 审批班费记录（管理员）
 */
export function approveExpense(id: number, status: number, approval_notes?: string): Promise<{ success: boolean; message: string }> {
  return put('/api/fee/approve', { id, status, approval_notes })
}

/**
 * 获取班费余额
 */
export function getBalance(): Promise<{ success: boolean; balance: FeeBalance }> {
  return get('/api/fee/balance')
}
