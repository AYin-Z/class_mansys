const db = require('../config/database');

class LeaveConfig {
  /** 获取所有请假类型（含禁用），按 sort_order 排序 */
  static async getAll() {
    const [rows] = await db.query(
      'SELECT * FROM leave_config ORDER BY sort_order ASC'
    );
    return rows.map(r => ({
      ...r,
      reasons: typeof r.reasons === 'string' ? JSON.parse(r.reasons) : r.reasons
    }));
  }

  /** 获取所有启用的请假类型（供前端申请页使用） */
  static async getEnabled() {
    const [rows] = await db.query(
      'SELECT * FROM leave_config WHERE enabled = TRUE ORDER BY sort_order ASC'
    );
    return rows.map(r => ({
      ...r,
      reasons: typeof r.reasons === 'string' ? JSON.parse(r.reasons) : r.reasons
    }));
  }

  /** 根据 type_name 查找单条 */
  static async findByType(typeName) {
    const [rows] = await db.query(
      'SELECT * FROM leave_config WHERE type_name = ?',
      [typeName]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    r.reasons = typeof r.reasons === 'string' ? JSON.parse(r.reasons) : r.reasons;
    return r;
  }

  /** 根据 ID 查找 */
  static async findById(id) {
    const [rows] = await db.query(
      'SELECT * FROM leave_config WHERE id = ?',
      [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    r.reasons = typeof r.reasons === 'string' ? JSON.parse(r.reasons) : r.reasons;
    return r;
  }

  /** 更新单条配置 */
  static async update(id, fields) {
    const allowed = ['type_name', 'start_time', 'end_time', 'is_fixed', 'reasons', 'enabled', 'sort_order'];
    const clauses = [];
    const values = [];
    for (const f of allowed) {
      if (fields[f] !== undefined) {
        clauses.push(`${f} = ?`);
        values.push(f === 'reasons' ? JSON.stringify(fields[f]) : fields[f]);
      }
    }
    if (clauses.length === 0) return 0;
    values.push(id);
    const [result] = await db.query(
      `UPDATE leave_config SET ${clauses.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows;
  }
}

module.exports = LeaveConfig;
