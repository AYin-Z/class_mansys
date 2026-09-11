const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../config/logger');

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const DEFAULT_PASSWORD = '123456';

/**
 * 名册导入（以表为准）
 *
 * 语义：
 * - 上传的成绩表每个 sheet 对应一个区队（sheet 名含「一区」…「六区」）；
 * - 表里有的人 → 不在库里就新建，在库里就按表更新姓名/区队；
 * - 表里没有、但系统里属于该区队的人 → 移出统计（member_type='left'，保留历史）；
 * - **不动职务（role）与职务备注（duty_note）**：表格里没有职务信息，不能拿它覆盖后台配置。
 */
class RosterImport {
  static classNumFromSheet(sheetName) {
    for (let i = 1; i <= 10; i += 1) {
      if (sheetName.indexOf(CN_NUM[i] + '区') > -1) return i;
    }
    return null;
  }

  static parseWorkbook(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheets = [];
    for (const name of wb.SheetNames) {
      const num = RosterImport.classNumFromSheet(name);
      if (!num) continue;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
      const members = [];
      for (const r of rows) {
        const sid = r[0] === undefined || r[0] === null ? '' : String(r[0]).trim();
        const nm = r[1] === undefined || r[1] === null ? '' : String(r[1]).trim();
        if (!/^\d{10,}$/.test(sid)) continue;
        if (!nm || nm === '姓名') continue;
        members.push({ student_id: sid, name: nm });
      }
      sheets.push({ sheet: name, class_num: num, members });
    }
    return sheets;
  }

  /** 生成变更计划（不写库） */
  static async preview(buffer) {
    const sheets = RosterImport.parseWorkbook(buffer);
    if (!sheets.length) throw new Error('没有识别到区队 sheet（sheet 名需包含「一区」…「六区」）');

    const [classes] = await db.query('SELECT id, name FROM classes');
    const [users] = await db.query(
      'SELECT id, student_id, name, class_id, role, duty_note, member_type FROM users'
    );
    const bySid = new Map(users.map((u) => [u.student_id, u]));
    const byName = new Map();
    for (const u of users) {
      if (!byName.has(u.name)) byName.set(u.name, []);
      byName.get(u.name).push(u);
    }

    const plan = [];
    const globalWarnings = [];
    for (const s of sheets) {
      const cls = classes.find((c) => RosterImport.classNumFromSheet(c.name) === s.class_num);
      const classId = cls ? String(cls.id) : String(s.class_num);
      const seen = new Set();
      const creates = [], updates = [], unchanged = [], warnings = [];
      for (const m of s.members) {
        if (seen.has(m.student_id)) {
          warnings.push({ level: 'warn', text: '表内学号重复：' + m.student_id + ' ' + m.name });
          continue;
        }
        seen.add(m.student_id);
        const u = bySid.get(m.student_id);
        if (!u) {
          const sameName = byName.get(m.name) || [];
          const other = sameName.find((x) => x.member_type !== 'left');
          if (other) {
            warnings.push({ level: 'warn', text: '同名但学号不同：' + m.name + ' 表内 ' + m.student_id + ' / 系统 ' + other.student_id + '（学号变更请用「编辑成员」手动处理）' });
          }
          creates.push({ student_id: m.student_id, name: m.name, class_id: classId });
        } else {
          const diffs = [];
          if (u.name !== m.name) diffs.push({ field: 'name', from: u.name, to: m.name });
          if (String(u.class_id) !== classId) diffs.push({ field: 'class_id', from: String(u.class_id), to: classId });
          if (u.member_type === 'left') diffs.push({ field: 'member_type', from: 'left', to: 'student' });
          if (diffs.length) updates.push({ id: u.id, student_id: m.student_id, name: m.name, class_id: classId, diffs });
          else unchanged.push({ id: u.id, student_id: m.student_id, name: m.name });
        }
      }
      const leaves = users
        .filter((u) => String(u.class_id) === classId && u.member_type !== 'left' && u.member_type !== 'system' && u.member_type !== 'staff')
        .filter((u) => !seen.has(u.student_id))
        .map((u) => ({ id: u.id, student_id: u.student_id, name: u.name, member_type: u.member_type }));

      plan.push({
        class_id: classId,
        class_name: cls ? cls.name : '（系统中不存在，将新建）' + s.class_num + '区',
        sheet: s.sheet,
        sheetCount: s.members.length,
        creates, updates, leaves, unchangedCount: unchanged.length, warnings
      });
      globalWarnings.push(...warnings.map((w) => ({ ...w, class: cls ? cls.name : s.sheet })));
    }

    const summary = plan.reduce((acc, p) => {
      acc.create += p.creates.length;
      acc.update += p.updates.length;
      acc.leave += p.leaves.length;
      acc.unchanged += p.unchangedCount;
      return acc;
    }, { create: 0, update: 0, leave: 0, unchanged: 0 });

    return { plan, summary, warnings: globalWarnings, generatedAt: new Date().toISOString() };
  }

  /** 应用计划（事务） */
  static async apply(buffer, operatorId) {
    const preview = await RosterImport.preview(buffer);
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const conn = await db.getConnection();
    const created = [];
    try {
      await conn.beginTransaction();
      for (const p of preview.plan) {
        const [[cls]] = await conn.query('SELECT id, name, company_id FROM classes WHERE id = ?', [p.class_id]);
        if (!cls) {
          const [[company]] = await conn.query('SELECT id FROM companies ORDER BY id LIMIT 1');
          await conn.query('INSERT INTO classes (id, name, company_id) VALUES (?, ?, ?)', [p.class_id, p.class_name, company ? company.id : null]);
        }
        for (const c of p.creates) {
          await conn.query(
            'INSERT INTO users (name, student_id, password_hash, role, phone, class_id, openid, nickName, avatarUrl, email, member_type) ' +
            "VALUES (?, ?, ?, 0, '', ?, ?, ?, '', ?, 'student')",
            [c.name, c.student_id, hash, c.class_id, 'roster_' + c.student_id, c.name, c.student_id + '@qq.com']
          );
          created.push({ student_id: c.student_id, name: c.name, class_id: c.class_id });
        }
        for (const u of p.updates) {
          await conn.query(
            "UPDATE users SET name = ?, class_id = ?, member_type = 'student' WHERE id = ?",
            [u.name, u.class_id, u.id]
          );
        }
        for (const l of p.leaves) {
          await conn.query("UPDATE users SET member_type = 'left', role = 0 WHERE id = ?", [l.id]);
        }
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    logger.info({ operatorId, created: created.length, summary: preview.summary }, 'roster import applied');
    return { summary: preview.summary, created, defaultPassword: DEFAULT_PASSWORD };
  }
}

module.exports = RosterImport;
