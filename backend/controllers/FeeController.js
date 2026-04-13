const Fee = require('../models/Fee');

class FeeController {
  static async createExpense(req, res) {
    try {
      const expenseId = await Fee.createExpense({
        user_id: req.user.id,
        ...req.body
      });
      
      res.json({ success: true, expenseId, message: '班费记录提交成功' });
    } catch (error) {
      console.error('班费记录提交失败:', error);
      res.status(500).json({ success: false, error: '班费记录提交失败' });
    }
  }

  static async getMyExpenses(req, res) {
    try {
      const expenses = await Fee.getExpensesByUserId(req.user.id);
      res.json({ success: true, expenses });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取班费记录失败' });
    }
  }

  static async getAllExpenses(req, res) {
    try {
      const expenses = await Fee.getAllExpenses();
      res.json({ success: true, expenses });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取班费记录失败' });
    }
  }

  static async approveExpense(req, res) {
    try {
      const { id, status, approval_notes } = req.body;
      
      const success = await Fee.updateExpenseStatus(
        id,
        status,
        req.user.id,
        approval_notes
      );
      
      if (success) {
        res.json({ success: true, message: '审批成功' });
      } else {
        res.status(404).json({ success: false, error: '班费记录不存在' });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: '审批失败' });
    }
  }

  static async getBalance(req, res) {
    try {
      const balance = await Fee.getBalance();
      res.json({ success: true, balance });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取余额失败' });
    }
  }
}

module.exports = FeeController;