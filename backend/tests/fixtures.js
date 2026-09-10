#!/usr/bin/env node
/**
 * E2E 夹具：为多区队隔离测试准备第二个区队 + 成员 + 请假数据。
 * 请假时间使用 SQL NOW() 相对时间，保证任何时刻运行都能覆盖“当天/当前”。
 * 用法：DB_NAME=class_manage_sys_test node tests/fixtures.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const PW = '123456';
const CLASS_NEW = '7';
const COMPANY = '1';
const NEW_STUDENT_IDS = ['T70000001', 'T70000002', 'T70000003'];

(async () => {
  // 硬护栏：只允许对 *_test 测试库执行破坏性夹具，避免误伤生产库
  const dbName = process.env.DB_NAME || 'class_manage_sys';
  if (!/_test[0-9]*$/.test(dbName) && process.env.ALLOW_DESTRUCTIVE !== '1') {
    console.error('❌ fixtures.js 会清空业务表，仅允许 DB_NAME 以 _test 结尾（当前: ' + dbName + '）。如确需执行请设 ALLOW_DESTRUCTIVE=1。');
    process.exit(1);
  }
  const hash = await bcrypt.hash(PW, 10);

  await db.query(
    "INSERT INTO classes (id, name, company_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), company_id = VALUES(company_id)",
    [CLASS_NEW, '数据警务技术七区队', COMPANY]
  );
  await db.query("UPDATE classes SET company_id = ? WHERE id = '6'", [COMPANY]);

  // 测试库：先清空业务表，保证夹具可重复执行且不受历史 FK 影响
  const wipe = ['vote_records', 'vote_options', 'votes', 'lottery_participants', 'lotteries',
    'challenge_records', 'challenge_applications', 'challenges',
    'homework_submissions', 'homeworks', 'photos', 'albums',
    'notice_reads', 'notice_completions', 'notices', 'announcements',
    'expense_approval_votes', 'expense_approvals', 'expenses',
    'fee_collection_records', 'fee_collections', 'fee_publications',
    'messages', 'points', 'psychological_applications', 'resources', 'suggestions',
    'operation_logs', 'leaves'];
  for (const t of wipe) { try { await db.query('DELETE FROM `' + t + '`'); } catch (e) { /* ignore */ } }

  // 删除旧的 7 区队测试用户
  const [old] = await db.query('SELECT id FROM users WHERE student_id IN (?)', [NEW_STUDENT_IDS]);
  if (old.length) {
    const ids = old.map(r => r.id);
    try { await db.query('UPDATE challenges SET current_champion_id = NULL WHERE current_champion_id IN (?)', [ids]); } catch (e) { /* ignore */ }
    await db.query('DELETE FROM users WHERE id IN (?)', [ids]);
  }
  const users = [
    { sid: 'T70000001', name: '七区队长', role: 1 },
    { sid: 'T70000002', name: '七区队学员甲', role: 0 },
    { sid: 'T70000003', name: '七区队学员乙', role: 0 },
  ];
  const ids = {};
  for (const u of users) {
    const [r] = await db.query(
      'INSERT INTO users (openid, nickName, avatarUrl, gender, student_id, name, class_id, role, phone, email, password_hash) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)',
      ['fixture_' + u.sid, u.name, '', u.sid, u.name, CLASS_NEW, u.role, '13800000000', u.sid + '@test.local', hash]
    );
    ids[u.sid] = r.insertId;
  }

  const [six] = await db.query("SELECT id, student_id FROM users WHERE student_id IN ('202521760001','202521760025') ORDER BY id ASC");
  const sixStudent = six[0];

  await db.query("DELETE FROM leaves WHERE leave_type = 'E2E测试'");

  // 6 区队：当前在假（已审批、未销假）
  await db.query(
    "INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason, status, is_cancelled) VALUES (?, 'E2E测试', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 3 HOUR), '六区早操病假', 1, 0)",
    [sixStudent.id]
  );
  // 7 区队：当前在假
  await db.query(
    "INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason, status, is_cancelled) VALUES (?, 'E2E测试', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 3 HOUR), '七区早操事假', 1, 0)",
    [ids['T70000002']]
  );
  // 6 区队：逾期未销假
  await db.query(
    "INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason, status, is_cancelled) VALUES (?, 'E2E测试', DATE_SUB(NOW(), INTERVAL 30 HOUR), DATE_SUB(NOW(), INTERVAL 6 HOUR), '未销假用例', 1, 0)",
    [sixStudent.id]
  );
  // 7 区队：待审批（学员乙）
  await db.query(
    "INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason, status, is_cancelled) VALUES (?, 'E2E测试', DATE_ADD(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 4 HOUR), '七区待审批用例', 0, 0)",
    [ids['T70000003']]
  );
  // 6 区队：待审批
  await db.query(
    "INSERT INTO leaves (user_id, leave_type, start_time, end_time, reason, status, is_cancelled) VALUES (?, 'E2E测试', DATE_ADD(NOW(), INTERVAL 2 HOUR), DATE_ADD(NOW(), INTERVAL 4 HOUR), '六区待审批用例', 0, 0)",
    [sixStudent.id]
  );

  // 回填 class_id（模拟迁移 010 对已有数据的回填；先迁移后播种时 seed 数据为 NULL）
  const backfills = [
    ['notices', 'creator_id'], ['announcements', 'creator_id'], ['albums', 'creator_id'],
    ['homeworks', 'creator_id'], ['votes', 'creator_id'], ['lotteries', 'creator_id'],
    ['messages', 'user_id'], ['resources', 'uploader_id'], ['points', 'user_id'],
    ['psychological_applications', 'user_id'], ['expenses', 'user_id'],
    ['fee_collections', 'created_by'], ['fee_publications', 'published_by'],
  ];
  for (const b of backfills) {
    await db.query('UPDATE `' + b[0] + '` x JOIN users u ON x.' + b[1] + ' = u.id SET x.class_id = NULLIF(NULLIF(u.class_id, \'0\'), \'\') WHERE x.class_id IS NULL');
  }
  console.log('夹具就绪：class 7 + 3 用户 + 5 条请假，ids=' + JSON.stringify(ids) + ' sixStudent=' + sixStudent.id);
  process.exit(0);
})().catch(e => { console.error('FIXTURE_ERROR:', e.message); process.exit(1); });