/**
 * 用户相关 API
 */
import { get, put, del } from '@/utils/request'

export interface UserItem {
  id: number
  openid: string
  name: string
  nickName: string
  student_id: string
  class_id: string
  role: number
  phone: string
  email: string
  avatarUrl: string
  gender: number
  created_at: string
  updated_at: string
}

/**
 * 获取所有用户（管理员）
 */
export function getAllUsers(): Promise<{ success: boolean; users: UserItem[] }> {
  return get('/api/users')
}

/**
 * 获取单个用户
 */
export function getUserById(id: number): Promise<{ success: boolean; user: UserItem }> {
  return get(`/api/users/${id}`)
}

/**
 * 更新用户信息
 */
export function updateUser(id: number, data: Partial<UserItem>): Promise<{ success: boolean; user: UserItem }> {
  return put(`/api/users/${id}`, data)
}

/**
 * 删除用户（管理员）
 */
export function deleteUser(id: number): Promise<{ success: boolean }> {
  return del(`/api/users/${id}`)
}
