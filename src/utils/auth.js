/**
 * 兼容层：保持旧业务页面 import 路径不变。
 * 新代码请直接使用 useUserStore() / src/constants/roles.ts。
 *
 * 历史 bug 修复：
 *   - 旧版 ADMIN_ROLES 是中文字符串，与后端 INT 永不相等 → 永远 false
 *   - 现在统一走 USER_ROLES (INT) + PERMISSIONS 矩阵
 */
import { useUserStore } from '@/stores/user'
import {
  USER_ROLES,
  ROLE_LABELS,
  ADMIN_ROLE_IDS,
  PERMISSIONS,
  hasPermission as _hasPermission,
  hasAnyRole as _hasAnyRole,
  isAdmin as _isAdmin
} from '@/constants/roles'

const MAX_ADMIN_COUNT = 7

/* ---------- 兼容旧导出（中文 key → INT 值） ---------- */
const ADMIN_ROLES = {
  CLASS_LEADER: USER_ROLES.CLASS_LEADER,
  LIFE_VICE: USER_ROLES.LIFE_VICE,
  STUDY_VICE: USER_ROLES.STUDY_VICE,
  PSYCHOLOGICAL_VICE: USER_ROLES.PSYCHOLOGICAL_VICE,
  LEAGUE_SECRETARY: USER_ROLES.LEAGUE_SECRETARY,
  ORGANIZATION_COMMITTEE: USER_ROLES.ORGANIZATION_COMMITTEE,
  PUBLICITY_COMMITTEE: USER_ROLES.PUBLICITY_COMMITTEE
}

function getCurrentUser() {
  // 同时尝试 store 和老存储 key（向下兼容历史代码）
  try {
    const store = useUserStore()
    if (store.profile) return store.profile
  } catch (_) {
    /* Pinia 未初始化时（极少数）降级到 storage */
  }
  const raw = uni.getStorageSync('user_profile') || uni.getStorageSync('userInfo')
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw
}

function setCurrentUser(user) {
  try {
    const store = useUserStore()
    store.setProfile(user)
  } catch (_) {
    uni.setStorageSync('user_profile', user)
  }
  uni.setStorageSync('isRegistered', true)
}

function isAdmin() {
  const user = getCurrentUser()
  if (!user) return false
  // 同时支持新字段 role(INT) 与遗留字段 isAdmin(boolean)
  if (typeof user.role === 'number') return _isAdmin(user.role)
  return !!user.isAdmin
}

function isAdminRole(roleId) {
  const user = getCurrentUser()
  if (!user) return false
  return user.role === roleId
}

function getAdminRole() {
  const user = getCurrentUser()
  return user ? (user.role ?? null) : null
}

function getAdminRoleLabel() {
  const user = getCurrentUser()
  if (!user || typeof user.role !== 'number') return ''
  return ROLE_LABELS[user.role] || ''
}

function canPublishHomework() {
  const user = getCurrentUser()
  return _hasPermission(user?.role, 'PUBLISH_HOMEWORK')
}

function canPublishNotice() {
  const user = getCurrentUser()
  return _hasPermission(user?.role, 'PUBLISH_NOTICE')
}

function canApproveNotice() {
  const user = getCurrentUser()
  return _hasPermission(user?.role, 'PUBLISH_NOTICE')
}

function canApproveLeave() {
  const user = getCurrentUser()
  return _hasPermission(user?.role, 'APPROVE_LEAVE')
}

function isTreasurer() {
  return isAdminRole(ADMIN_ROLES.LIFE_VICE)
}

function isBookkeeper() {
  return isAdminRole(ADMIN_ROLES.ORGANIZATION_COMMITTEE)
}

function isClassLeader() {
  return isAdminRole(ADMIN_ROLES.CLASS_LEADER)
}

async function verifySuperAdminPassword(password) {
  try {
    const res = await uni.request({
      url: `${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/verify-admin`,
      method: 'POST',
      data: { password }
    })
    return res.data && res.data.success
  } catch (e) {
    return false
  }
}

function getMaxAdminCount() {
  return MAX_ADMIN_COUNT
}

function getAdminRoles() {
  return Object.values(ROLE_LABELS).filter(label => label !== ROLE_LABELS[USER_ROLES.STUDENT])
}

function encodeBase64(str) {
  return uni.arrayBufferToBase64(new Uint8Array([...str].map(c => c.charCodeAt(0))).buffer)
}

function decodeBase64(str) {
  const bytes = uni.base64ToArrayBuffer(str)
  return String.fromCharCode(...new Uint8Array(bytes))
}

export {
  ADMIN_ROLES,
  USER_ROLES,
  PERMISSIONS,
  getCurrentUser,
  setCurrentUser,
  isAdmin,
  isAdminRole,
  getAdminRole,
  getAdminRoleLabel,
  canPublishHomework,
  canPublishNotice,
  canApproveNotice,
  canApproveLeave,
  isTreasurer,
  isBookkeeper,
  isClassLeader,
  verifySuperAdminPassword,
  getMaxAdminCount,
  getAdminRoles,
  encodeBase64,
  decodeBase64
}
