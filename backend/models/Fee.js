const db = require('../config/database');

class Fee {
  static async createExpense(expenseData) {
    const { user_id, amount, type, purpose } = expenseData;
    
    const [result] = await db.query(
      'INSERT INTO expenses (user_id, amount, type, purpose) VALUES (?, ?, ?, ?)',
      [user_id, amount, type, purpose]
    );
    
    return result.insertId;
  }

  static async findExpenseById(id) {
    const [rows] = await db.query('SELECT * FROM expenses WHERE id = ?', [id]);
    return rows[0];
  }

  static async getExpensesByUserId(user_id) {
    const [rows] = await db.query('SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
    return rows;
  }

  static async getAllExpenses() {
    const [rows] = await db.query('SELECT * FROM expenses ORDER BY created_at DESC');
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
    const [incomeRows] = await db.query('SELECT SUM(amount) as total FROM expenses WHERE type = ? AND status = ?', ['收入', 1]);
    const [expenseRows] = await db.query('SELECT SUM(amount) as total FROM expenses WHERE type = ? AND status = ?', ['支出', 1]);
    
    const income = incomeRows[0].total || 0;
    const expense = expenseRows[0].total || 0;
    
    return {
      balance: income - expense,
      totalIncome: income,
      totalExpense: expense
    };
  }
}

module.exports = Fee;