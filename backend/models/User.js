const db = require('../config/database');

const PUBLIC_USER_COLUMNS = [
  'id',
  'name',
  'nickName',
  'student_id',
  'class_id',
  'role',
  'member_type',
  'phone',
  'email',
  'avatarUrl',
  'gender',
  'created_at',
  'updated_at'
].join(', ');

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
    const [rows] = await db.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users`);
    return rows;
  }

  static async findPublicById(id) {
    const [rows] = await db.query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`, [id]);
    return rows[0];
  }

  static async update(id, userData) {
    // 只允许更新个人非敏感字段；role / class_id 只能由管理员专用接口修改，防止自提权
    const allowedFields = ['name', 'phone', 'email', 'nickName', 'avatarUrl'];
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

  /** 仅管理员专用：修改用户角色（防止普通自提权） */
  static async updateRole(id, role) {
    const [result] = await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = User;