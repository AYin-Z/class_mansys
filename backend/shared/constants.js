/**
 * 前后端统一的角色常量
 *
 * 前端 src/constants/roles.ts 与后端共享同一份编码。
 * 后端从本文件导入，避免各 controller 重复定义。
 *
 * 角色编码（与前端一致）：
 *   0 = 学员 (STUDENT)
 *   1 = 区队长 (CLASS_LEADER)
 *   2 = 生活副区 (LIFE_VICE)
 *   3 = 学习副区 (STUDY_VICE)
 *   4 = 心理副区 (PSYCHOLOGICAL_VICE)
 *   5 = 团支书 (LEAGUE_SECRETARY)
 *   6 = 组织委员 (ORGANIZATION_COMMITTEE)
 *   7 = 宣传委员 (PUBLICITY_COMMITTEE)
 *   8 = 系统管理员 (SUPER_ADMIN)
 *   9 = 辅导员 (COUNSELOR) — 仅后端扩展
 */

const ROLES = Object.freeze({
  STUDENT: 0,
  CLASS_LEADER: 1,
  LIFE_VICE: 2,
  STUDY_VICE: 3,
  PSYCHOLOGICAL_VICE: 4,
  LEAGUE_SECRETARY: 5,
  ORGANIZATION_COMMITTEE: 6,
  PUBLICITY_COMMITTEE: 7,
  SUPER_ADMIN: 8,
  COUNSELOR: 9,
});

/** 所有干部/管理角色 ID 集合（role >= 1 且不等同于普通学员即视为干部） */
const ADMIN_ROLES_SET = new Set([
  ROLES.CLASS_LEADER,
  ROLES.LIFE_VICE,
  ROLES.STUDY_VICE,
  ROLES.PSYCHOLOGICAL_VICE,
  ROLES.LEAGUE_SECRETARY,
  ROLES.ORGANIZATION_COMMITTEE,
  ROLES.PUBLICITY_COMMITTEE,
  ROLES.SUPER_ADMIN,
  ROLES.COUNSELOR,
]);

/**
 * 判断用户是否具有干部/管理权限
 * @param {object|undefined|null} user - req.user 对象
 * @returns {boolean}
 */
function isAdmin(user) {
  return user != null && ADMIN_ROLES_SET.has(Number(user.role));
}

/**
 * 判断用户是否为指定角色
 * @param {object|undefined|null} user
 * @param {number} roleId
 * @returns {boolean}
 */
function hasRole(user, roleId) {
  return user != null && Number(user.role) === roleId;
}

/**
 * 判断用户是否属于目标角色集合中的任意一个
 * @param {object|undefined|null} user
 * @param {number[]} roleIds
 * @returns {boolean}
 */
function hasAnyRole(user, roleIds) {
  return user != null && roleIds.includes(Number(user.role));
}

/** 干部 ID 数组（与前端 ADMIN_ROLE_IDS 对齐） */
const ADMIN_ROLE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

module.exports = {
  ROLES,
  ADMIN_ROLES_SET,
  ADMIN_ROLE_IDS,
  isAdmin,
  hasRole,
  hasAnyRole,
};
