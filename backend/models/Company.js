const db = require('../config/database');

class Company {
  static async getAll() {
    const [rows] = await db.query('SELECT * FROM companies ORDER BY id ASC');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM companies WHERE id = ?', [id]);
    return rows[0];
  }

  static async create({ id, name, code, description }) {
    await db.query(
      'INSERT INTO companies (id, name, code, description) VALUES (?, ?, ?, ?)',
      [id, name, code || null, description || null]
    );
    return id;
  }

  /** 根据班级 id 查所属中队 id */
  static async findCompanyIdByClassId(classId) {
    if (!classId || classId === '0') return null;
    const [rows] = await db.query('SELECT company_id FROM classes WHERE id = ?', [classId]);
    return rows[0]?.company_id || null;
  }

  /** 某个中队下所有区队（含成员统计） */
  static async getClassesByCompany(companyId) {
    const query = ['SELECT c.id AS class_id, c.name AS class_name,',
      "COUNT(CASE WHEN u.member_type = 'student' THEN 1 END) AS member_count",
      'FROM classes c',
      'LEFT JOIN users u ON u.class_id = c.id',
      'WHERE c.company_id = ?',
      'GROUP BY c.id, c.name',
      'ORDER BY c.id ASC'].join(' ');
    const [rows] = await db.query(query, [companyId]);
    return rows;
  }

  /**
   * 按日期返回某个中队（一组区队）当天在假学员的请假明细
   * @param {string[]} classIds 区队 id 列表
   * @param {string} date YYYY-MM-DD
   */
  static async getLeaveRecordsByClasses(classIds, date) {
    if (!Array.isArray(classIds) || classIds.length === 0) return [];
    const ph = classIds.map(() => '?').join(',');
    const query = [
      'SELECT l.*, u.name AS user_name, u.student_id, u.class_id, c.name AS class_name',
      'FROM leaves l',
      'JOIN users u ON l.user_id = u.id',
      'LEFT JOIN classes c ON u.class_id = c.id',
      "WHERE l.status = 1 AND l.is_cancelled = 0 AND u.member_type = 'student'",
      '  AND l.start_time < DATE_ADD(?, INTERVAL 1 DAY) AND l.end_time >= ?',
      '  AND u.class_id IN (' + ph + ')',
      'ORDER BY c.id, u.student_id ASC'
    ].join(' ');
    const [rows] = await db.query(query, [date, date].concat(classIds));
    return rows;
  }

  /**
   * 按日期返回某个中队所有区队的请假明细
   */
  static async getLeaveRecordsByCompany(companyId, date) {
    const query = [
      'SELECT l.*, u.name AS user_name, u.student_id, u.class_id, c.name AS class_name',
      'FROM leaves l',
      'JOIN users u ON l.user_id = u.id',
      'LEFT JOIN classes c ON u.class_id = c.id',
      "WHERE l.status = 1 AND l.is_cancelled = 0 AND u.member_type = 'student'",
      '  AND l.start_time < DATE_ADD(?, INTERVAL 1 DAY) AND l.end_time >= ?',
      '  AND c.company_id = ?',
      'ORDER BY c.id, u.student_id ASC'
    ].join(' ');
    const [rows] = await db.query(query, [date, date, companyId]);
    return rows;
  }

  /** 批量查询中队 */
  static async getByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const ph = ids.map(() => '?').join(',');
    const [rows] = await db.query('SELECT * FROM companies WHERE id IN (' + ph + ') ORDER BY id ASC', ids);
    return rows;
  }
}

module.exports = Company;
