const db = require('../config/database');

class FeePublication {
  /**
   * 发布公示：**只汇总本区队**的收支（含收缴收入）
   *
   * 审计修复：原实现无任何 class_id 过滤，等于把全校金额与他区 50 条明细
   * 快照发给了本区队学员；且只算 expenses，漏掉 fee_collections 的收缴收入，
   * 与 /api/fee/summary 口径不一致。
   */
  static async create(data) {
    const { title, period, published_by, class_id } = data;
    if (!class_id) throw new Error('缺少区队信息，无法发布公示');
    // 收入 = 本区队「收入」类报销 + 本区队已截止批次的实收金额
    const [summaryRows] = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = '收入' AND status = 1 THEN amount ELSE 0 END), 0) as income_expense,
        COALESCE(SUM(CASE WHEN type = '支出' AND status = 1 THEN amount ELSE 0 END), 0) as total_expense
      FROM expenses WHERE class_id = ?`,
      [class_id]
    );
    const [collectionRows] = await db.query(
      'SELECT COALESCE(SUM(collected_amount), 0) as total FROM fee_collections WHERE class_id = ? AND status >= 1',
      [class_id]
    );
    const totalIncome = Number(summaryRows[0].income_expense || 0) + Number(collectionRows[0].total || 0);
    const totalExpense = Number(summaryRows[0].total_expense || 0);
    const balance = totalIncome - totalExpense;

    // 明细快照同样限本区队
    const [detailRows] = await db.query(
      `SELECT e.id, e.amount, e.type, e.purpose, e.created_at, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.status = 1 AND e.class_id = ?
      ORDER BY e.created_at DESC
      LIMIT 50`,
      [class_id]
    );

    const [result] = await db.query(
      `INSERT INTO fee_publications (title, period, total_income, total_expense, balance, details_json, published_by, class_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, period, totalIncome, totalExpense, balance, JSON.stringify(detailRows), published_by, class_id]
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
