const db = require('../config/database');

class FeePublication {
  static async create(data) {
    const { title, period, published_by } = data;
    // 从 expenses 表自动汇总
    const [summaryRows] = await db.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END), 0) as total_expense
      FROM expenses`
    );
    const totalIncome = summaryRows[0].total_income;
    const totalExpense = summaryRows[0].total_expense;
    const balance = totalIncome - totalExpense;

    // 保存收支明细快照
    const [detailRows] = await db.query(
      `SELECT e.*, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.status = 1
      ORDER BY e.created_at DESC
      LIMIT 50`
    );

    const [result] = await db.query(
      `INSERT INTO fee_publications (title, period, total_income, total_expense, balance, details_json, published_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, period, totalIncome, totalExpense, balance, JSON.stringify(detailRows), published_by]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT fp.*, u.name as publisher_name
      FROM fee_publications fp
      LEFT JOIN users u ON fp.published_by = u.id
      WHERE fp.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT fp.*, u.name as publisher_name
      FROM fee_publications fp
      LEFT JOIN users u ON fp.published_by = u.id
      ORDER BY fp.published_at DESC`
    );
    return rows;
  }

  static async getLatest() {
    const [rows] = await db.query(
      `SELECT fp.*, u.name as publisher_name
      FROM fee_publications fp
      LEFT JOIN users u ON fp.published_by = u.id
      ORDER BY fp.published_at DESC
      LIMIT 1`
    );
    return rows[0];
  }
}

module.exports = FeePublication;
