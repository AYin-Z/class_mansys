const db = require('../config/database');

class Challenge {
  static async create({ name, type, description }) {
    const [result] = await db.query(
      'INSERT INTO challenges (name, type, description) VALUES (?, ?, ?)',
      [name, type, description]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS champion_name, u.student_id AS champion_student_id
       FROM challenges c
       LEFT JOIN users u ON c.current_champion_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0];
  }

  static async getAll() {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS champion_name, u.student_id AS champion_student_id,
              (SELECT COUNT(*) FROM challenge_records r WHERE r.challenge_id = c.id) AS record_count
       FROM challenges c
       LEFT JOIN users u ON c.current_champion_id = u.id
       ORDER BY c.created_at DESC`
    );
    return rows;
  }

  static async setChampion(id, user_id) {
    const [result] = await db.query(
      'UPDATE challenges SET current_champion_id = ? WHERE id = ?',
      [user_id, id]
    );
    return result.affectedRows > 0;
  }

  // ---- 申请 ----
  static async apply({ challenge_id, user_id }) {
    const [result] = await db.query(
      'INSERT INTO challenge_applications (challenge_id, user_id) VALUES (?, ?)',
      [challenge_id, user_id]
    );
    return result.insertId;
  }

  static async getApplicationsByChallenge(challenge_id) {
    const [rows] = await db.query(
      `SELECT a.*, u.name AS user_name, u.student_id
       FROM challenge_applications a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.challenge_id = ?
       ORDER BY a.created_at DESC`,
      [challenge_id]
    );
    return rows;
  }

  static async getMyApplications(user_id) {
    const [rows] = await db.query(
      `SELECT a.*, c.name AS challenge_name, c.type AS challenge_type
       FROM challenge_applications a
       LEFT JOIN challenges c ON a.challenge_id = c.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC`,
      [user_id]
    );
    return rows;
  }

  static async approveApplication(id, { approver_id, status }) {
    const [result] = await db.query(
      `UPDATE challenge_applications SET status = ?, approver_id = ?, approval_time = NOW() WHERE id = ?`,
      [status, approver_id, id]
    );
    return result.affectedRows > 0;
  }

  static async findApplication(id) {
    const [rows] = await db.query('SELECT * FROM challenge_applications WHERE id = ?', [id]);
    return rows[0];
  }

  // ---- 记录 ----
  static async createRecord({ challenge_id, challenger_id, champion_id, result, notes }) {
    const [r] = await db.query(
      `INSERT INTO challenge_records (challenge_id, challenger_id, champion_id, result, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [challenge_id, challenger_id, champion_id, result, notes || '']
    );
    return r.insertId;
  }

  static async getRecordsByChallenge(challenge_id) {
    const [rows] = await db.query(
      `SELECT r.*, c.name AS challenger_name, ch.name AS champion_name
       FROM challenge_records r
       LEFT JOIN users c ON r.challenger_id = c.id
       LEFT JOIN users ch ON r.champion_id = ch.id
       WHERE r.challenge_id = ?
       ORDER BY r.created_at DESC`,
      [challenge_id]
    );
    return rows;
  }
}

module.exports = Challenge;
