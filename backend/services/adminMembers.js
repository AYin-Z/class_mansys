const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../config/logger');
const { BadRequestError, NotFoundError } = require('../shared/http');

const DEFAULT_PASSWORD = '123456';
/** 判定"有历史数据"的表（有记录就不允许物理删除） */
const HISTORY_TABLES = [
  ['leaves', 'user_id'], ['points', 'user_id'], ['expenses', 'user_id'], ['fee_collection_records', 'user_id'],
  ['homework_submissions', 'user_id'], ['suggestions', 'user_id'], ['psychological_applications', 'user_id'],
  ['photos', 'uploader_id'], ['messages', 'user_id'], ['operation_logs', 'user_id'], ['agent_conversations', 'user_id']
];

/**
 * 超管后台的成员管理
 *
 * 安全约束：
 * - 不物理删除有历史数据的成员（只允许"移出统计"，保留历史）；
 * - 物理删除仅用于"刚建错的账号"（无任何历史记录）；
 * - 学号唯一、姓名必填、区队必须存在；
 * - 所有动作由调用方记录审计（operation_logs 中间件已覆盖）。
 */
class AdminMembers {
  static async create({ name, student_id, class_id, role = 0, duty_note = null, member_type = 'student', password }) {
    if (!name || !String(name).trim()) throw new BadRequestError('姓名不能为空');
    if (!student_id || !String(student_id).trim()) throw new BadRequestError('学号不能为空');
    const sid = String(student_id).trim();
    const [[dup]] = await db.query('SELECT id FROM users WHERE student_id = ?', [sid]);
    if (dup) throw new BadRequestError('学号已存在：' + sid);
    if (class_id) {
      const [[cls]] = await db.query('SELECT id FROM classes WHERE id = ?', [String(class_id)]);
      if (!cls) throw new BadRequestError('区队不存在：' + class_id);
    }
    const plain = password && String(password).length >= 6 ? String(password) : DEFAULT_PASSWORD;
    const hash = await bcrypt.hash(plain, 10);
    const [r] = await db.query(
      'INSERT INTO users (name, student_id, password_hash, role, duty_note, phone, class_id, openid, nickName, avatarUrl, email, member_type) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [String(name).trim(), sid, hash, Number(role) || 0, duty_note || null, '', String(class_id || ''), 'admin_' + sid, String(name).trim(), '', sid + '@qq.com', member_type || 'student']
    );
    logger.info({ id: r.insertId, sid }, 'admin member created');
    return { id: r.insertId, student_id: sid, defaultPassword: plain };
  }

  static async update(id, patch) {
    const [[user]] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError('成员不存在');
    const fields = [];
    const params = [];
    const allow = ['name', 'student_id', 'class_id', 'role', 'duty_note', 'member_type'];
    for (const key of allow) {
      if (patch[key] === undefined) continue;
      let value = patch[key];
      if (key === 'role') value = Number(value) || 0;
      if (key === 'student_id') {
        value = String(value).trim();
        if (!value) throw new BadRequestError('学号不能为空');
        const [[dup]] = await db.query('SELECT id FROM users WHERE student_id = ? AND id <> ?', [value, id]);
        if (dup) throw new BadRequestError('学号已被占用：' + value);
      }
      if (key === 'class_id' && value) {
        const [[cls]] = await db.query('SELECT id FROM classes WHERE id = ?', [String(value)]);
        if (!cls) throw new BadRequestError('区队不存在：' + value);
        value = String(value);
      }
      if (key === 'name' && !String(value).trim()) throw new BadRequestError('姓名不能为空');
      if (key === 'duty_note') value = value ? String(value).slice(0, 50) : null;
      if (key === 'member_type' && ['student', 'staff', 'system', 'left'].indexOf(value) === -1) {
        throw new BadRequestError('人员类型不合法');
      }
      fields.push(key + ' = ?');
      params.push(value);
    }
    if (!fields.length) throw new BadRequestError('没有需要更新的字段');
    params.push(id);
    await db.query('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', params);
    const [[updated]] = await db.query(
      'SELECT u.id, u.name, u.student_id, u.class_id, u.role, u.duty_note, u.member_type FROM users u WHERE u.id = ?', [id]
    );
    return updated;
  }

  /** 重置密码：默认 123456，也可由前端指定 */
  static async resetPassword(id, password) {
    const [[user]] = await db.query('SELECT id, name, student_id FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError('成员不存在');
    const plain = password && String(password).length >= 6 ? String(password) : DEFAULT_PASSWORD;
    const hash = await bcrypt.hash(plain, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    logger.info({ id, sid: user.student_id }, 'admin reset password');
    return { id, name: user.name, student_id: user.student_id, password: plain };
  }

  /** 移出统计 / 恢复 */
  static async setStatus(id, status) {
    if (['left', 'student'].indexOf(status) === -1) throw new BadRequestError('状态只支持 left / student');
    const [[user]] = await db.query('SELECT id, name, role, member_type FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError('成员不存在');
    if (status === 'left') {
      await db.query("UPDATE users SET member_type = 'left', role = 0, duty_note = NULL WHERE id = ?", [id]);
    } else {
      await db.query("UPDATE users SET member_type = 'student' WHERE id = ?", [id]);
    }
    return { id, name: user.name, from: user.member_type, to: status };
  }

  /** 物理删除（仅限无历史数据的账号） */
  static async remove(id) {
    const [[user]] = await db.query('SELECT id, name, student_id, role, member_type FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundError('成员不存在');
    if (Number(user.role) === 8) throw new BadRequestError('系统管理员账号不可删除');
    const blocking = [];
    for (const [table, column] of HISTORY_TABLES) {
      try {
        const [[row]] = await db.query('SELECT COUNT(*) AS c FROM ' + table + ' WHERE ' + column + ' = ?', [id]);
        if (Number(row.c) > 0) blocking.push(table + '×' + row.c);
      } catch (e) { /* 表不存在则忽略 */ }
    }
    if (blocking.length) {
      throw new BadRequestError('该成员已有历史数据（' + blocking.slice(0, 4).join('、') + '），不能删除；请改用「移出统计」');
    }
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    logger.info({ id, sid: user.student_id }, 'admin member deleted (no history)');
    return { id, name: user.name, student_id: user.student_id };
  }

  /** 批量操作 */
  static async bulk({ ids, action, value }) {
    if (!Array.isArray(ids) || !ids.length) throw new BadRequestError('请选择成员');
    if (ids.length > 200) throw new BadRequestError('单次最多 200 人');
    const result = { action, total: ids.length, done: 0, skipped: [] };
    for (const id of ids) {
      try {
        if (action === 'set_class') await AdminMembers.update(id, { class_id: value });
        else if (action === 'set_role') await AdminMembers.update(id, { role: value });
        else if (action === 'set_duty_note') await AdminMembers.update(id, { duty_note: value });
        else if (action === 'move_out') await AdminMembers.setStatus(id, 'left');
        else if (action === 'restore') await AdminMembers.setStatus(id, 'student');
        else if (action === 'reset_password') await AdminMembers.resetPassword(id, value);
        else throw new BadRequestError('不支持的批量操作: ' + action);
        result.done += 1;
      } catch (e) {
        result.skipped.push({ id, reason: e.message });
      }
    }
    return result;
  }

  /** 生成随机初始密码（供后台发放） */
  static randomPassword() {
    return crypto.randomBytes(4).toString('hex');
  }
}

module.exports = { AdminMembers, DEFAULT_PASSWORD, HISTORY_TABLES };
