const db = require('../config/database');

class Homework {
  static async create({ title, description, creator_id, deadline }) {
    const [result] = await db.query(
      'INSERT INTO homeworks (title, description, creator_id, deadline) VALUES (?, ?, ?, ?)',
      [title, description, creator_id, deadline]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT h.*, u.name AS creator_name
       FROM homeworks h
       LEFT JOIN users u ON h.creator_id = u.id
       WHERE h.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT h.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id) AS submission_count
       FROM homeworks h
       LEFT JOIN users u ON h.creator_id = u.id
       ORDER BY h.created_at DESC`
    );
    return rows;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM homeworks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // ---- 提交 ----
  static async submit({ homework_id, user_id, file_url, file_name }) {
    // 同一用户重复提交：覆盖
    const [exist] = await db.query(
      'SELECT id FROM homework_submissions WHERE homework_id = ? AND user_id = ?',
      [homework_id, user_id]
    );
    if (exist[0]) {
      await db.query(
        `UPDATE homework_submissions
         SET file_url = ?, file_name = ?, status = 0, score = NULL, feedback = NULL,
             submitted_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [file_url, file_name, exist[0].id]
      );
      return exist[0].id;
    }
    const [result] = await db.query(
      'INSERT INTO homework_submissions (homework_id, user_id, file_url, file_name) VALUES (?, ?, ?, ?)',
      [homework_id, user_id, file_url, file_name]
    );
    return result.insertId;
  }

  static async getSubmissionsByHomework(homework_id) {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS user_name, u.student_id
       FROM homework_submissions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.homework_id = ?
       ORDER BY s.submitted_at DESC`,
      [homework_id]
    );
    return rows;
  }

  static async getMySubmission(homework_id, user_id) {
    const [rows] = await db.query(
      'SELECT * FROM homework_submissions WHERE homework_id = ? AND user_id = ?',
      [homework_id, user_id]
    );
    return rows[0];
  }

  static async grade(submission_id, { score, feedback }) {
    const [result] = await db.query(
      `UPDATE homework_submissions SET score = ?, feedback = ?, status = 1 WHERE id = ?`,
      [score, feedback || '', submission_id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Homework;
