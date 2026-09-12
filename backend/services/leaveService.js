const Leave = require('../models/Leave');
const LeaveConfig = require('../models/LeaveConfig');
const Company = require('../models/Company');
const { isAdmin } = require('../shared/constants');
const { resolveScope, canAccessOwnClassRecord } = require('../shared/scope');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../shared/http');

/** 允许的最大请假时长（天）；防止 2099 年这种超长区间把出勤口径彻底带偏 */
const MAX_LEAVE_DAYS = 30;
/** 时间串解析：支持 'YYYY-MM-DD HH:mm:ss' / 'YYYY-MM-DDTHH:mm:ss(.sssZ)?' */
function parseTime(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().replace('T', ' ').replace(/\.[0-9]+Z?$/, '').replace(/Z$/, '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2})?:?(\d{2})?:?(\d{2})?$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  return Number.isNaN(d.getTime()) ? null : d;
}
function hhmmss(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/**
 * 请假域服务（业务规则 + 作用域校验）
 *
 * 审计修复要点：
 * - 时段校验原来只比 'HH:MM:SS' 字符串：反向区间（start>end）、跨年超长区间都能入库；
 *   自由类型（is_fixed=false）零校验；现在统一按真实时间校验 开始<结束、结束>现在、时长上限；
 * - 审批缺状态机：可重复审批、可审批已销假/已驳回的记录；现在用条件更新保证幂等；
 * - 干部可审批自己的请假（无回避）；现在显式拒绝；
 * - 读列表时不再批量 autoCancel（它会把「未销假」统计永远清成 0，并伪造 cancelled_time）。
 */
class LeaveService {
  /** 提交请假：校验类型/时段/时长，并强制 user_id 为本人 */
  static async apply(user, payload) {
    const { type, start_time, end_time } = payload || {};
    if (!type) throw new BadRequestError('请选择请假类型');

    const config = await LeaveConfig.findByType(type);
    if (!config) throw new BadRequestError('无效的请假类型：' + type);
    if (!config.enabled) throw new BadRequestError('请假类型"' + type + '"已被管理员禁用');

    if (!start_time || !end_time) throw new BadRequestError('请选择开始与结束时间');
    const start = parseTime(start_time);
    const end = parseTime(end_time);
    if (!start || !end) throw new BadRequestError('时间格式不正确');
    if (start.getTime() >= end.getTime()) throw new BadRequestError('结束时间必须晚于开始时间');
    if (end.getTime() <= Date.now()) throw new BadRequestError('结束时间不能早于当前时间');
    const durationDays = (end.getTime() - start.getTime()) / 86400000;
    if (durationDays > MAX_LEAVE_DAYS) throw new BadRequestError('单次请假不超过 ' + MAX_LEAVE_DAYS + ' 天');

    if (config.is_fixed && config.start_time && config.end_time) {
      const cfgStart = String(config.start_time);
      const cfgEnd = String(config.end_time);
      const s = hhmmss(start);
      const e = hhmmss(end);
      if (s < cfgStart || e > cfgEnd || start.toDateString() !== end.toDateString()) {
        throw new BadRequestError('"' + type + '"的允许时段为 ' + cfgStart.substring(0, 5) + '-' + cfgEnd.substring(0, 5) + '，且需在同一天内');
      }
    }

    // 只信任 type；忽略 leave_type（历史上双字段可造成统计污染）
    const { user_id: _ignoredUserId, id: _ignoredId, leave_type: _ignoredLeaveType, ...safeLeave } = payload || {};
    const id = await Leave.create({ user_id: user.id, ...safeLeave, type });
    return { id };
  }

  /**
   * 我的请假列表
   * @param {object} user
   * @param {{paged:boolean, limit:number, offset:number}|null} [paging]
   *   不传 / paged=false → 返回数组（与分页前完全一致，旧客户端不受影响）；
   *   传了 paged=true → 返回 { rows, total }。
   */
  static async listMine(user, paging = null) {
    // 审计修复：不再在读取时批量 autoCancel（会把「未销假」永远算成 0 并伪造销假时间）
    if (!paging || !paging.paged) return Leave.findByUserId(user.id);
    return Leave.findByUserIdPaged(user.id, { limit: paging.limit, offset: paging.offset });
  }

  /**
   * 管理员列表：超管/辅导员全部；区队管理层平行查看本中队；否则本区队
   * @param {object} user
   * @param {{paged:boolean, limit:number, offset:number}|null} [paging] 同上：分页时返回 { rows, total }
   */
  static async listAll(user, paging = null) {
    const scope = await resolveScope(user);
    const role = Number(user.role);
    const paged = !!(paging && paging.paged);
    const pageOpts = paged ? { limit: paging.limit, offset: paging.offset } : null;
    if (role >= 8) {
      return paged ? Leave.getAllWithApplicantsPaged(pageOpts) : Leave.getAllWithApplicants();
    }
    if (scope.canViewCompany) {
      if (scope.companyId) {
        return paged ? Leave.getAllByCompanyPaged(scope.companyId, pageOpts) : Leave.getAllByCompany(scope.companyId);
      }
      if (scope.classIds && scope.classIds.length) {
        return paged ? Leave.getAllByClassesPaged(scope.classIds, pageOpts) : Leave.getAllByClasses(scope.classIds);
      }
      return paged ? { rows: [], total: 0 } : [];
    }
    if (scope.classIds && scope.classIds.length) {
      return paged ? Leave.getAllByClassesPaged(scope.classIds, pageOpts) : Leave.getAllByClasses(scope.classIds);
    }
    return paged ? { rows: [], total: 0 } : [];
  }

  static async detail(user, rawId) {
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) throw new BadRequestError('无效的请假 ID');

    const leave = await Leave.findByIdWithApplicant(id);
    if (!leave) throw new NotFoundError('请假记录不存在');

    const isOwner = Number(leave.user_id) === Number(user.id);
    if (isOwner) return leave;
    if (!isAdmin(user)) throw new ForbiddenError('无权查看该请假记录');

    const role = Number(user.role);
    if (role >= 8) return leave;

    const scope = await resolveScope(user);
    const info = await Leave.getScopeInfo(id);
    let allowed = false;
    if (info) {
      if (scope.classIds && scope.classIds.includes(info.class_id)) allowed = true;
      if (!allowed && scope.canViewCompany && scope.companyId && info.class_id) {
        const classCompany = await Company.findCompanyIdByClassId(info.class_id);
        if (classCompany === scope.companyId) allowed = true;
      }
    }
    if (!allowed) throw new ForbiddenError('无权查看该请假记录');
    return leave;
  }

  /**
   * 审批：区队管理层仅限本区队；超管/辅导员不限；**不能审批自己的请假**；
   * 只有 status=0 且未撤销的记录才能被审批（幂等）。
   */
  static async approve(user, { id, status, approval_notes }) {
    const leaveId = parseInt(id, 10);
    if (Number.isNaN(leaveId)) throw new BadRequestError('无效的请假 ID');
    const finalStatus = Number(status);
    if ([1, 2].indexOf(finalStatus) === -1) throw new BadRequestError('审批结果只能是 通过(1) 或 驳回(2)');

    const info = await Leave.getScopeInfo(leaveId);
    if (!info) throw new NotFoundError('请假记录不存在');
    if (Number(info.user_id) === Number(user.id)) throw new ForbiddenError('不能审批自己的请假');

    const role = Number(user.role);
    if (role < 8) {
      const scope = await resolveScope(user);
      if (!scope.classIds || !scope.classIds.includes(info.class_id)) {
        throw new ForbiddenError('只能审批本区队的请假');
      }
    }
    const success = await Leave.updateStatus(leaveId, finalStatus, user.id, approval_notes);
    if (!success) throw new BadRequestError('该请假已被处理或已撤销，请刷新后重试');
    return true;
  }

  /** 销假：本人，或本区队/中队的干部（管理员销假给学员用） */
  static async cancel(user, rawId) {
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) throw new BadRequestError('无效的请假 ID');
    const leave = await Leave.findById(id);
    if (!leave) throw new NotFoundError('请假记录不存在');

    const isOwner = Number(leave.user_id) === Number(user.id);
    if (!isOwner) {
      if (!isAdmin(user)) throw new ForbiddenError('权限不足');
      const scope = await resolveScope(user);
      const info = await Leave.getScopeInfo(id);
      const inScope = info && Array.isArray(scope.classIds) && scope.classIds.includes(info.class_id);
      const isSuper = Number(user.role) >= 8;
      if (!isSuper && !inScope) throw new ForbiddenError('只能为本区队成员销假');
    }
    // 待审批的请假属于「撤回」，用独立状态 3，避免出现 status=0 且 is_cancelled=1 的幽灵待审批
    if (Number(leave.status) === 0) {
      const okWithdraw = await Leave.withdraw(id, leave.user_id, new Date());
      if (!okWithdraw) throw new BadRequestError('该请假已处理或已撤销');
      return true;
    }
    const success = await Leave.cancel(id, new Date());
    if (!success) throw new BadRequestError('该请假已销假或已撤销');
    return true;
  }

  static async listTypes() {
    return LeaveConfig.getEnabled();
  }

  static proofUrl(file) {
    if (!file) throw new BadRequestError('请选择图片');
    return { url: '/uploads/leaves/' + file.filename, filename: file.originalname, size: file.size };
  }
}

module.exports = LeaveService;
// 供单元测试使用（纯函数）
module.exports._internals = { parseTime, hhmmss, MAX_LEAVE_DAYS };
