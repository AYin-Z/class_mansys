const db = require('../config/database');

// 投票通过所需同意票数（即班级总人数的 2/3 取整）
// TODO: 如需动态配置可从班级人数表查询：SELECT COUNT(*) FROM users WHERE role = 0
const VOTE_THRESHOLD = 19;

class ExpenseApproval {
  // 创建审批链：根据金额自动决定步骤数
  static async createChain(expenseId, amount) {
    const steps = this.determineSteps(amount);
    for (const step of steps) {
      await db.query(
        'INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, ?, ?, 0)',
        [expenseId, step.step, step.role]
      );
    }
  }

  static determineSteps(amount) {
    if (amount <= 100) {
      // ≤100元: 仅区队长审批
      return [{ step: 1, role: 1 }];
    } else if (amount <= 500) {
      // 100-500元: 区队长初审 → 辅导员终审
      return [{ step: 1, role: 1 }, { step: 2, role: 9 }];
    } else {
      // >500元: 区队长初审 → 辅导员复核 → 匿名投票≥19票
      return [{ step: 1, role: 1 }, { step: 2, role: 9 }, { step: 3, role: null }];
    }
  }

  // 区队长审批（step 1）
  static async approveByLeader(expenseId, approverId, notes) {
    const [result] = await db.query(
      'UPDATE expense_approvals SET status = 1, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = 1 AND status = 0',
      [approverId, notes, expenseId]
    );
    if (result.affectedRows === 0) return false;

    // 更新 expenses 表的审批进度
    const expense = await this.getExpenseInfo(expenseId);
    if (!expense) return false;

    const steps = this.determineSteps(expense.amount);
    if (steps.length === 1) {
      // 单步审批：直接完成
      await db.query('UPDATE expenses SET approval_step = -1, status = 1, approver_id = ?, approval_time = NOW() WHERE id = ?', [approverId, expenseId]);
    } else {
      // 进入下一步
      const nextStep = steps[1].step;
      await db.query('UPDATE expenses SET approval_step = ? WHERE id = ?', [nextStep, expenseId]);
    }
    return true;
  }

  // 辅导员审批（step 2）
  static async approveByAdvisor(expenseId, approverId, notes) {
    const [result] = await db.query(
      'UPDATE expense_approvals SET status = 1, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = 2 AND status = 0',
      [approverId, notes, expenseId]
    );
    if (result.affectedRows === 0) return false;

    await db.query('UPDATE expenses SET approval_step = -1, status = 1, approver_id = ?, approval_time = NOW() WHERE id = ?', [approverId, expenseId]);
    return true;
  }

  // 用户投票（step 3 大额审批）
  static async castVote(expenseId, userId, vote) {
    try {
      await db.query(
        'INSERT INTO expense_approval_votes (expense_id, user_id, vote) VALUES (?, ?, ?)',
        [expenseId, userId, vote]
      );
      // 检查投票是否达到门槛（≥VOTE_THRESHOLD 票同意）
      const [countRows] = await db.query(
        'SELECT COUNT(*) as approve_count FROM expense_approval_votes WHERE expense_id = ? AND vote = 1',
        [expenseId]
      );
      if (countRows[0].approve_count >= VOTE_THRESHOLD) {
        await db.query('UPDATE expense_approvals SET status = 1, updated_at = NOW() WHERE expense_id = ? AND step = 3', [expenseId]);
        await db.query('UPDATE expenses SET approval_step = -1, status = 1, approval_time = NOW() WHERE id = ?', [expenseId]);
      }
      return { success: true, approveCount: countRows[0].approve_count, thresholdMet: countRows[0].approve_count >= VOTE_THRESHOLD };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { success: false, error: '您已投过票' };
      }
      throw err;
    }
  }

  // 获取审批链状态
  static async getChain(expenseId) {
    const [rows] = await db.query(
      `SELECT ea.*, u.name as approver_name
      FROM expense_approvals ea
      LEFT JOIN users u ON ea.approver_id = u.id
      WHERE ea.expense_id = ?
      ORDER BY ea.step`,
      [expenseId]
    );
    return rows;
  }

  // 获取投票结果
  static async getVoteResult(expenseId) {
    const [approveRows] = await db.query(
      'SELECT COUNT(*) as count FROM expense_approval_votes WHERE expense_id = ? AND vote = 1',
      [expenseId]
    );
    const [rejectRows] = await db.query(
      'SELECT COUNT(*) as count FROM expense_approval_votes WHERE expense_id = ? AND vote = 2',
      [expenseId]
    );
    const [totalRows] = await db.query(
      'SELECT COUNT(*) as count FROM expense_approval_votes WHERE expense_id = ?',
      [expenseId]
    );
    return {
      approveCount: approveRows[0].count,
      rejectCount: rejectRows[0].count,
      totalVotes: totalRows[0].count,
      thresholdMet: approveRows[0].count >= VOTE_THRESHOLD
    };
  }

  // 获取待审批列表
  static async getPendingApprovals(role) {
    const isAdmin = role === 8; // 超级管理员能看到所有待审批
    const [rows] = await db.query(
      `SELECT e.*, u.name as applicant_name, ea.step,
        (SELECT COUNT(*) FROM expense_approval_votes WHERE expense_id = e.id AND vote = 1) as vote_approve
      FROM expenses e
      JOIN expense_approvals ea ON e.id = ea.expense_id AND ea.status = 0
      LEFT JOIN users u ON e.user_id = u.id
      WHERE (ea.step = 1 AND (? = 1 OR ? = 8))  -- 区队长或管理员可审
         OR (ea.step = 2 AND ? = 9)  -- 辅导员审批
         OR (ea.step = 3)  -- 投票阶段
      ORDER BY e.created_at DESC`,
      [role, role, role]
    );
    return rows;
  }

  // 驳回（任意步骤）
  static async reject(expenseId, step, approverId, notes) {
    const [result] = await db.query(
      'UPDATE expense_approvals SET status = 2, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = ? AND status = 0',
      [approverId, notes, expenseId, step]
    );
    if (result.affectedRows === 0) return false;
    await db.query('UPDATE expenses SET status = 2, approval_notes = ? WHERE id = ?', [notes, expenseId]);
    return true;
  }

  static async getExpenseInfo(expenseId) {
    const [rows] = await db.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    return rows[0];
  }
}

module.exports = ExpenseApproval;
