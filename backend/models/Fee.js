const db = require('../config/database');
const ExpenseApproval = require('./ExpenseApproval');

class Fee {
  // === 原有方法（保持兼容）===

  static async createExpense(expenseData) {
    const { user_id, amount, type, purpose, proof_url, details, semester } = expenseData;
    const tier = amount <= 100 ? 'small' : (amount <= 500 ? 'medium' : 'large');
    const [result] = await db.query(
      `INSERT INTO expenses (user_id, amount, type, purpose, tier, proof_url, details, semester, approval_step)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [user_id, amount, type, purpose, tier, proof_url || null, details ? JSON.stringify(details) : null, semester || null]
    );
    const expenseId = result.insertId;
    // 自动创建审批链
    await ExpenseApproval.createChain(expenseId, amount);
    return expenseId;
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

  static async getBalance() {
    const [incomeRows] = await db.query("SELECT SUM(amount) as total FROM expenses WHERE type = '收入' AND status = 1");
    const [expenseRows] = await db.query("SELECT SUM(amount) as total FROM expenses WHERE type = '支出' AND status = 1");
    const income = incomeRows[0].total || 0;
    const expense = expenseRows[0].total || 0;
    return { balance: income - expense, totalIncome: income, totalExpense: expense };
  }

  // === 新增方法 ===

  static async getSummary() {
    const balance = await this.getBalance();
    const [pendingRows] = await db.query(
      `SELECT
        COUNT(CASE WHEN tier = 'small' AND status = 0 THEN 1 END) as pending_small,
        COUNT(CASE WHEN tier = 'medium' AND status = 0 THEN 1 END) as pending_medium,
        COUNT(CASE WHEN tier = 'large' AND status = 0 THEN 1 END) as pending_large,
        COUNT(CASE WHEN status = 1 THEN 1 END) as approved_count,
        COUNT(*) as total_count
      FROM expenses`
    );
    const [collectionRows] = await db.query(
      `SELECT COUNT(*) as total_collections,
        COALESCE(SUM(collected_amount), 0) as total_collected
      FROM fee_collections`
    );
    return {
      ...balance,
      ...pendingRows[0],
      totalCollections: collectionRows[0].total_collections,
      totalCollected: collectionRows[0].total_collected
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
