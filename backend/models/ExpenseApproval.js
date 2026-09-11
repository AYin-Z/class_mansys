const db = require('../config/database');

/**
 * 报销审批链
 *
 * 审计修复要点：
 * - 投票门槛改为「本区队在编学员数 × 2/3」（原实现用 COUNT(*) FROM users，多区队部署下 >500 元报销永远无法通过）；
 * - getPendingApprovals 带区队作用域，并过滤掉已驳回/已完成的报销（原实现产生幽灵待办）；
 * - 驳回时把后续节点一并终止，避免已驳回申请长期挂在他人待办里；
 * - 审批节点流转与 expenses 状态更新放在同一事务里；
 * - createChain 支持传入连接（与建单同事务）。
 */
/**
 * 大额报销投票门槛（依据《25Q6 班费收缴与管理方案【草案1】》）
 *
 * PRD 原文：> 500 元 → 经办人提交详细预算方案 → 班长和班主任审核 → **匿名问卷投票，获得全班 19 票以上同意** → 方可使用并报销。
 * 因此：阈值 = 19 票；当本区队在编学员不足 19 人时取全班人数（否则永远无法达标）。
 */
const PRD_VOTE_THRESHOLD = 19;
async function getVoteThreshold(classId) {
  try {
    const sql = classId
      ? "SELECT COUNT(*) AS cnt FROM users WHERE class_id = ? AND member_type = 'student'"
      : "SELECT COUNT(*) AS cnt FROM users WHERE member_type = 'student'";
    const params = classId ? [classId] : [];
    const [[{ cnt }]] = await db.query(sql, params);
    const roster = Number(cnt || 0);
    if (!roster) return PRD_VOTE_THRESHOLD;
    return Math.max(1, Math.min(PRD_VOTE_THRESHOLD, roster));
  } catch (e) {
    return PRD_VOTE_THRESHOLD;
  }
}

class ExpenseApproval {
  // 创建审批链：根据金额自动决定步骤数
  static async createChain(expenseId, amount, conn) {
    const steps = this.determineSteps(amount);
    const runner = conn || db;
    for (const step of steps) {
      await runner.query(
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
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'UPDATE expense_approvals SET status = 1, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = 1 AND status = 0',
        [approverId, notes, expenseId]
      );
      if (result.affectedRows === 0) { await conn.rollback(); return false; }
      const expense = await this.getExpenseInfo(expenseId, conn);
      if (!expense) { await conn.rollback(); return false; }
      const steps = this.determineSteps(expense.amount);
      if (steps.length === 1) {
        await conn.query('UPDATE expenses SET approval_step = -1, status = 1, approver_id = ?, approval_time = NOW() WHERE id = ? AND status = 0', [approverId, expenseId]);
      } else {
        await conn.query('UPDATE expenses SET approval_step = ? WHERE id = ? AND status = 0', [steps[1].step, expenseId]);
      }
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // 辅导员审批（step 2）
  static async approveByAdvisor(expenseId, approverId, notes) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'UPDATE expense_approvals SET status = 1, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = 2 AND status = 0',
        [approverId, notes, expenseId]
      );
      if (result.affectedRows === 0) { await conn.rollback(); return false; }
      const expense = await this.getExpenseInfo(expenseId, conn);
      if (!expense) { await conn.rollback(); return false; }
      const steps = this.determineSteps(expense.amount);
      if (steps.length > 2) {
        await conn.query('UPDATE expenses SET approval_step = 3 WHERE id = ? AND status = 0', [expenseId]);
      } else {
        await conn.query('UPDATE expenses SET approval_step = -1, status = 1, approver_id = ?, approval_time = NOW() WHERE id = ? AND status = 0', [approverId, expenseId]);
      }
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // 用户投票（step 3 大额审批）
  static async castVote(expenseId, userId, vote) {
    try {
      const expense = await this.getExpenseInfo(expenseId);
      if (!expense) {
        return { success: false, error: '记录不存在' };
      }
      if (Number(expense.user_id) === Number(userId)) {
        return { success: false, error: '申请人不能参与本人费用投票' };
      }
      if (expense.approval_step !== 3 || expense.status !== 0) {
        return { success: false, error: '当前费用不在投票阶段' };
      }
      // 门槛按「本区队在编学员数」计算（多区队部署下不能再按全校人数）
      const threshold = await getVoteThreshold(expense.class_id);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          'INSERT INTO expense_approval_votes (expense_id, user_id, vote) VALUES (?, ?, ?)',
          [expenseId, userId, vote]
        );
        const [countRows] = await conn.query(
          'SELECT COUNT(*) as approve_count FROM expense_approval_votes WHERE expense_id = ? AND vote = 1',
          [expenseId]
        );
        const approveCount = Number(countRows[0].approve_count);
        if (approveCount >= threshold) {
          await conn.query('UPDATE expense_approvals SET status = 1, updated_at = NOW() WHERE expense_id = ? AND step = 3 AND status = 0', [expenseId]);
          await conn.query('UPDATE expenses SET approval_step = -1, status = 1, approval_time = NOW() WHERE id = ? AND status = 0', [expenseId]);
        }
        await conn.commit();
        return { success: true, approveCount, threshold, thresholdMet: approveCount >= threshold };
      } catch (e) {
        await conn.rollback();
        if (e.code === 'ER_DUP_ENTRY') return { success: false, error: '您已投过票' };
        throw e;
      } finally {
        conn.release();
      }
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
  static async getVoteResult(expenseId, classId) {
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
    const threshold = await getVoteThreshold(classId);
    return {
      approveCount: approveRows[0].count,
      rejectCount: rejectRows[0].count,
      totalVotes: totalRows[0].count,
      threshold,
      thresholdMet: approveRows[0].count >= threshold
    };
  }

  // 获取待审批列表
  static async getPendingApprovals(role, classIds) {
    const where = ['e.status = 0'];   // 只列未完成的（原先会把已驳回的残留节点也列出来）
    const params = [];
    if (Array.isArray(classIds)) {
      if (!classIds.length) return [];
      where.push('e.class_id IN (' + classIds.map(() => '?').join(',') + ')');
      params.push(...classIds);
    }
    // 注意参数顺序：SQL 里 class_id 条件在角色条件之前，必须按出现顺序绑定
    params.push(role, role);
    const [rows] = await db.query(
      `SELECT e.*, u.name as applicant_name, ea.step,
        (SELECT COUNT(*) FROM expense_approval_votes WHERE expense_id = e.id AND vote = 1) as vote_approve
      FROM expenses e
      -- 只取「当前步骤」的待办节点：否则大额件刚提交（step=1）时，其 step=3 的空白节点
      -- 也会被匹配到，导致学员提前看到并投票
      JOIN expense_approvals ea ON ea.expense_id = e.id AND ea.step = e.approval_step AND ea.status = 0
      LEFT JOIN users u ON e.user_id = u.id
      WHERE (${where.join(' AND ')})
        AND (
          (ea.step = 1 AND ? IN (1, 8))
          OR (ea.step = 2 AND ? IN (9, 8))
          OR (ea.step = 3)
        )
      ORDER BY e.created_at DESC`,
      params
    );
    return rows;
  }

  // 驳回（任意步骤）
  static async reject(expenseId, step, approverId, notes) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        'UPDATE expense_approvals SET status = 2, approver_id = ?, notes = ?, updated_at = NOW() WHERE expense_id = ? AND step = ? AND status = 0',
        [approverId, notes, expenseId, step]
      );
      if (result.affectedRows === 0) {
        await conn.rollback();
        return false;
      }
      // 终止后续节点：否则"已驳回"的申请会永久挂在其他审批人的待办里
      await conn.query(
        'UPDATE expense_approvals SET status = 2, updated_at = NOW() WHERE expense_id = ? AND step > ? AND status = 0',
        [expenseId, step]
      );
      await conn.query('UPDATE expenses SET status = 2, approval_notes = ? WHERE id = ?', [notes, expenseId]);
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async getExpenseInfo(expenseId, conn) {
    const runner = conn || db;
    const [rows] = await runner.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    return rows[0];
  }
}

module.exports = ExpenseApproval;