const { ROLES, ADMIN_ROLE_IDS } = require('./constants');

/**
 * 权限矩阵（唯一权威来源）
 *
 * 设计：
 * - PERMISSIONS 是**默认矩阵**（代码内兜底，保证任何情况下系统可用）；
 * - 运行时以数据库表 role_permissions 为准（超管后台可配置），启动时加载进内存缓存，
 *   修改后立即刷新，因此 requirePermission 仍是同步判断、零查询开销；
 * - 若表不存在/为空（例如刚部署），自动回落到默认矩阵。
 */
const PERMISSIONS = Object.freeze({
  ACCESS_DASHBOARD: ADMIN_ROLE_IDS,

  PUBLISH_NOTICE: ADMIN_ROLE_IDS,
  /**
   * 发布**全中队**通知（class_id = NULL，全体可见）。
   *
   * 默认不给所有干部：通知的可见范围由作者作用域决定（区队干部 → 本区队），
   * 放开成"人人可发全中队"意味着任何人都能向 215 人推送，风险和骚扰面都太大。
   * 所以只给：团支书（团的工作面向全中队）、宣传委员（宣传）、超管、辅导员。
   * 其他人想发全中队，由超管在权限矩阵里单独授予。
   */
  PUBLISH_NOTICE_COMPANY: [ROLES.LEAGUE_SECRETARY, ROLES.PUBLICITY_COMMITTEE, ROLES.SUPER_ADMIN, ROLES.COUNSELOR],
  MANAGE_NOTICE: ADMIN_ROLE_IDS,

  PUBLISH_ANNOUNCEMENT: [ROLES.CLASS_LEADER, ROLES.SUPER_ADMIN],
  MANAGE_ANNOUNCEMENT: ADMIN_ROLE_IDS,

  APPROVE_LEAVE: ADMIN_ROLE_IDS,

  COLLECT_FEE: ADMIN_ROLE_IDS,
  BOOKKEEP_FEE: ADMIN_ROLE_IDS,
  APPROVE_FEE_USE: ADMIN_ROLE_IDS,

  PUBLISH_HOMEWORK: ADMIN_ROLE_IDS,
  GRADE_HOMEWORK: ADMIN_ROLE_IDS,

  HANDLE_PSYCHOLOGICAL: ADMIN_ROLE_IDS,

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

  // 微信机器人身份（系统级）：扫码登录 / 查看连接状态
  MANAGE_CHANNEL: [ROLES.SUPER_ADMIN],

  // 权限矩阵本身（系统级）；为避免把自己锁死，超管对该键始终有效
  MANAGE_PERMISSIONS: [ROLES.SUPER_ADMIN],

  // 超管后台：成员增删改/重置密码/名册导入/区队管理
  MANAGE_MEMBERS: [ROLES.SUPER_ADMIN],

  // 超管后台：审计日志 / 系统状态 / 备份 / 数据导出
  VIEW_SYSTEM: [ROLES.SUPER_ADMIN]
});

const PERMISSION_KEYS = Object.keys(PERMISSIONS);

/** 权限键中文说明（后台展示用） */
const PERMISSION_LABELS = {
  ACCESS_DASHBOARD: '访问管理仪表盘',
  PUBLISH_NOTICE: '发布通知',
  PUBLISH_NOTICE_COMPANY: '发布全中队通知',
  MANAGE_NOTICE: '管理通知',
  PUBLISH_ANNOUNCEMENT: '发布公告',
  MANAGE_ANNOUNCEMENT: '管理公告',
  APPROVE_LEAVE: '审批请假',
  COLLECT_FEE: '发起班费收缴',
  BOOKKEEP_FEE: '班费记账',
  APPROVE_FEE_USE: '审批班费使用',
  PUBLISH_HOMEWORK: '发布作业',
  GRADE_HOMEWORK: '批改作业',
  HANDLE_PSYCHOLOGICAL: '处理心理申请',
  CREATE_VOTE: '发起投票',
  CLOSE_VOTE: '结束投票',
  CREATE_LOTTERY: '发起抽奖',
  DRAW_LOTTERY: '抽奖开奖',
  CREATE_CHALLENGE: '发起擂台',
  JUDGE_CHALLENGE: '判定擂台',
  HANDLE_SUGGESTION: '处理建议',
  MANAGE_ALBUM: '管理相册',
  APPROVE_PHOTO: '审核照片',
  UPLOAD_RESOURCE: '上传资源',
  MANAGE_POINTS: '管理积分',
  VIEW_ROSTER: '查看名册',
  VIEW_COMPANY: '查看中队情况',
  MANAGE_MEMBER_ROLE: '调整成员职务',
  MANAGE_LEAVE_CONFIG: '配置请假类型',
  MANAGE_CHANNEL: '连接微信机器人',
  MANAGE_PERMISSIONS: '配置权限矩阵',
  MANAGE_MEMBERS: '管理成员与区队',
  VIEW_SYSTEM: '查看系统与审计'
};

/** 运行时生效矩阵（null = 使用默认） */
let effectiveMatrix = null;

function normalizeMatrix(raw) {
  if (!raw) return null;
  const out = {};
  for (const key of PERMISSION_KEYS) {
    const roles = raw[key];
    out[key] = Array.isArray(roles) ? Array.from(new Set(roles.map(Number).filter((r) => !Number.isNaN(r)))) : [];
  }
  // 超管对 MANAGE_PERMISSIONS 永远有效，避免把自己锁在门外
  if (out.MANAGE_PERMISSIONS.indexOf(ROLES.SUPER_ADMIN) === -1) out.MANAGE_PERMISSIONS.push(ROLES.SUPER_ADMIN);
  return out;
}

function setEffectiveMatrix(matrix) {
  effectiveMatrix = normalizeMatrix(matrix);
  return effectiveMatrix;
}

/** 当前生效矩阵（DB 配置优先，否则默认） */
function currentMatrix() {
  return effectiveMatrix || PERMISSIONS;
}

/** 从数据库加载（启动时调用；失败保持默认矩阵） */
async function loadPermissions() {
  try {
    const db = require('../config/database');
    const [rows] = await db.query('SELECT permission, role FROM role_permissions');
    if (!rows.length) return false;
    const matrix = {};
    for (const key of PERMISSION_KEYS) matrix[key] = [];
    for (const row of rows) {
      if (matrix[row.permission]) matrix[row.permission].push(Number(row.role));
    }
    setEffectiveMatrix(matrix);
    return true;
  } catch (e) {
    return false;
  }
}

/** 写入某权限允许的角色集合，并刷新缓存 */
async function updatePermission(permission, roles, operatorRole) {
  if (PERMISSION_KEYS.indexOf(permission) === -1) throw new Error('未知权限键: ' + permission);
  const db = require('../config/database');
  const next = Array.from(new Set(roles.map(Number).filter((r) => !Number.isNaN(r)))).sort((a, b) => a - b);
  if (permission === 'MANAGE_PERMISSIONS' && next.indexOf(ROLES.SUPER_ADMIN) === -1) {
    throw new Error('不能移除超管对「配置权限矩阵」的权限（会导致无人可配置）');
  }
  if (operatorRole !== undefined && Number(operatorRole) !== ROLES.SUPER_ADMIN) {
    throw new Error('仅系统管理员可修改权限矩阵');
  }
  await db.query('DELETE FROM role_permissions WHERE permission = ?', [permission]);
  for (const role of next) {
    await db.query('INSERT INTO role_permissions (permission, role) VALUES (?, ?)', [permission, role]);
  }
  await loadPermissions();
  return currentMatrix()[permission];
}

/** 把默认矩阵写入数据库（首次使用/表为空时调用） */
async function seedPermissionsFromDefaults() {
  const db = require('../config/database');
  const [rows] = await db.query('SELECT COUNT(*) AS c FROM role_permissions');
  if (rows[0].c > 0) return false;
  for (const key of PERMISSION_KEYS) {
    for (const role of PERMISSIONS[key]) {
      await db.query('INSERT IGNORE INTO role_permissions (permission, role) VALUES (?, ?)', [key, role]);
    }
  }
  await loadPermissions();
  return true;
}

/** 某角色的权限快照（前端水合权限用） */
function permissionsFor(role) {
  const out = {};
  const matrix = currentMatrix();
  for (const key of PERMISSION_KEYS) {
    out[key] = (matrix[key] || []).indexOf(Number(role)) > -1;
  }
  return out;
}

/** 是否具备某权限（未登录/未知权限一律拒绝） */
function hasPermission(user, perm) {
  if (user == null) return false;
  const allowed = currentMatrix()[perm];
  if (!allowed) return false;
  return allowed.indexOf(Number(user.role)) > -1;
}

/** 路由中间件：要求指定权限（必须放在 authenticateToken 之后） */
function requirePermission(perm) {
  const guard = function permissionGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未提供认证令牌', code: 'UNAUTHORIZED' });
    }
    if (!hasPermission(req.user, perm)) {
      return res.status(403).json({ success: false, error: '权限不足', code: 'FORBIDDEN' });
    }
    return next();
  };
  // 打标记：供工具目录（services/agent/toolCatalog）按角色裁剪工具表。
  // 必须在这里标记而不是另建映射表——否则路由改了权限、工具表不会跟着变，两边必然漂移。
  guard.__permission = perm;
  return guard;
}

module.exports = {
  PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  hasPermission,
  requirePermission,
  loadPermissions,
  setEffectiveMatrix,
  currentMatrix,
  updatePermission,
  seedPermissionsFromDefaults,
  permissionsFor
};
