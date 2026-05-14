#!/usr/bin/env node
/**
 * 班级管理系统种子数据脚本
 * 运行: cd backend && node seed.js
 * 生成:
 *   38 名学生 + 8 名干部
 *   6 条收缴记录 + 缴纳明细
 *   8 条收支记录（含多级审批链）
 *   4 条公示
 *   3 个投票
 *   3 个抽奖
 *   4 条通知
 *   5 条建议
 *   2 条心理申请
 *   2 个擂台
 *   2 份作业
 */
const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function seed() {
  console.log('🌱 开始播种数据...\n');

  // ========== 清理旧数据 ==========
  const tables = [
    'expense_approval_votes', 'expense_approvals', 'expenses',
    'fee_collection_records', 'fee_collections', 'fee_publications', 'fee_summary',
    'vote_records', 'vote_options', 'votes',
    'lottery_participants', 'lotteries',
    'challenge_records', 'challenge_applications', 'challenges',
    'homework_submissions', 'homeworks',
    'suggestions', 'messages', 'operation_logs',
    'notice_reads', 'notices',
    'psychological_applications',
    'points', 'photos', 'resources', 'announcements',
    'leaves', 'albums', 'user_stats',
    'users', 'classes'
  ];
  for (const t of tables) {
    try { await db.query(`DELETE FROM \`${t}\``); } catch(e) {}
    try { await db.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = 1`); } catch(e) {}
  }
  console.log('  已清理旧数据\n');

  // ========== 班级 ==========
  await db.query('INSERT INTO classes (id, name) VALUES (6, "数据警务技术六区队")');
  console.log('  ✓ 班级: 数据警务技术六区队');

  // ========== 用户（38 学生 + 8 干部 = 46 人）==========
  const defaultPw = await bcrypt.hash('123456', 10);

  // 干部（role: 1=区队长, 2=生活副区, 3=学习副区, 4=心理副区, 5=团支书, 6=组织委员, 7=宣传委员, 8=管理员）
  // ⚠️ 干部姓名和对应学号需根据实际花名册调整
  const cadres = [
    { name: '殷政', sid: '202521760034', role: 6, phone: '13800000001' },   // 组织委员
    { name: '未指定区队长', sid: '202521760035', role: 1, phone: '13800000002' },
    { name: '未指定生活副区', sid: '202521760036', role: 2, phone: '13800000003' },
    { name: '未指定学习副区', sid: '202521760037', role: 3, phone: '13800000004' },
    { name: '未指定心理副区', sid: '202521760038', role: 4, phone: '13800000005' },
    { name: '未指定团支书', sid: '202521760039', role: 5, phone: '13800000006' },
    { name: '未指定宣传委员', sid: '202521760040', role: 7, phone: '13800000007' },
    { name: '系统管理员', sid: 'admin001', role: 8, phone: '13800000000' }
  ];

  // 38 名学生（实际姓名，来自六区队名单）
  // 学号顺序: 202521760001 ~ 038，干部学号 034~040 被占用，跳过
  const studentNames = [
    '李旭','孙铭阳','王博睿','王崇睿','张铭','顾馨月','刘万宇','倪文',
    '杨峻博','余钊华','张栋翔','周宇铮','陈泳杭','刘阳阳','王东昊','黄金钰',
    '罗家琦','曹依铭','徐一鸣','费铭宇','姜天','周恩典','白昊阳','王译婕',
    '闫圣非','王梓骁','李昊晨','王梓皓','张涵','张睿盈','李锦川','戴子淏',
    '徐鑫鹏','殷政','张驭捷','刘相东','周之亨','阳雨函'
  ];
  const cadreSids = new Set(cadres.map(c => c.sid));
  const students = [];
  for (let i = 0; i < studentNames.length; i++) {
    const sid = `202521760${String(i + 1).padStart(3, '0')}`;
    if (cadreSids.has(sid)) continue; // 跳过干部学号（034~040 中的个人）
    students.push({ name: studentNames[i], sid, role: 0, phone: `1380000${String(101 + i).slice(1)}` });
  }

  // 插入干部
  for (const c of cadres) {
    await db.query(
      'INSERT INTO users (name, student_id, password_hash, role, phone, class_id, openid, nickName, avatarUrl, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.name, c.sid, defaultPw, c.role, c.phone, 6, `seed_${c.sid}`, c.name, '', `${c.sid}@qq.com`]
    );
  }
  // 插入学生
  for (const s of students) {
    await db.query(
      'INSERT INTO users (name, student_id, password_hash, role, phone, class_id, openid, nickName, avatarUrl, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [s.name, s.sid, defaultPw, s.role, s.phone, 6, `seed_${s.sid}`, s.name, '', `${s.sid}@qq.com`]
    );
  }
  console.log(`  ✓ 用户: ${cadres.length} 名干部 + ${students.length} 名学生（初始密码: 123456）`);

  // ========== 缴消费记录 ==========
  const now = new Date();
  await db.query(
    'INSERT INTO fee_collections (title, amount_per_person, total_expected, collected_amount, semester, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['2025-2026学年第二学期班费', 100, 4600, 3800, '2025-2026-2', 1, 2, new Date(now.getTime() - 30*86400000)]
  );
  await db.query(
    'INSERT INTO fee_collections (title, amount_per_person, total_expected, collected_amount, semester, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['五四晚会活动经费', 50, 2300, 2300, '2025-2026-2', 1, 2, new Date(now.getTime() - 15*86400000)]
  );

  // 38 个人的缴纳记录
  for (let i = 1; i <= 38; i++) {
    const paid = i <= 38; // 38 人全交
    await db.query(
      'INSERT INTO fee_collection_records (collection_id, user_id, amount, paid_at) VALUES (1, ?, 100, ?)',
      [i, paid ? new Date(now.getTime() - 28*86400000) : null]
    );
    await db.query(
      'INSERT INTO fee_collection_records (collection_id, user_id, amount, paid_at) VALUES (2, ?, 50, ?)',
      [i, paid ? new Date(now.getTime() - 12*86400000) : null]
    );
  }
  console.log('  ✓ 班费收缴: 2 个批次（均已收齐）');

  // ========== 收支记录 ==========
  const expenses = [
    { uid: 1, amount: 186.50, purpose: '班级清洁用品采购', tier: 'medium', details: '拖把×3、扫把×5、垃圾袋若干', status: 1, step: -1 },
    { uid: 1, amount: 680.00, purpose: '团建聚餐活动经费', tier: 'large', details: '班级聚餐+活动物料', status: 0, step: 1 },
    { uid: 5, amount: 45.00, purpose: '打印期末复习资料', tier: 'small', details: '复习资料打印38份', status: 1, step: -1 },
    { uid: 3, amount: 320.00, purpose: '购买体育器材', tier: 'medium', details: '篮球×2、羽毛球拍×4、跳绳×5', status: 0, step: 2 },
    { uid: 7, amount: 280.00, purpose: '宣传物料制作', tier: 'medium', details: '五四展板+宣传单印刷', status: 1, step: -1 },
    { uid: 6, amount: 1580.00, purpose: '班级联谊活动经费', tier: 'large', details: '场地租赁+茶歇+奖品', status: 0, step: 3 },
    { uid: 2, amount: 2500.00, purpose: '班级年度出游', tier: 'large', details: '景点门票+交通+保险', status: 0, step: 1 },
    { uid: 4, amount: 96.00, purpose: '心理活动物资', tier: 'small', details: '心理沙盘材料', status: 1, step: -1 }
  ];
  for (const e of expenses) {
    const ct = new Date(now.getTime() - Math.floor(Math.random() * 20) * 86400000);
    const [result] = await db.query(
      'INSERT INTO expenses (user_id, amount, purpose, type, tier, details, status, approval_step, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [e.uid, e.amount, e.purpose, '支出', e.tier, JSON.stringify(e.details), e.status, e.step, ct]
    );
    const expenseId = result.insertId;

    // 创建审批链
    if (e.tier === 'small') {
      await db.query('INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, 1, 1, ?)', [expenseId, e.status === 1 ? 1 : 0]);
    } else if (e.tier === 'medium') {
      await db.query('INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, 1, 1, ?)', [expenseId, e.status === 1 || e.step > 1 ? 1 : 0]);
      await db.query('INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, 2, null, ?)', [expenseId, e.status === 1 ? 1 : (e.step === 2 ? 0 : 0)]);
    } else {
      await db.query('INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, 1, 1, ?)', [expenseId, e.status === 1 || e.step > 1 ? 1 : 0]);
      await db.query('INSERT INTO expense_approvals (expense_id, step, approver_role, status) VALUES (?, 3, null, ?)', [expenseId, e.step === 3 ? 0 : (e.status === 1 ? 1 : 0)]);
    }
  }
  console.log('  ✓ 收支记录: 8 条（含多级审批链）');

  // ========== 公示 ==========
  await db.query('INSERT INTO fee_publications (title, period, total_income, total_expense, balance, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['三月财务公示', '2026年3月', 4600, 186.50, 4413.50, 6, new Date(now.getTime() - 25*86400000)]);
  await db.query('INSERT INTO fee_publications (title, period, total_income, total_expense, balance, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['四月财务公示', '2026年4月', 2300, 1341.00, 5372.50, 6, new Date(now.getTime() - 5*86400000)]);
  console.log('  ✓ 财务公示: 2 条');

  // ========== 投票 ==========
  const [vote1] = await db.query(
    'INSERT INTO votes (title, description, type, creator_id, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['班级出游目的地投票', '选择本学期的班级出游目的地', 'single', 1, new Date(now.getTime() - 10*86400000), new Date(now.getTime() + 10*86400000), true]
  );
  await db.query('INSERT INTO vote_options (vote_id, content) VALUES (?, ?), (?, ?), (?, ?)', [vote1.insertId, '颐和园', vote1.insertId, '香山', vote1.insertId, '动物园']);

  const [vote2] = await db.query(
    'INSERT INTO votes (title, description, type, creator_id, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['班级形象设计投票', '选择班徽方案', 'single', 7, new Date(now.getTime() - 5*86400000), new Date(now.getTime() + 15*86400000), true]
  );
  await db.query('INSERT INTO vote_options (vote_id, content) VALUES (?, ?), (?, ?)', [vote2.insertId, '方案A：盾牌+书本', vote2.insertId, '方案B：五星+齿轮']);

  // 已结束的投票
  const [vote3] = await db.query(
    'INSERT INTO votes (title, description, type, creator_id, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['班委改选投票', '新学期班委选举', 'single', 8, new Date(now.getTime() - 30*86400000), new Date(now.getTime() - 20*86400000), false]
  );
  await db.query('INSERT INTO vote_options (vote_id, content) VALUES (?, ?), (?, ?), (?, ?)', [vote3.insertId, '殷政', vote3.insertId, '张同学', vote3.insertId, '李同学']);
  console.log('  ✓ 投票: 3 个（2个进行中，1个已结束）');

  // ========== 通知 ==========
  await db.query('INSERT INTO notices (title, content, type, creator_id) VALUES (?, ?, ?, ?)', ['下周班务安排', '1. 周一班会 18:30 战训馆\n2. 周三卫生检查\n3. 期末复习计划本周发布', '日常', 1]);
  await db.query('INSERT INTO notices (title, content, type, creator_id) VALUES (?, ?, ?, ?)', ['五四晚会通知', '请各位同学着正装参加，18:00在礼堂集合', '活动', 1]);
  await db.query('INSERT INTO notices (title, content, type, creator_id) VALUES (?, ?, ?, ?)', ['宿舍安全检查提醒', '本周将进行宿舍安全大检查，请提前整理内务', '通知', 5]);
  await db.query('INSERT INTO notices (title, content, type, creator_id) VALUES (?, ?, ?, ?)', ['期末考试动员', '距离期末考试还有三周，请合理安排复习时间', '学习', 3]);
  console.log('  ✓ 通知: 4 条');

  // ========== 建议 ==========
  const suggestions = [
    '建议班级多组织一些团建活动，增强凝聚力',
    '希望自习室能延长开放时间到晚上11点',
    '建议每月进行一次学习经验分享会',
    '宿舍热水供应时间希望能延长',
    '建议增设篮球比赛活动'
  ];
  for (const s of suggestions) {
    await db.query('INSERT INTO suggestions (content, category, status) VALUES (?, ?, 0)', [s, 'general']);
  }
  console.log('  ✓ 建议: 5 条（待处理）');

  // ========== 心理申请 ==========
  await db.query('INSERT INTO psychological_applications (user_id, content, status) VALUES (?, ?, ?)', [5, '最近学习压力有点大，想找老师聊聊', 0]);
  await db.query('INSERT INTO psychological_applications (user_id, content, status) VALUES (?, ?, ?)', [15, '有点不适应集体生活，希望能得到帮助', 1]);
  console.log('  ✓ 心理援助: 2 条');

  // ========== 擂台 ==========
  await db.query('INSERT INTO challenges (name, type, description, current_champion_id) VALUES (?, ?, ?, ?)', ['体能擂台·俯卧撑', '体能', '一分钟俯卧撑计数挑战', 1]);
  await db.query('INSERT INTO challenges (name, type, description, current_champion_id) VALUES (?, ?, ?, ?)', ['学习擂台·高数', '学习', '高等数学期末模拟测试最高分', 3]);
  console.log('  ✓ 擂台: 2 个');

  // ========== 抽奖 ==========
  await db.query('INSERT INTO lotteries (name, description, rules, is_active, creator_id, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['期末加油抽奖', '为期末加油打气', '每人均可参与一次', true, 1, new Date(now.getTime() - 5*86400000), new Date(now.getTime() + 20*86400000)]);
  await db.query('INSERT INTO lotteries (name, description, rules, is_active, creator_id, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['五四晚会幸运抽奖', '晚会现场抽奖', '仅限现场参与者', false, 6, new Date(now.getTime() - 20*86400000), new Date(now.getTime() - 7*86400000)]);
  console.log('  ✓ 抽奖: 2 个');

  // ========== 作业 ==========
  await db.query('INSERT INTO homeworks (title, description, creator_id, deadline) VALUES (?, ?, ?, ?)',
    ['期末复习提纲整理', '请整理本学期高数前三章的知识框架，以文档形式提交', 3, new Date(now.getTime() + 7*86400000)]);
  await db.query('INSERT INTO homeworks (title, description, creator_id, deadline) VALUES (?, ?, ?, ?)',
    ['数据分析实训报告', '完成课堂实训的数据分析报告，不少于800字', 3, new Date(now.getTime() + 14*86400000)]);
  console.log('  ✓ 作业: 2 份');

  // ========== 积分 ==========
  await db.query('INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)', [1, 10, '班长月度考评优秀', 8]);
  await db.query('INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)', [2, 5, '生活委员工作积极', 8]);
  await db.query('INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)', [10, 3, '宿舍卫生优秀', 1]);
  await db.query('INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)', [15, -2, '课堂迟到', 1]);
  await db.query('INSERT INTO points (user_id, score, reason, created_by) VALUES (?, ?, ?, ?)', [20, 5, '参加五四晚会表演', 7]);
  console.log('  ✓ 积分: 5 条');

  // ========== 留言 ==========
  await db.query('INSERT INTO messages (content, user_id, target_type, target_id) VALUES (?, ?, ?, ?)', ['大家加油复习！', 1, 'class', 6]);
  await db.query('INSERT INTO messages (content, user_id, target_type, target_id) VALUES (?, ?, ?, ?)', ['收到！', 5, 'class', 6]);
  console.log('  ✓ 留言: 2 条\n');

  console.log('🎉 种子数据播种完成！');
  console.log('   登录账号: 学号 202521760001~202521760040 + "admin001"');
  console.log('   默认密码: 123456');
  console.log('   殷政(组织委员)学号: 202521760034');

  process.exit(0);
}

seed().catch(e => {
  console.error('❌ 播种失败:', e);
  process.exit(1);
});
