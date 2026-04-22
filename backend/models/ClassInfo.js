const db = require('../config/database');

class ClassInfo {
  static async getAll() {
    const [rows] = await db.query('SELECT id, name FROM classes ORDER BY id ASC');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT id, name FROM classes WHERE id = ?', [id]);
    return rows[0];
  }

  static async create({ id, name }) {
    await db.query('INSERT INTO classes (id, name) VALUES (?, ?)', [id, name]);
    return id;
  }
}

module.exports = ClassInfo;
