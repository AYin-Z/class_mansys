const Leave = require('../models/Leave');
const { isAdmin } = require('../shared/constants');

class LeaveController {
  static async applyLeave(req, res) {
    try {
      const leaveId = await Leave.create({
        user_id: req.user.id,
        ...req.body
      });
      
      res.json({ success: true, leaveId, message: '请假申请提交成功' });
    } catch (error) {
      console.error('请假申请失败:', error);
      res.status(500).json({ success: false, error: '请假申请失败' });
    }
  }

  static async getMyLeaves(req, res) {
    try {
      const leaves = await Leave.findByUserId(req.user.id);
      res.json({ success: true, leaves });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取请假记录失败' });
    }
  }

  static async getAllLeaves(req, res) {
    try {
      const leaves = await Leave.getAllWithApplicants();
      res.json({ success: true, leaves });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取请假记录失败' });
    }
  }

  static async getLeaveById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: '无效的请假 ID' });
      }
      const leave = await Leave.findByIdWithApplicant(id);
      if (!leave) {
        return res.status(404).json({ success: false, error: '请假记录不存在' });
      }
      const isOwner = Number(leave.user_id) === Number(req.user.id);
      if (!isOwner && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权查看该请假记录' });
      }
      res.json({ success: true, leave });
    } catch (error) {
      console.error('获取请假详情失败:', error);
      res.status(500).json({ success: false, error: '获取请假详情失败' });
    }
  }

  static async approveLeave(req, res) {
    try {
      const { id, status, approval_notes } = req.body;
      
      const success = await Leave.updateStatus(
        id,
        status,
        req.user.id,
        approval_notes
      );
      
      if (success) {
        res.json({ success: true, message: '审批成功' });
      } else {
        res.status(404).json({ success: false, error: '请假记录不存在' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: '审批失败' });
    }
  }

  static async cancelLeave(req, res) {
    try {
      const { id } = req.params;
      const leave = await Leave.findById(id);
      
      if (!leave) {
        return res.status(404).json({ success: false, error: '请假记录不存在' });
      }
      
      // 只能取消自己的请假
      if (Number(leave.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ success: false, error: '权限不足' });
      }
      
      const success = await Leave.cancel(id, new Date());
      if (success) {
        res.json({ success: true, message: '销假成功' });
      } else {
        res.status(404).json({ success: false, error: '请假记录不存在' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: '销假失败' });
    }
  }
}

module.exports = LeaveController;