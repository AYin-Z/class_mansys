#!/usr/bin/env node
/**
 * 中队名册导入 / 调整（本学期人员变动）
 *
 * 数据来源：
 *   --file <xlsx>   警训成绩表（每区队一个 sheet，列：学号、姓名、...）
 *   scripts/data/roster-2026-spring.json  离开/加入/干部/备注等变更
 *
 * 行为：
 *   1) 确保中队（companies）与 6 个区队（classes）存在；
 *   2) 按「表内名单 - 离开 + 加入」构建每个区队的目标名册，逐人 upsert；
 *   3) 离开的同学 → member_type='left'（移出出勤/名册统计，保留历史数据）；
 *   4) 写干部职务（users.role）与职务备注（users.duty_note）；
 *   5) 交换生按 X 区 39 号起赋学号，初始密码 123456。
 *
 * 用法：
 *   node scripts/import-roster.js --file /path/to.xlsx            # dry-run（默认，不写库）
 *   node scripts/import-roster.js --file /path/to.xlsx --apply    # 真正写库（事务）
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const db = require('../config/database');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const fileArg = args.indexOf('--file');
const FILE = fileArg > -1 ? args[fileArg + 1] : '';
const CHANGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'roster-2026-spring.json'), 'utf8'));

function log(...a) { console.log(...a); }

function readSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('缺少 sheet: ' + sheetName);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const out = [];
  for (const r of rows) {
    const sid = r[0] === undefined || r[0] === null ? '' : String(r[0]).trim();
    const name = r[1] === undefined || r[1] === null ? '' : String(r[1]).trim();
    if (!/^\d{10,}$/.test(sid) || !name || name === '姓名') continue; // 跳过标题/表头/示例
    if (!/^\d+$/.test(name) && name.length <= 20) out.push({ student_id: sid, name });
  }
  return out;
}

/** 构建目标名册（Excel - 离开 + 加入 + 干部职务 + 备注） */
function buildTarget(wb) {
  const result = {};
  for (const cls of CHANGES.classes) {
    const sheetRows = readSheet(wb, cls.sheet);
    const leavers = CHANGES.leavers[cls.id] || [];
    const joiners = CHANGES.joiners[cls.id] || [];
    const cadreList = CHANGES.cadres[cls.id] || [];
    const notes = CHANGES.dutyNotes[cls.id] || [];
    const roleByName = new Map(cadreList.map((c) => [c[0], c[1]]));
    const noteByName = new Map(notes.filter((n) => n[1]).map((n) => [n[0], n[1]]));

    const sidFix = new Map((CHANGES.studentIdFixes || []).map((f) => [f.from, f.to]));
    const keepRole = CHANGES.keepRoles || {};
    const members = [];
    const push = (m) => {
      if (keepRole[m.name] !== undefined) m.role = Number(keepRole[m.name]);
      if ((CHANGES.studentTypeFixes || []).indexOf(m.name) > -1) m.member_type = 'student';
      members.push(m);
    };
    for (const row of sheetRows) {
      if (leavers.indexOf(row.name) > -1) continue;
      push({
        student_id: sidFix.get(row.student_id) || row.student_id, name: row.name,
        role: roleByName.get(row.name) || 0,
        duty_note: noteByName.get(row.name) || null,
        member_type: 'student'
      });
    }
    for (const j of joiners) {
      push({
        student_id: j.student_id, name: j.name,
        role: roleByName.get(j.name) || 0,
        duty_note: noteByName.get(j.name) || (j.note || null),
        member_type: 'student'
      });
    }
    result[cls.id] = { class: cls, members: members, leavers: leavers, sheetCount: sheetRows.length };
  }
  return result;
}

async function main() {
  if (!FILE) {
    log('用法: node scripts/import-roster.js --file <xlsx> [--apply]');
    process.exit(1);
  }
  const wb = XLSX.readFile(FILE);
  const target = buildTarget(wb);

  log('=== 目标名册 ===');
  let total = 0;
  for (const id of Object.keys(target)) {
    const t = target[id];
    total += t.members.length;
    log('  ' + t.class.name + '：表内 ' + t.sheetCount + ' 人 - 离开 ' + t.leavers.length + ' + 加入 ' + (CHANGES.joiners[id] || []).length + ' = ' + t.members.length + ' 人');
  }
  log('  中队合计：' + total + ' 人');

  // 现有班级
  const [classes] = await db.query('SELECT id, name, company_id FROM classes');
  const classById = new Map(classes.map((c) => [String(c.id), c]));
  const [companies] = await db.query('SELECT id, name FROM companies');
  let company = companies.find((c) => c.name === CHANGES.company) || companies[0];
  log('\n=== 中队/区队 ===');
  log('  中队：' + (company ? company.name + ' (id=' + company.id + ')' : '【需新建】'));
  for (const id of Object.keys(target)) {
    const c = classById.get(id);
    log('  ' + id + '区：' + (c ? '已存在 ' + c.name : '【需新建】 ' + target[id].class.name));
  }

  // 现有用户
  const [users] = await db.query('SELECT id, student_id, name, role, class_id, member_type, duty_note, phone, email FROM users');
  const bySid = new Map(users.map((u) => [u.student_id, u]));

  const inserts = [], updates = [], leaves = [], notes = [];
  for (const id of Object.keys(target)) {
    const t = target[id];
    const targetSids = new Set(t.members.map((m) => m.student_id));
    for (const m of t.members) {
      const u = bySid.get(m.student_id) || users.find((x) => x.name === m.name && CHANGES.studentIdFixes.some((f) => f.from === x.student_id));
      if (!u) { inserts.push(Object.assign({}, m, { class_id: id })); continue; }
      const diffs = [];
      if (u.name !== m.name) diffs.push('姓名 ' + u.name + '→' + m.name);
      if (String(u.class_id) !== id) diffs.push('区队 ' + u.class_id + '→' + id);
      if (Number(u.role) !== m.role) diffs.push('职务 role ' + u.role + '→' + m.role);
      const note = m.duty_note || null;
      if ((u.duty_note || null) !== note) diffs.push('备注 ' + (u.duty_note || '无') + '→' + (note || '无'));
      if (u.member_type !== m.member_type) diffs.push('类型 ' + u.member_type + '→' + m.member_type);
      if (diffs.length) updates.push({ user: u, target: Object.assign({}, m, { class_id: id }), diffs });
    }
    // 离开者：原属该区队、不在目标名单、且不是 admin001 等保护账号
    for (const u of users) {
      if (String(u.class_id) !== id) continue;
      if (targetSids.has(u.student_id)) continue;
      if (CHANGES.protectedAccounts.indexOf(u.student_id) > -1) continue;
      if (u.member_type === 'left') continue;
      if (t.leavers.indexOf(u.name) === -1) {
        notes.push('  ⚠ ' + id + '区 ' + u.name + '(' + u.student_id + ') 不在目标名单，但也不在离开名单 —— 需要你确认');
        continue;
      }
      leaves.push({ user: u, class_id: id });
    }
  }

  log('\n=== 变更预览 ===');
  log('  新增账号 ' + inserts.length + ' 人');
  for (const i of inserts) log('    + ' + i.class_id + '区 ' + i.student_id + ' ' + i.name + (i.role ? ' [' + i.role + ']' : ''));
  log('  更新 ' + updates.length + ' 项');
  for (const u of updates) log('    ~ ' + u.target.student_id + ' ' + u.target.name + '：' + u.diffs.join('；'));
  log('  移出统计 ' + leaves.length + ' 人');
  for (const l of leaves) log('    - ' + l.class_id + '区 ' + l.user.student_id + ' ' + l.user.name + '（保留历史，member_type=' + l.user.member_type + '→left）');
  if (notes.length) { log('  需确认：'); notes.forEach((n) => log(n)); }

  if (!APPLY) {
    log('\n[dry-run] 未写库。确认无误后加 --apply 执行。');
    process.exit(0);
  }

  // ---- 写库 ----
  const hash = await bcrypt.hash(CHANGES.defaultPassword, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let companyId = company && company.id;
    if (!companyId) {
      const [r] = await conn.query('INSERT INTO companies (name) VALUES (?)', [CHANGES.company]);
      companyId = r.insertId;
    }
    for (const id of Object.keys(target)) {
      if (!classById.get(id)) {
        await conn.query('INSERT INTO classes (id, name, company_id) VALUES (?, ?, ?)', [id, target[id].class.name, companyId]);
      } else {
        await conn.query('UPDATE classes SET name = ?, company_id = ? WHERE id = ?', [target[id].class.name, companyId, id]);
      }
    }
    for (const i of inserts) {
      await conn.query(
        'INSERT INTO users (name, student_id, password_hash, role, duty_note, phone, class_id, openid, nickName, avatarUrl, email, member_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [i.name, i.student_id, hash, i.role, i.duty_note || null, '', i.class_id, 'roster_' + i.student_id, i.name, '', i.student_id + '@qq.com', i.member_type]
      );
    }
    for (const u of updates) {
      const t = u.target;
      await conn.query('UPDATE users SET name = ?, role = ?, duty_note = ?, class_id = ?, member_type = ? WHERE id = ?',
        [t.name, t.role, t.duty_note || null, t.class_id, t.member_type, u.user.id]);
    }
    for (const l of leaves) {
      await conn.query("UPDATE users SET member_type = 'left', role = 0, duty_note = NULL WHERE id = ?", [l.user.id]);
    }
    // 学号纠错
    for (const f of CHANGES.studentIdFixes) {
      const [r] = await conn.query('UPDATE users SET student_id = ? WHERE student_id = ?', [f.to, f.from]);
      if (r.affectedRows) log('  ✓ 学号纠错 ' + f.from + ' → ' + f.to);
    }
    await conn.commit();
    log('\n✅ 已写入（事务提交）');
  } catch (e) {
    await conn.rollback();
    log('\n❌ 写入失败，已回滚：' + e.message);
    process.exit(1);
  } finally {
    conn.release();
  }
  process.exit(0);
}

main().catch((e) => { console.error('IMPORT_ERROR:', e.message); process.exit(1); });