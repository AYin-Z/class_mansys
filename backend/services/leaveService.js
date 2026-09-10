const Leave = require('../models/Leave');
const LeaveConfig = require('../models/LeaveConfig');
const Company = require('../models/Company');
const { isAdmin } = require('../shared/constants');
const { resolveScope } = require('../shared/scope');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../shared/http');

/**
 * 请假域服务（P2 分层）
 * 承载业务规则与作用域校验；控制器只负责 HTTP 契约。
 */
class LeaveService {
  /** 提交请假：校验请假类型/固定时段窗口，并强制 user_id 为本人 */
  static async apply(user, payload) {
    const { type, start_time, end_time } = payload || {};
    if (!type) throw new BadRequestError('请选择请假类型');

    const config = await LeaveConfig.findByType(type);
    if (!config) throw new BadRequestError('无效的请假类型：' + type);
    if (!config.enabled) throw new BadRequestError('请假类型"' + type + '"已被管理员禁用');

    if (config.is_fixed && config.start_time && config.end_time) {
      if (!start_time || !end_time) throw new BadRequestError('固定时段请假需要提供起止时间');
      const cfgStart = String(config.start_time);
      const cfgEnd = String(config.end_time);
      const leaveStart = String(start_time).slice(-8);
      const leaveEnd = String(end_time).slice(-8);
      if (leaveStart < cfgStart || leaveEnd > cfgEnd) {
        throw new BadRequestError('"' + type + '"的允许时段为 ' + cfgStart.substring(0, 5) + '-' + cfgEnd.substring(0, 5) + '，请在此范围内请假');
      }
    }

    const { user_id: _ignoredUserId, id: _ignoredId, ...safeLeave } = payload || {};
    const id = await Leave.create({ user_id: user.id, ...safeLeave });
    return { id };
  }

  static async listMine(user) {
    await Leave.autoCancelExpired();
    return Leave.findByUserId(user.id);
  }

  /** 管理员列表：超管/辅导员全部；区队管理层平行查看本中队；否则本区队 */
  static async listAll(user) {
    await Leave.autoCancelExpired();
    const scope = await resolveScope(user);
    const role = Number(user.role);
    if (role >= 8) return Leave.getAllWithApplicants();
    if (scope.canViewCompany) {
      if (scope.companyId) return Leave.getAllByCompany(scope.companyId);
      if (scope.classIds && scope.classIds.length) return Leave.getAllByClasses(scope.classIds);
      return [];
    }
    if (scope.classIds && scope.classIds.length) return Leave.getAllByClasses(scope.classIds);
    return [];
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

  /** 审批：区队管理层仅限本区队；超管/辅导员不限 */
  static async approve(user, { id, status, approval_notes }) {
    const role = Number(user.role);
    if (role < 8) {
      const scope = await resolveScope(user);
      const info = await Leave.getScopeInfo(id);
      if (!info || !scope.classIds || !scope.classIds.includes(info.class_id)) {
        throw new ForbiddenError('只能审批本区队的请假');
      }
    }
    const success = await Leave.updateStatus(id, status, user.id, approval_notes);
    if (!success) throw new NotFoundError('请假记录不存在');
    return true;
  }

  /** 销假：仅本人 */
  static async cancel(user, rawId) {
    const id = parseInt(rawId, 10);
    const leave = await Leave.findById(id);
    if (!leave) throw new NotFoundError('请假记录不存在');
    if (Number(leave.user_id) !== Number(user.id)) throw new ForbiddenError('权限不足');
    const success = await Leave.cancel(id, new Date());
    if (!success) throw new NotFoundError('请假记录不存在');
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
