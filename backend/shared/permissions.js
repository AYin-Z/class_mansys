const { ROLES, ADMIN_ROLE_IDS } = require('./constants');

/**
 * 权限矩阵（后端唯一权威来源，P1 契约统一）
 *
 * 设计说明：
 * - 值为「当前实际生效」的角色集合，保证重构上线不缩小/扩大现有可操作范围；
 * - 若要收紧某能力（例如「班费收缴仅生活副区」），只改本文件一处即可；
 * - 前端 frontend-v3/src/types/roles.ts 的 PERMISSIONS 由测试保证与本文件一致。
 */
const PERMISSIONS = Object.freeze({
  ACCESS_DASHBOARD: ADMIN_ROLE_IDS,

  PUBLISH_NOTICE: ADMIN_ROLE_IDS,
  MANAGE_NOTICE: ADMIN_ROLE_IDS,

  PUBLISH_ANNOUNCEMENT: [ROLES.CLASS_LEADER, ROLES.SUPER_ADMIN],
  MANAGE_ANNOUNCEMENT: ADMIN_ROLE_IDS,

  APPROVE_LEAVE: ADMIN_ROLE_IDS,

  COLLECT_FEE: ADMIN_ROLE_IDS, // 收紧候选：[LIFE_VICE, SUPER_ADMIN]
  BOOKKEEP_FEE: ADMIN_ROLE_IDS, // 收紧候选：[ORGANIZATION_COMMITTEE, SUPER_ADMIN]
  APPROVE_FEE_USE: ADMIN_ROLE_IDS,

  PUBLISH_HOMEWORK: ADMIN_ROLE_IDS, // 收紧候选：[STUDY_VICE, SUPER_ADMIN]
  GRADE_HOMEWORK: ADMIN_ROLE_IDS,

  HANDLE_PSYCHOLOGICAL: ADMIN_ROLE_IDS, // 收紧候选：[PSYCHOLOGICAL_VICE, COUNSELOR, SUPER_ADMIN]

  CREATE_VOTE: ADMIN_ROLE_IDS,
  CLOSE_VOTE: ADMIN_ROLE_IDS,

  CREATE_LOTTERY: ADMIN_ROLE_IDS,
  DRAW_LOTTERY: ADMIN_ROLE_IDS,

  CREATE_CHALLENGE: ADMIN_ROLE_IDS,
  JUDGE_CHALLENGE: ADMIN_ROLE_IDS,

  HANDLE_SUGGESTION: ADMIN_ROLE_IDS,

  MANAGE_ALBUM: ADMIN_ROLE_IDS,
  APPROVE_PHOTO: ADMIN_ROLE_IDS,

  UPLOAD_RESOURCE: ADMIN_ROLE_IDS,

  MANAGE_POINTS: ADMIN_ROLE_IDS,

  VIEW_ROSTER: ADMIN_ROLE_IDS,
  VIEW_COMPANY: ADMIN_ROLE_IDS,

  MANAGE_MEMBER_ROLE: [ROLES.SUPER_ADMIN],
  MANAGE_LEAVE_CONFIG: [ROLES.SUPER_ADMIN],

  // 微信机器人身份（系统级，仅超管）：扫码登录 / 查看连接状态
  MANAGE_CHANNEL: [ROLES.SUPER_ADMIN]
});

const PERMISSION_KEYS = Object.keys(PERMISSIONS);

/** 是否具备某权限（未登录/未知权限一律拒绝） */
function hasPermission(user, perm) {
  if (user == null) return false;
  const allowed = PERMISSIONS[perm];
  if (!allowed) return false;
  return allowed.includes(Number(user.role));
}

/**
 * 路由中间件：要求指定权限（必须放在 authenticateToken 之后）
 */
function requirePermission(perm) {
  return function permissionGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未提供认证令牌', code: 'UNAUTHORIZED' });
    }
    if (!hasPermission(req.user, perm)) {
      return res.status(403).json({ success: false, error: '权限不足', code: 'FORBIDDEN' });
    }
    return next();
  };
}

module.exports = { PERMISSIONS, PERMISSION_KEYS, hasPermission, requirePermission };
