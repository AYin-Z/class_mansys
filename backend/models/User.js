const db = require('../config/database');

class User {
  static async create(userData) {
    const { openid, nickName, avatarUrl, gender, student_id, name, class_id, role, phone, email } = userData;
    
    const [result] = await db.query(
      'INSERT INTO users (openid, nickName, avatarUrl, gender, student_id, name, class_id, role, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [openid, nickName, avatarUrl, gender, student_id, name, class_id, role, phone, email]
    );
    
    return result.insertId;
  }

  static async findByOpenid(openid) {
    const [rows] = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  static async findByStudentId(student_id) {
    const [rows] = await db.query('SELECT * FROM users WHERE student_id = ?', [student_id]);
    return rows[0];
  }

  static async findByPhone(phone) {
    const [rows] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    return rows[0];
  }

  static async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  static async updatePassword(id, passwordHash) {
    const [result] = await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    return result.affectedRows > 0;
  }

  static async verifyPhone(id) {
    const [result] = await db.query('UPDATE users SET phone_verified = 1 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getAll() {
    const [rows] = await db.query('SELECT * FROM users');
    return rows;
  }

  static async update(id, userData) {
    const allowedFields = ['name', 'phone', 'email', 'nickName', 'avatarUrl', 'class_id'];
    const fields = [];
    const values = [];
    Object.entries(userData).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    if (fields.length === 0) return false;
    values.push(id);
    const [result] = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = User;