const Leave = require('../models/Leave');

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
      const leaves = await Leave.getAll();
      res.json({ success: true, leaves });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取请假记录失败' });
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
      if (leave.user_id != req.user.id) {
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