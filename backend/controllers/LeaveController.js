const LeaveService = require('../services/leaveService');
const { asyncHandler, ok } = require('../shared/http');

/**
 * 请假 HTTP 适配层（P2：业务规则已下沉到 services/leaveService.js）
 */
class LeaveController {
  static applyLeave = asyncHandler(async (req, res) => {
    const { id } = await LeaveService.apply(req.user, req.body || {});
    return ok(res, { id }, { message: '请假申请提交成功' });
  });

  static getMyLeaves = asyncHandler(async (req, res) => {
    const leaves = await LeaveService.listMine(req.user);
    return ok(res, undefined, { leaves });
  });

  static getAllLeaves = asyncHandler(async (req, res) => {
    const leaves = await LeaveService.listAll(req.user);
    return ok(res, undefined, { leaves });
  });

  static getLeaveById = asyncHandler(async (req, res) => {
    const leave = await LeaveService.detail(req.user, req.params.id);
    return ok(res, undefined, { leave });
  });

  static approveLeave = asyncHandler(async (req, res) => {
    const { id, status, approval_notes } = req.body || {};
    await LeaveService.approve(req.user, { id, status, approval_notes });
    return ok(res, undefined, { message: '审批成功' });
  });

  static cancelLeave = asyncHandler(async (req, res) => {
    await LeaveService.cancel(req.user, req.params.id);
    return ok(res, undefined, { message: '销假成功' });
  });

  static getLeaveTypes = asyncHandler(async (req, res) => {
    const configs = await LeaveService.listTypes();
    return ok(res, configs);
  });

  static uploadProof = asyncHandler(async (req, res) => {
    const payload = LeaveService.proofUrl(req.file);
    return ok(res, undefined, payload);
  });
}

module.exports = LeaveController;
