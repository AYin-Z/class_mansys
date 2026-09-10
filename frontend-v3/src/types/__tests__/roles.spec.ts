import { describe, it, expect } from 'vitest'
import {
  USER_ROLES,
  ROLE_LABELS,
  ADMIN_ROLE_IDS,
  PERMISSIONS,
  isAdmin,
  hasPermission,
  getRoleLabel
} from '@/types/roles'

describe('角色定义', () => {
  it('角色编码与后端一致（0-9）', () => {
    expect(USER_ROLES.STUDENT).toBe(0)
    expect(USER_ROLES.CLASS_LEADER).toBe(1)
    expect(USER_ROLES.PUBLICITY_COMMITTEE).toBe(7)
    expect(USER_ROLES.SUPER_ADMIN).toBe(8)
    expect(USER_ROLES.COUNSELOR).toBe(9)
  })

  it('每个角色都有中文标签', () => {
    for (const value of Object.values(USER_ROLES)) {
      expect(ROLE_LABELS[value as keyof typeof ROLE_LABELS]).toBeTruthy()
    }
  })

  it('ADMIN_ROLE_IDS 为 1-9', () => {
    expect(ADMIN_ROLE_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('isAdmin 只认干部', () => {
    expect(isAdmin(0)).toBe(false)
    expect(isAdmin(1)).toBe(true)
    expect(isAdmin(9)).toBe(true)
    expect(isAdmin(null)).toBe(false)
  })
})

describe('权限矩阵', () => {
  it('发布公告仅区队长/超管', () => {
    expect(hasPermission(USER_ROLES.CLASS_LEADER, 'PUBLISH_ANNOUNCEMENT')).toBe(true)
    expect(hasPermission(USER_ROLES.SUPER_ADMIN, 'PUBLISH_ANNOUNCEMENT')).toBe(true)
    expect(hasPermission(USER_ROLES.STUDY_VICE, 'PUBLISH_ANNOUNCEMENT')).toBe(false)
    expect(hasPermission(USER_ROLES.STUDENT, 'PUBLISH_ANNOUNCEMENT')).toBe(false)
  })

  it('班费收缴仅生活副区/超管', () => {
    expect(hasPermission(USER_ROLES.LIFE_VICE, 'COLLECT_FEE')).toBe(true)
    expect(hasPermission(USER_ROLES.CLASS_LEADER, 'COLLECT_FEE')).toBe(false)
  })

  it('中队概览对所有管理角色开放（平行查看）', () => {
    for (const role of ADMIN_ROLE_IDS) {
      expect(hasPermission(role, 'VIEW_COMPANY'), '角色 ' + role).toBe(true)
    }
    expect(hasPermission(USER_ROLES.STUDENT, 'VIEW_COMPANY')).toBe(false)
  })

  it('PERMISSIONS 中不存在空角色集合', () => {
    for (const [key, roles] of Object.entries(PERMISSIONS)) {
      expect(roles.length, key + ' 为空').toBeGreaterThan(0)
    }
  })
})

describe('角色标签', () => {
  it('未知角色回退为学员', () => {
    expect(getRoleLabel(0)).toBe('学员')
    expect(getRoleLabel(99 as never)).toBe('学员')
    expect(getRoleLabel(null)).toBe('未登录')
  })
})
