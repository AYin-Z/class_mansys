const db = require('../config/database');
const ExpenseApproval = require('./ExpenseApproval');

class Fee {
  // === 原有方法（保持兼容）===

  /**
   * 提交报销：建单 + 建审批链 + 区队归属 **同一事务**
   *
   * 审计修复：原实现是三次独立写库，createChain 失败会留下"没有任何审批行"的报销
   * （永远无法推进），stampClassId 失败会留下 class_id IS NULL 的记录（=全局可见且不进任何区队账目）。
   */
  static async createExpense(expenseData) {
    const { user_id, amount, type, purpose, proof_url, details, semester, class_id } = expenseData;
    const ALLOWED_TYPES = ['支出', '收入'];
    if (ALLOWED_TYPES.indexOf(type) === -1) throw new Error('费用类型不合法（仅支持 支出/收入）');
    const tier = amount <= 100 ? 'small' : (amount <= 500 ? 'medium' : 'large');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO expenses (user_id, amount, type, purpose, tier, proof_url, details, semester, approval_step, class_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [user_id, amount, type, purpose, tier, proof_url || null, details ? JSON.stringify(details) : null, semester || null, class_id || null]
      );
      const expenseId = result.insertId;
      await ExpenseApproval.createChain(expenseId, amount, conn);
      await conn.commit();
      return expenseId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  static async findExpenseById(id) {
    const [rows] = await db.query(
      `SELECT e.*, u.name as applicant_name, u.student_id,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('step', ea.step, 'status', ea.status, 'approver_name', au.name, 'notes', ea.notes))
        FROM expense_approvals ea LEFT JOIN users au ON ea.approver_id = au.id WHERE ea.expense_id = e.id) as approval_chain
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getExpensesByUserId(user_id) {
    const [rows] = await db.query(
      `SELECT e.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('step', ea.step, 'status', ea.status))
        FROM expense_approvals ea WHERE ea.expense_id = e.id) as approval_chain
      FROM expenses e WHERE e.user_id = ? ORDER BY e.created_at DESC`,
      [user_id]
    );
    return rows;
  }

  static async getAllExpenses() {
    const [rows] = await db.query(
      `SELECT e.*, u.name as applicant_name,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('step', ea.step, 'status', ea.status))
        FROM expense_approvals ea WHERE ea.expense_id = e.id) as approval_chain
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC`
    );
    return rows;
  }

  static async updateExpenseStatus(id, status, approver_id, approval_notes) {
    const [result] = await db.query(
      'UPDATE expenses SET status = ?, approver_id = ?, approval_time = NOW(), approval_notes = ? WHERE id = ?',
      [status, approver_id, approval_notes, id]
    );
    return result.affectedRows > 0;
  }

  static async getBalance(classId) {
    const filter = classId ? ' AND class_id = ?' : '';
    const baseParams = classId ? [classId] : [];
    const [incomeRows] = await db.query('SELECT SUM(amount) as total FROM expenses WHERE type = ? AND status = 1' + filter, ['收入'].concat(baseParams));
    const [expenseRows] = await db.query('SELECT SUM(amount) as total FROM expenses WHERE type = ? AND status = 1' + filter, ['支出'].concat(baseParams));
    const [collectionRows] = await db.query('SELECT COALESCE(SUM(collected_amount), 0) as total FROM fee_collections WHERE status >= 1' + filter, baseParams);
    // 审计修复：DECIMAL 的 SUM 在 mysql2 默认是字符串，原实现 income + collected 会变成字符串拼接
    const income = Number(incomeRows[0].total || 0);
    const expense = Number(expenseRows[0].total || 0);
    const collected = Number(collectionRows[0].total || 0);
    const totalIncome = income + collected;
    return { balance: totalIncome - expense, totalIncome, totalExpense: expense, totalCollected: collected };
  }

  // === 新增方法 ===（classId 为空表示全局/超管视角）

  static async getSummary(classId) {
    const balance = await this.getBalance(classId);
    const filter = classId ? ' WHERE class_id = ?' : '';
    const params = classId ? [classId] : [];
    const [pendingRows] = await db.query(
      'SELECT ' +
      'COUNT(CASE WHEN tier = ? AND status = 0 THEN 1 END) as pending_small, ' +
      'COUNT(CASE WHEN tier = ? AND status = 0 THEN 1 END) as pending_medium, ' +
      'COUNT(CASE WHEN tier = ? AND status = 0 THEN 1 END) as pending_large, ' +
      'COUNT(CASE WHEN status = 1 THEN 1 END) as approved_count, ' +
      'COUNT(*) as total_count FROM expenses' + filter,
      ['small', 'medium', 'large'].concat(params)
    );
    const [collectionRows] = await db.query(
      'SELECT COUNT(*) as total_collections, COALESCE(SUM(collected_amount), 0) as total_collected FROM fee_collections' + filter,
      params
    );
    return {
      ...balance,
      ...pendingRows[0],
      totalCollections: Number(collectionRows[0].total_collections || 0),
      // DECIMAL 的 SUM 是字符串，统一转数字（否则前端拼接/比较会出错）
      totalCollected: Number(collectionRows[0].total_collected || 0)
    };
  }
  static async getExpenseWithApprovals(id) {
    const expense = await this.findExpenseById(id);
    if (!expense) return null;
    const approvals = await ExpenseApproval.getChain(id);
    const voteResult = await ExpenseApproval.getVoteResult(id);
    return { ...expense, approvals, voteResult };
  }
}

module.exports = Fee;