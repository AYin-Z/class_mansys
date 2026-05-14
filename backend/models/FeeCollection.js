const db = require('../config/database');

class FeeCollection {
  static async create(data) {
    const { title, amount_per_person, semester, created_by } = data;
    const [result] = await db.query(
      'INSERT INTO fee_collections (title, amount_per_person, total_expected, semester, created_by) VALUES (?, ?, ROUND(? * (SELECT COUNT(*) FROM users), 2), ?, ?)',
      [title, amount_per_person, amount_per_person, semester, created_by]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT fc.*, u.name as creator_name,
        (SELECT COUNT(*) FROM fee_collection_records WHERE collection_id = fc.id AND paid_at IS NOT NULL) as paid_count,
        (SELECT COUNT(*) FROM users) as total_count
      FROM fee_collections fc
      LEFT JOIN users u ON fc.created_by = u.id
      WHERE fc.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT fc.*, u.name as creator_name,
        (SELECT COUNT(*) FROM fee_collection_records WHERE collection_id = fc.id AND paid_at IS NOT NULL) as paid_count,
        (SELECT COUNT(*) FROM users) as total_count
      FROM fee_collections fc
      LEFT JOIN users u ON fc.created_by = u.id
      ORDER BY fc.created_at DESC`
    );
    return rows;
  }

  static async getRecords(collectionId) {
    const [rows] = await db.query(
      `SELECT fcr.*, u.name, u.student_id
      FROM fee_collection_records fcr
      LEFT JOIN users u ON fcr.user_id = u.id
      WHERE fcr.collection_id = ?
      ORDER BY u.student_id`,
      [collectionId]
    );
    return rows;
  }

  static async pay(collectionId, userId, amount) {
    // 尝试 INSERT，存在则 UPDATE
    const [result] = await db.query(
      `INSERT INTO fee_collection_records (collection_id, user_id, amount, paid_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE paid_at = NOW(), amount = VALUES(amount)`,
      [collectionId, userId, amount]
    );
    
    // 更新收缴进度
    await db.query(
      `UPDATE fee_collections SET collected_amount = (
        SELECT COALESCE(SUM(amount), 0) FROM fee_collection_records WHERE collection_id = ?
      ) WHERE id = ?`,
      [collectionId, collectionId]
    );
    
    return result.affectedRows > 0;
  }

  static async markExempt(collectionId, userId, remark) {
    const [result] = await db.query(
      `INSERT INTO fee_collection_records (collection_id, user_id, amount, is_exempt, paid_at, remark)
      VALUES (?, ?, 0, TRUE, NOW(), ?)
      ON DUPLICATE KEY UPDATE is_exempt = TRUE, remark = VALUES(remark)`,
      [collectionId, userId, remark]
    );
    return result.affectedRows > 0;
  }

  static async close(collectionId) {
    const [result] = await db.query(
      'UPDATE fee_collections SET status = 1 WHERE id = ?',
      [collectionId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = FeeCollection;
