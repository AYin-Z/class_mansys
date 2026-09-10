#!/usr/bin/env node
/**
 * 端到端验收测试（对独立测试实例执行）
 * 用法：E2E_BASE=http://127.0.0.1:3102 node tests/e2e-acceptance.js
 */
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3102';
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

async function req(method, path, opts) {
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
  if (opts.origin) headers['Origin'] = opts.origin;
  const res = await fetch(BASE + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { _raw: text }; }
  return { status: res.status, data, headers: res.headers };
}
async function login(sid, pw) {
  const r = await req('POST', '/api/auth/login-with-password', { body: { student_id: sid, password: pw || '123456' } });
  return (r.data && r.data.token) || null;
}
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

(async () => {
  section('登录');
  const adminToken = await login('admin001');
  const leader6Token = await login('202521760025');
  const leader7Token = await login('T70000001');
  const student6Token = await login('202521760001');
  const student7Token = await login('T70000002');
  const student7bToken = await login('T70000003');
  check('超管登录', !!adminToken);
  check('6区队长登录', !!leader6Token);
  check('7区队长登录', !!leader7Token);
  check('6区学员登录', !!student6Token);
  check('7区学员登录', !!student7Token);
  check('7区学员乙登录', !!student7bToken);
  if (!adminToken || !leader6Token || !leader7Token || !student6Token || !student7Token || !student7bToken) {
    console.log('\n登录失败，终止验收'); process.exit(1);
  }
  const me6 = (await req('GET', '/api/auth/userinfo', { token: student6Token })).data.user;
  const me7 = (await req('GET', '/api/auth/userinfo', { token: student7Token })).data.user;

  section('P0-2 防自提权');
  await req('PUT', '/api/users/' + me6.id, { token: student6Token, body: { role: 8 } });
  const after = (await req('GET', '/api/auth/userinfo', { token: student6Token })).data.user;
  check('学员 PUT role=8 未生效', after.role === 0, 'role=' + after.role);
  check('学员 class_id 未被篡改', String(after.class_id) === String(me6.class_id), 'class_id=' + after.class_id);

  section('P0-3 越权写操作');
  const a1 = await req('POST', '/api/announcement/create', { token: student6Token, body: { title: 'x', content: 'y' } });
  check('学员发公告被拒', a1.status === 403, 'status=' + a1.status);
  const l1 = await req('POST', '/api/lottery', { token: student6Token, body: { name: 'x', rules: 'r', start_time: today + ' 00:00:00', end_time: today + ' 23:59:59' } });
  check('学员建抽奖被拒', l1.status === 403, 'status=' + l1.status);
  const c1 = await req('POST', '/api/challenge', { token: student6Token, body: { name: 'x', type: 't', description: 'd' } });
  check('学员建擂台被拒', c1.status === 403, 'status=' + c1.status);
  const p1 = await req('DELETE', '/api/points/1', { token: student6Token });
  check('学员删积分被拒', p1.status === 403, 'status=' + p1.status);

  section('P0-4 请假 user_id 越权');
  // 早操的允许时段为 07:00-08:00（生产配置），测试必须落在窗口内，否则会被业务规则拦下
  const ap = await req('POST', '/api/leave/apply', { token: student6Token, body: { type: '早操', start_time: today + ' 07:15:00', end_time: today + ' 07:45:00', reason: 'E2E越权用例', user_id: me7.id } });
  const mine6 = (await req('GET', '/api/leave/my', { token: student6Token })).data.leaves || [];
  const created = mine6.find(function (l) { return l.reason === 'E2E越权用例'; });
  check('请假创建成功', !!created, JSON.stringify(ap.data));
  check('user_id 强制为本人', !!created && Number(created.user_id) === Number(me6.id), created ? ('user_id=' + created.user_id) : 'none');
  const mine7 = (await req('GET', '/api/leave/my', { token: student7Token })).data.leaves || [];
  check('未挂到他人名下', !mine7.some(function (l) { return l.reason === 'E2E越权用例'; }));

  section('P1-6 验证码防爆破');
  const phone = '13900000001';
  const sc = await req('POST', '/api/auth/send-code', { body: { phone: phone } });
  check('测试模式返回验证码', sc.status === 200 && !!sc.data.code, 'status=' + sc.status);
  const code = sc.data.code;
  for (let i = 0; i < 5; i++) { await req('POST', '/api/auth/phone-code-login', { body: { phone: phone, code: '000000' } }); }
  const after5 = await req('POST', '/api/auth/phone-code-login', { body: { phone: phone, code: code } });
  check('超次数后验证码作废', after5.status !== 200, 'status=' + after5.status);

  section('P1-7 CORS 白名单');
  const evil = await req('GET', '/health', { origin: 'https://evil.example.com' });
  check('恶意 Origin 无 ACAO', !evil.headers.get('access-control-allow-origin'), evil.headers.get('access-control-allow-origin') || 'none');
  const good = await req('GET', '/health', { origin: 'https://cls.ayinserver.xin' });
  check('允许 Origin 返回 ACAO', good.headers.get('access-control-allow-origin') === 'https://cls.ayinserver.xin', good.headers.get('access-control-allow-origin') || 'none');

  section('P1-8 匿名建议');
  const sub = await req('POST', '/api/suggestion', { token: student6Token, body: { content: 'E2E 匿名建议内容测试' } });
  check('提交返回 viewToken', sub.status === 200 && !!sub.data.viewToken, JSON.stringify(sub.data));
  const tok = sub.data.viewToken;
  const mine = await req('GET', '/api/suggestion/mine?tokens=' + tok, { token: student6Token });
  check('凭 token 可查自己的建议', mine.status === 200 && (mine.data.suggestions || []).some(function (s) { return s.content === 'E2E 匿名建议内容测试'; }));
  const mineNo = await req('GET', '/api/suggestion/mine', { token: student6Token });
  check('无 token 查询被拒', mineNo.status === 403, 'status=' + mineNo.status);
  const dStu = await req('GET', '/api/suggestion/' + sub.data.id, { token: student7Token });
  check('学员读建议详情被拒', dStu.status === 403, 'status=' + dStu.status);
  const dAdmin = await req('GET', '/api/suggestion/' + sub.data.id, { token: adminToken });
  check('管理员可读建议详情', dAdmin.status === 200, 'status=' + dAdmin.status);

  section('P1-9 待办完成名单');
  const comp = await req('GET', '/api/notice/1/completion', { token: student6Token });
  check('学员读完成名单被拒', comp.status === 403, 'status=' + comp.status);

  section('中队作用域（平行查看）');
  const ov6 = await req('GET', '/api/company/overview?date=' + today, { token: leader6Token });
  const ovClasses = (ov6.data && ov6.data.classes) || [];
  check('6区队长可见中队概览', ov6.status === 200 && ovClasses.length >= 2, 'status=' + ov6.status + ' classes=' + ovClasses.length);
  const c6stat = ovClasses.find(function (c) { return String(c.class_id) === '6'; });
  check('出勤分母含班干部（member_count > 角色0人数）', !!c6stat && Number(c6stat.member_count || 0) > 30, 'member_count=' + (c6stat ? c6stat.member_count : 'n/a'));
  check('在编 = 出勤 + 请假', !!c6stat && (Number(c6stat.present) + Number(c6stat.on_leave) === Number(c6stat.member_count)), JSON.stringify(c6stat || {}).slice(0, 140));
  const ov7 = await req('GET', '/api/company/overview?date=' + today, { token: leader7Token });
  check('7区队长平行可见中队概览', ov7.status === 200, 'status=' + ov7.status);
  const ovStu = await req('GET', '/api/company/overview?date=' + today, { token: student6Token });
  check('学员不可见中队概览', ovStu.status === 403, 'status=' + ovStu.status);
  const recRes = await req('GET', '/api/company/leave-records?date=' + today, { token: leader6Token });
  const recs = (recRes.data && recRes.data.records) || [];
  check('中队请假明细含 6 区队', recs.some(function (r) { return String(r.class_id) === '6'; }));
  check('中队请假明细含 7 区队', recs.some(function (r) { return String(r.class_id) === '7'; }));
  const allRes = await req('GET', '/api/leave/all', { token: leader6Token });
  const allLeaves = (allRes.data && allRes.data.leaves) || [];
  check('请假列表含 6 区队', allLeaves.some(function (l) { return String(l.class_id) === '6'; }));
  check('请假列表含 7 区队（平行）', allLeaves.some(function (l) { return String(l.class_id) === '7'; }));

  section('请假审批作用域（本区队）');
  const my7b = (await req('GET', '/api/leave/my', { token: student7bToken })).data.leaves || [];
  const pending7 = my7b.find(function (l) { return l.reason === '七区待审批用例'; });
  const my6b = (await req('GET', '/api/leave/my', { token: student6Token })).data.leaves || [];
  const pending6 = my6b.find(function (l) { return l.reason === '六区待审批用例'; });
  if (pending7 && pending6) {
    const cross = await req('PUT', '/api/leave/approve', { token: leader6Token, body: { id: pending7.id, status: 1 } });
    check('6区队长不能审批7区请假', cross.status === 403, 'status=' + cross.status);
    const own6 = await req('PUT', '/api/leave/approve', { token: leader6Token, body: { id: pending6.id, status: 1 } });
    check('6区队长可审批本区请假', own6.status === 200, 'status=' + own6.status);
    const own7 = await req('PUT', '/api/leave/approve', { token: leader7Token, body: { id: pending7.id, status: 1 } });
    check('7区队长可审批本区请假', own7.status === 200, 'status=' + own7.status);
  } else {
    check('找到待审批用例', false, 'pending7=' + !!pending7 + ' pending6=' + !!pending6);
  }

  section('内容区队隔离');
  const n6 = await req('POST', '/api/notice/create', { token: leader6Token, body: { title: 'E2E六区通知', content: '仅六区可见' } });
  check('6区队长发通知', n6.status === 200, 'status=' + n6.status);
  const nAll = await req('POST', '/api/notice/create', { token: adminToken, body: { title: 'E2E全局通知', content: '全局可见' } });
  check('超管发全局通知', nAll.status === 200, 'status=' + nAll.status);
  const l7 = (await req('GET', '/api/notice', { token: student7Token })).data.notices || [];
  const l6 = (await req('GET', '/api/notice', { token: student6Token })).data.notices || [];
  check('7区看不到6区通知', !l7.some(function (n) { return n.title === 'E2E六区通知'; }));
  check('6区能看到6区通知', l6.some(function (n) { return n.title === 'E2E六区通知'; }));
  check('7区能看到全局通知', l7.some(function (n) { return n.title === 'E2E全局通知'; }));
  const ann6 = await req('POST', '/api/announcement/create', { token: leader6Token, body: { title: 'E2E六区公告', content: 'x' } });
  check('6区队长发公告', ann6.status === 200, 'status=' + ann6.status);
  const al7 = (await req('GET', '/api/announcement', { token: student7Token })).data.announcements || [];
  const al6 = (await req('GET', '/api/announcement', { token: student6Token })).data.announcements || [];
  check('7区看不到6区公告', !al7.some(function (a) { return a.title === 'E2E六区公告'; }));
  check('6区能看到6区公告', al6.some(function (a) { return a.title === 'E2E六区公告'; }));

  section('新增作用域模块（积分/心理/留言/擂台/班费）');
  const pts = await req('POST', '/api/points', { token: leader6Token, body: { user_id: me6.id, score: 1, reason: 'E2E积分' } });
  check('6区队长可加本区积分', pts.status === 200, 'status=' + pts.status);
  const ptsAll7 = (await req('GET', '/api/points/all', { token: leader7Token })).data.records || [];
  check('7区队长看不到6区积分记录', !ptsAll7.some(function (r) { return r.reason === 'E2E积分'; }));
  const ptsAll6 = (await req('GET', '/api/points/all', { token: leader6Token })).data.records || [];
  check('6区队长能看到本区积分记录', ptsAll6.some(function (r) { return r.reason === 'E2E积分'; }));

  const psy = await req('POST', '/api/psychological', { token: student7Token, body: { content: 'E2E心理申请内容' } });
  check('7区学员可提交心理申请', psy.status === 200, 'status=' + psy.status);
  const psyAll6 = (await req('GET', '/api/psychological/all', { token: leader6Token })).data.applications || [];
  check('6区队长看不到7区心理申请', !psyAll6.some(function (a) { return a.content === 'E2E心理申请内容'; }));

  const msgBad = await req('POST', '/api/message', { token: student7Token, body: { content: 'E2E越区留言', target_id: 6, target_type: 'class' } });
  check('7区学员不能向6区留言', msgBad.status === 403, 'status=' + msgBad.status);
  const msgOk = await req('POST', '/api/message', { token: student7Token, body: { content: 'E2E本区留言', target_id: 7, target_type: 'class' } });
  check('7区学员可向本区留言', msgOk.status === 200, 'status=' + msgOk.status);

  const chCreate = await req('POST', '/api/challenge', { token: leader6Token, body: { name: 'E2E擂台', type: '体能', description: '测试' } });
  check('6区队长可创建擂台', chCreate.status === 200, 'status=' + chCreate.status);
  const ch7 = (await req('GET', '/api/challenge', { token: student7Token })).data.challenges || [];
  check('7区看不到6区擂台', !ch7.some(function (c) { return c.name === 'E2E擂台'; }));
  const ch6 = (await req('GET', '/api/challenge', { token: student6Token })).data.challenges || [];
  check('6区能看到6区擂台', ch6.some(function (c) { return c.name === 'E2E擂台'; }));

  const feeCreate = await req('POST', '/api/fee/collections', { token: leader6Token, body: { title: 'E2E班费', amount_per_person: 1, semester: 'E2E' } });
  check('6区队长可发起本区收缴', feeCreate.status === 200, 'status=' + feeCreate.status);
  const feeC6 = (await req('GET', '/api/fee/collections', { token: leader6Token })).data.collections || [];
  const feeC7 = (await req('GET', '/api/fee/collections', { token: leader7Token })).data.collections || [];
  check('6区队长可见本区班费收缴', feeC6.some(function (c) { return c.title === 'E2E班费'; }), 'count=' + feeC6.length);
  check('7区队长看不到6区班费收缴', !feeC7.some(function (c) { return c.title === 'E2E班费'; }), 'count=' + feeC7.length);
  const sum7 = (await req('GET', '/api/fee/summary', { token: leader7Token })).data.summary || {};
  check('7区班费汇总相互独立', Number(sum7.totalCollections || 0) === 0, JSON.stringify(sum7).slice(0, 120));

  section('二轮安全回归（subagent 发现项）');
  const n7res = await req('POST', '/api/notice/create', { token: leader7Token, body: { title: 'E2E七区待办', content: 'x', is_todo: true } });
  const n7id = (n7res.data && n7res.data.data && n7res.data.data.id) || (n7res.data && n7res.data.id);
  const compCross = await req('GET', '/api/notice/' + n7id + '/completion', { token: leader6Token });
  check('6区队长不能读7区完成名单', compCross.status === 403, 'status=' + compCross.status);
  const compOwn = await req('GET', '/api/notice/' + n7id + '/completion', { token: leader7Token });
  check('7区队长可读本区完成名单', compOwn.status === 200, 'status=' + compOwn.status);

  const mem6 = await req('GET', '/api/admin/members?pageSize=200', { token: leader6Token });
  const m6 = (mem6.data && mem6.data.members) || [];
  check('6区队长成员列表不含7区', !m6.some(function (m) { return String(m.class_id) === '7'; }), 'classes=' + [...new Set(m6.map(function (m) { return m.class_id; }))].join(','));
  const memAll = await req('GET', '/api/admin/members?pageSize=200', { token: adminToken });
  const m7row = ((memAll.data && memAll.data.members) || []).find(function (m) { return String(m.class_id) === '7'; });
  if (m7row) {
    const det = await req('GET', '/api/admin/members/' + m7row.id, { token: leader6Token });
    check('6区队长不能看7区成员详情', det.status === 403, 'status=' + det.status);
    const addBad = await req('POST', '/api/points', { token: leader6Token, body: { user_id: m7row.id, score: 1, reason: 'E2E跨区加分' } });
    check('6区队长不能给7区学员加分', addBad.status === 403, 'status=' + addBad.status);
  } else {
    check('找到7区成员用于越权测试', false, 'no class7 member');
  }

  const voteBad = await req('POST', '/api/vote', { token: student6Token, body: { title: 'E2E学员投票', options: ['a', 'b'], start_time: today + ' 00:00:00', end_time: today + ' 23:59:00' } });
  check('学员不能发起投票', voteBad.status === 403, 'status=' + voteBad.status);

  const cls = await req('GET', '/api/classes', {});
  const clsRow = ((cls.data && cls.data.classes) || [])[0] || {};
  check('公开班级接口不含 company_id', !('company_id' in clsRow), JSON.stringify(clsRow).slice(0, 80));

  const emptyPut = await req('PUT', '/api/users/' + me6.id, { token: student6Token, body: { role: 8 } });
  check('仅非法字段更新返回 400', emptyPut.status === 400, 'status=' + emptyPut.status);

  section('对话式 Agent（mock 模式 + 两阶段确认）');
  const toolsRes = await req('GET', '/api/agent/tools', { token: student6Token });
  const toolModules = (toolsRes.data && toolsRes.data.data && toolsRes.data.data.modules) || [];
  check('能力目录可用（模块工具 >= 18）', toolsRes.status === 200 && toolModules.length >= 18, 'status=' + toolsRes.status + ' modules=' + toolModules.length);

  const chatRead = await req('POST', '/api/agent/chat', { token: student6Token, body: { message: '我的请假记录' } });
  check('读意图：调用工具并回复', chatRead.status === 200 && !!chatRead.data.reply && !!chatRead.data.conversationId, JSON.stringify(chatRead.data).slice(0, 120));

  const chatWrite = await req('POST', '/api/agent/chat', { token: student6Token, body: { message: '建议：希望食堂多开一个窗口' } });
  const pending = chatWrite.data && chatWrite.data.pendingAction;
  check('写意图：返回待确认动作（不直接执行）', chatWrite.status === 200 && !!pending, JSON.stringify(chatWrite.data).slice(0, 150));

  if (pending) {
    const confirm = await req('POST', '/api/agent/confirm', { token: student6Token, body: { actionId: pending.id } });
    check('确认后执行成功', confirm.status === 200 && confirm.data.success === true, JSON.stringify(confirm.data).slice(0, 150));
    const again = await req('POST', '/api/agent/confirm', { token: student6Token, body: { actionId: pending.id } });
    check('同一动作不可重复执行', again.status === 404, 'status=' + again.status);
    const otherUser = await req('POST', '/api/agent/confirm', { token: student7Token, body: { actionId: pending.id } });
    check('他人不能确认我的动作', otherUser.status === 404 || otherUser.status === 403, 'status=' + otherUser.status);
  } else {
    check('拿到待确认动作', false, 'no pendingAction');
  }

  const guideChat = await req('POST', '/api/agent/chat', { token: student6Token, body: { message: '怎么请假？' } });
  check('引导意图可应答', guideChat.status === 200 && !!guideChat.data.reply && guideChat.data.reply.length > 0, JSON.stringify(guideChat.data).slice(0, 120));

  const cadreToolsRes = await req('GET', '/api/agent/tools', { token: leader6Token });
  const cadreToolNames = (((cadreToolsRes.data || {}).data || {}).curated || []).map(function (t) { return t.name; });
  check('干部管理工具已注册', ['pending_leave_approvals', 'pending_fee_approvals', 'roster_search', 'publish_notice', 'approve_leave', 'add_points'].every(function (n) { return cadreToolNames.indexOf(n) > -1; }), cadreToolNames.join(','));

  const convRes = await req('GET', '/api/agent/conversations', { token: student6Token });
  check('会话列表可查', convRes.status === 200 && Array.isArray(convRes.data.conversations) && convRes.data.conversations.length >= 1);

  const otherConv = await req('GET', '/api/agent/conversations/' + (chatWrite.data.conversationId || 1) + '/messages', { token: student7Token });
  check('他人不能读我的会话', otherConv.status === 403, 'status=' + otherConv.status);

  section('微信渠道绑定 & MCP 令牌');
  const anonBind = await req('POST', '/api/agent/channel/bind-code', {});
  check('未登录不能生成绑定码', anonBind.status === 401, 'status=' + anonBind.status);
  const bc = await req('POST', '/api/agent/channel/bind-code', { token: student6Token });
  const bcData = (bc.data && bc.data.data) || {};
  check('生成微信绑定码（6 位、15 分钟）', bc.status === 200 && /^[A-Z0-9]{6}$/.test(bcData.code || '') && bcData.expiresInSec === 900, JSON.stringify(bc.data).slice(0, 120));
  const binds0 = await req('GET', '/api/agent/channel/bindings', { token: student6Token });
  check('绑定列表可查', binds0.status === 200 && Array.isArray(binds0.data.bindings), 'status=' + binds0.status);

  const tk = await req('POST', '/api/agent/tokens', { token: student6Token, body: { name: 'E2E令牌' } });
  const tkData = (tk.data && tk.data.data) || {};
  check('创建 MCP 令牌（返回明文一次）', tk.status === 200 && String(tkData.token || '').startsWith('cm_'), JSON.stringify(tk.data).slice(0, 80));
  const tkList = await req('GET', '/api/agent/tokens', { token: student6Token });
  const myTok = ((tkList.data || {}).tokens || []).find(function (t) { return t.prefix === tkData.prefix; });
  check('令牌列表只返回前缀（不含明文）', tkList.status === 200 && !!myTok && JSON.stringify(tkList.data).indexOf(tkData.token) === -1, 'status=' + tkList.status);
  const tokenNameBad = await req('POST', '/api/agent/tokens', { token: student6Token, body: { name: '  ' } });
  check('令牌备注不可为空', tokenNameBad.status === 400, 'status=' + tokenNameBad.status);
  if (myTok) {
    const crossRevoke = await req('DELETE', '/api/agent/tokens/' + myTok.id, { token: student7Token });
    check('他人不能吊销我的令牌', crossRevoke.status === 404, 'status=' + crossRevoke.status);
    const revoke = await req('DELETE', '/api/agent/tokens/' + myTok.id, { token: student6Token });
    check('本人可吊销令牌', revoke.status === 200, 'status=' + revoke.status);
    const listAfter = await req('GET', '/api/agent/tokens', { token: student6Token });
    const still = ((listAfter.data || {}).tokens || []).find(function (t) { return t.id === myTok.id; });
    check('吊销后令牌标记为 revoked', !!still && !!still.revoked_at, JSON.stringify(still || {}).slice(0, 120));
  } else {
    check('拿到新建令牌的 id', false, 'token not found in list');
  }

  console.log('\n================ 验收结果 ================');
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  if (failures.length) { console.log('失败项：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('E2E_ERROR:', e && e.message); process.exit(2); });