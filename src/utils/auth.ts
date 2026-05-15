/**
 * 类型安全版本 — auth.js 替换
 *
 * 这些函数原本是 auth.js 的兼容层。现在通过 useUserStore() 和
 * constants/roles.ts 直接实现，保持调用签名不变。
 *
 * @deprecated 新代码请直接使用 useUserStore().hasPermission() /
 *   useUserStore().isAdmin / store.setProfile() 等。本文件只保留
 *   未被 store 覆盖的纯工具函数（encodeBase64, decodeBase64 等）。
 */
import { useUserStore } from '@/stores/user'
import {
  USER_ROLES,
  ROLE_LABELS,
  hasPermission,
  hasAnyRole,
  isAdmin as _isAdmin,
} from '@/constants/roles'

/* ---------- 角色/权限校验 ---------- */

export function isAdmin(): boolean {
  const store = useUserStore()
  return store.isAdmin
}

export function canPublishNotice(): boolean {
  const store = useUserStore()
  return store.hasPermission('PUBLISH_NOTICE')
}

export function canApproveLeave(): boolean {
  const store = useUserStore()
  return store.hasPermission('APPROVE_LEAVE')
}

// 以下为从 auth.js 保留但实际无人引用的函数，保留导出以防外部依赖
export { USER_ROLES }
export type { UserRoleId } from '@/constants/roles'

export function setCurrentUser(user: Record<string, any>): void {
  try {
    const store = useUserStore()
    store.setProfile(user as any)
  } catch {
    uni.setStorageSync('user_profile', user)
  }
  uni.setStorageSync('isRegistered', true)
}
