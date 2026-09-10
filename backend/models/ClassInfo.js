const db = require('../config/database');

class ClassInfo {
  static async getAll() {
    // 公开接口（注册页）只需 id/name，避免暴露中队归属
    const [rows] = await db.query('SELECT id, name FROM classes ORDER BY id ASC');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT id, name, company_id FROM classes WHERE id = ?', [id]);
    return rows[0];
  }

  static async getByCompany(companyId) {
    const [rows] = await db.query('SELECT id, name FROM classes WHERE company_id = ? ORDER BY id ASC', [companyId]);
    return rows;
  }

  /** 更新区队所属中队 */
  static async setCompany(id, companyId) {
    const [result] = await db.query('UPDATE classes SET company_id = ? WHERE id = ?', [companyId, id]);
    return result.affectedRows > 0;
  }

  static async create({ id, name, company_id }) {
    await db.query('INSERT INTO classes (id, name, company_id) VALUES (?, ?, ?)', [id, name, company_id || null]);
    return id;
  }
}

module.exports = ClassInfo;
