/**
 * 用户角色（统一前后端编码）
 *
 * 后端 users.role 字段为 INT，0 = 普通学员，1-7 = 七类干部，8 = 超级管理员（保留）
 * 这里集中维护「编码 ↔ 名称 ↔ 权限映射」，避免散落在各业务模块。
 *
 * 历史耦合点 (legacy): src/utils/auth.js 中 isAdminRole(role) 比较的是中文字符串，
 * 与后端 INT 不匹配，导致权限判断恒为 false。
 * 新代码请使用 hasPermission() / hasAnyRole() 而非 isAdminRole()。
 */

export const USER_ROLES = {
  STUDENT: 0,
  CLASS_LEADER: 1,         // 区队长
  LIFE_VICE: 2,            // 生活副区
  STUDY_VICE: 3,           // 学习副区
  PSYCHOLOGICAL_VICE: 4,   // 心理副区
  LEAGUE_SECRETARY: 5,     // 团支书
  ORGANIZATION_COMMITTEE: 6, // 组织委员
  PUBLICITY_COMMITTEE: 7,  // 宣传委员
  SUPER_ADMIN: 8,           // 系统管理员
  COUNSELOR: 9              // 辅导员
} as const;

export type UserRoleId = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_LABELS: Record<UserRoleId, string> = {
  [USER_ROLES.STUDENT]: '学员',
  [USER_ROLES.CLASS_LEADER]: '区队长',
  [USER_ROLES.LIFE_VICE]: '生活副区',
  [USER_ROLES.STUDY_VICE]: '学习副区',
  [USER_ROLES.PSYCHOLOGICAL_VICE]: '心理副区',
  [USER_ROLES.LEAGUE_SECRETARY]: '团支书',
  [USER_ROLES.ORGANIZATION_COMMITTEE]: '组织委员',
  [USER_ROLES.PUBLICITY_COMMITTEE]: '宣传委员',
  [USER_ROLES.SUPER_ADMIN]: '系统管理员',
  [USER_ROLES.COUNSELOR]: '辅导员'
};

export const ADMIN_ROLE_IDS: UserRoleId[] = [
  USER_ROLES.CLASS_LEADER,
  USER_ROLES.LIFE_VICE,
  USER_ROLES.STUDY_VICE,
  USER_ROLES.PSYCHOLOGICAL_VICE,
  USER_ROLES.LEAGUE_SECRETARY,
  USER_ROLES.ORGANIZATION_COMMITTEE,
  USER_ROLES.PUBLICITY_COMMITTEE,
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.COUNSELOR
];

/**
 * 模块化权限矩阵：业务能力 → 允许的角色集合
 * 每条权限只在这里声明一次，UI 与路由判定都从这里读
 */
export const PERMISSIONS = {
  // 班级仪表盘
  ACCESS_DASHBOARD: ADMIN_ROLE_IDS,

  // 通知/公告
  PUBLISH_NOTICE: ADMIN_ROLE_IDS,
  PUBLISH_ANNOUNCEMENT: [USER_ROLES.CLASS_LEADER, USER_ROLES.SUPER_ADMIN],

  // 请假
  APPROVE_LEAVE: [...ADMIN_ROLE_IDS, USER_ROLES.COUNSELOR],

  // 班费
  COLLECT_FEE: [USER_ROLES.LIFE_VICE, USER_ROLES.SUPER_ADMIN],
  BOOKKEEP_FEE: [USER_ROLES.ORGANIZATION_COMMITTEE, USER_ROLES.SUPER_ADMIN],
  APPROVE_FEE_USE: [...ADMIN_ROLE_IDS, USER_ROLES.COUNSELOR],

  // 作业 / 学习
  PUBLISH_HOMEWORK: [USER_ROLES.STUDY_VICE, USER_ROLES.SUPER_ADMIN],

  // 心理
  HANDLE_PSYCHOLOGICAL: [USER_ROLES.PSYCHOLOGICAL_VICE, USER_ROLES.SUPER_ADMIN],

  // 投票 / 抽奖
  CREATE_VOTE: ADMIN_ROLE_IDS,
  CREATE_LOTTERY: ADMIN_ROLE_IDS,

  // 建议箱处理
  HANDLE_SUGGESTION: ADMIN_ROLE_IDS,

  // 相册管理
  MANAGE_ALBUM: ADMIN_ROLE_IDS,
  APPROVE_PHOTO: ADMIN_ROLE_IDS,

  // 资源
  UPLOAD_RESOURCE: ADMIN_ROLE_IDS
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function isAdmin(role: number | undefined | null): boolean {
  return typeof role === 'number' && ADMIN_ROLE_IDS.includes(role as UserRoleId);
}

export function hasRole(role: number | undefined | null, target: UserRoleId): boolean {
  return role === target;
}

export function hasAnyRole(role: number | undefined | null, targets: readonly UserRoleId[]): boolean {
  return typeof role === 'number' && targets.includes(role as UserRoleId);
}

export function hasPermission(role: number | undefined | null, perm: PermissionKey): boolean {
  return hasAnyRole(role, PERMISSIONS[perm]);
}

export function getRoleLabel(role: number | undefined | null): string {
  if (typeof role !== 'number') return '未登录';
  return ROLE_LABELS[role as UserRoleId] || '学员';
}
