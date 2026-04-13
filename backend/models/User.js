const db = require('../config/database');
const bcrypt = require('bcryptjs');

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

  static async getAll() {
    const [rows] = await db.query('SELECT * FROM users');
    return rows;
  }

  static async update(id, userData) {
    const fields = [];
    const values = [];
    
    Object.entries(userData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    
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