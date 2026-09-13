#!/usr/bin/env node
/**
 * 合成"工具调用"训练数据集（本地跑，不花钱）
 *
 * 目标：把 4B 模型的主要失败模式训掉 —— 实测 155 条评测里 22 条失败，
 * 其中 **11 条是"该动手却用文字回答"**，另有 4 条选错工具、1 条日期算错。
 * 这些都是**行为契约**问题，正是 SFT 最擅长的；不是知识或推理问题。
 *
 * 三个关键设计：
 *
 * 1. **格式与线上完全一致**：用真实的工具目录（从 app 取，按角色裁剪）、真实的静态
 *    system prompt、真实的日期锚点。格式对齐 LLaMA-Factory 的 ShareGPT+tools：
 *    system / human → function_call → observation → gpt。
 *    训练格式与推理格式不一致是微调最常见的白费功夫。
 *
 * 2. **绝不与评测集重叠**：评测集（tests/eval/cases.mjs 的 155 条）是验收门禁，
 *    一旦泄漏进训练集，成绩就毫无意义。生成后会做精确+近似重复检查，重叠就报错退出。
 *    本文件的措辞模板与评测集是**分开写的**，不是同一套。
 *
 * 3. **observation 用真实响应形状**：工具返回是模型要总结的输入。形状不对（比如乱编
 *    字段）会教模型总结不存在的东西。这里按各工具的真实返回结构造，值用合成数据。
 *
 * 用法：
 *   node scripts/gen-agent-dataset.js --out /tmp/agent-dataset --per-intent 12
 *   node scripts/gen-agent-dataset.js --out /tmp/x --check-only   # 只做重叠检查
 */
const fs = require('fs');
const path = require('path');

function argv(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
}
const OUT_DIR = argv('--out', '/tmp/agent-dataset');
const PER_INTENT = Number(argv('--per-intent', 10));
const CHECK_ONLY = process.argv.includes('--check-only');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const app = require('../app');
const { buildTools, agentCatalog, toOpenAiTools } = require('../services/agent/toolCatalog');
const { buildSystemPrompt, dateAnchors } = require('../services/agent/persona');
const { CASES } = require('../tests/eval/cases.mjs');

// ---------------------------------------------------------------- 词汇库
// 与评测集刻意不同措辞：评测集用的是"最短最自然"的说法，这里用更啰嗦/更口语的
const ASK = ['麻烦帮我', '能不能帮我', '帮我', '给我', '我想', '我要', '看一下', '瞅一眼', '问一下', '查查', ''];
const TAIL = ['', '吧', '啊', '呢', '谢谢', '拜托了', '可以吗', '行吗'];
const TEAM = ['咱们队', '中队', '区队', '队里'];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
/** 可复现的伪随机（同一 seed 生成同一份数据，便于复现与对比） */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260913);

// ---------------------------------------------------------------- 日期
function dayStr(offset) {
  const t = new Date(Date.now() + offset * 86400000);
  return t.toISOString().slice(0, 10);
}
function nextMonday() {
  const dow = new Date().getUTCDay();
  return dayStr(((8 - dow) % 7) || 7);
}

// ---------------------------------------------------------------- 意图定义
// 每个意图：工具名 + 参数生成 + 用户措辞模板 + 结果摘要模板
// 注意：这里的措辞与 tests/eval/cases.mjs **不是同一套**（那里是验收集）
const INTENTS = [
  {
    id: 'points-mine', role: 0, tool: 'my_points', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['看看我积分情况', '我积分多少了', '我的分数怎么样了', '积分那边什么情况'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, total: 125, records: [{ score: 10, reason: '参加晨练', created_at: dayStr(-3) }, { score: 5, reason: '完成作业', created_at: dayStr(-5) }] }),
    sum: (a, o) => `你当前积分 **${o.total}** 分。最近两笔：+${o.records[0].score}（${o.records[0].reason}）、+${o.records[1].score}（${o.records[1].reason}）。`
  },
  {
    id: 'points-rank', role: 0, tool: 'points_ranking', args: () => ({ limit: 10 }),
    say: () => [pick(ASK, rnd), pick(['积分排名情况', '排行那边什么情况', '大家分数怎么样', '排名怎么样'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, ranking: [{ name: '张伟', score: 130 }, { name: '李娜', score: 128 }, { name: '我', score: 125 }] }),
    sum: (a, o) => `排行榜前三：${o.ranking.map((r, i) => `${i + 1}. ${r.name} ${r.score} 分`).join('，')}。`
  },
  {
    id: 'notice-list', role: 0, tool: 'list_notices', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['通知那块有什么新东西', '有新的通知吗', '帮我看看通知那块', '通知有没有更新'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, notices: [{ id: 3, title: '关于周末大扫除的安排', is_todo: 1 }, { id: 2, title: '体检通知', is_todo: 0 }] }),
    sum: (a, o) => `共有 ${o.notices.length} 条通知，其中《${o.notices[0].title}》需要你点完成。`
  },
  {
    id: 'homework-list', role: 0, tool: 'my_homework', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['作业那块什么情况', '有哪些作业要做', '作业安排', '我作业交齐了没'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, homeworks: [{ title: '军事理论作业', deadline: dayStr(2) + ' 18:00:00' }] }),
    sum: (a, o) => `你有 ${o.homeworks.length} 项作业，最近一项《${o.homeworks[0].title}》截止 ${o.homeworks[0].deadline}。`
  },
  {
    id: 'leave-mine', role: 0, tool: 'my_leaves', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['我请假那块什么情况', '请假那边有结果了吗', '我之前请的假怎么样了', '查一下我的请假'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, leaves: [{ id: 12, leave_type: '早操', status: 1, start_time: dayStr(-1) + ' 06:00:00' }] }),
    sum: (a, o) => `你最近一条请假：${o.leaves[0].leave_type}（${o.leaves[0].start_time}），状态：已通过。`
  },
  {
    id: 'expense-mine', role: 0, tool: 'my_expenses', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['队费什么情况', '班费那边怎么样', '我报销那笔有信儿了吗', '班费账目'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, balance: 1234.5, expenses: [{ amount: 35, purpose: '扫把', status: 1 }] }),
    sum: (a, o) => `班费余额 **${o.balance}** 元。你最近一笔报销 ${o.expenses[0].amount} 元（${o.expenses[0].purpose}）已通过。`
  },
  {
    id: 'album-list', role: 0, tool: 'list_albums', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['相册那边有什么新照片', '照片那块', '咱们的照片在哪儿'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, albums: [{ id: 1, name: '军训留念', photo_count: 42 }] }),
    sum: (a, o) => `共有 ${o.albums.length} 个相册，其中《${o.albums[0].name}》有 ${o.albums[0].photo_count} 张照片。`
  },
  {
    id: 'vote-list', role: 0, tool: 'list_votes', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['投票那块什么情况', '有需要我投票的吗', '投票那边'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, votes: [{ id: 2, title: '周末活动选择', status: 'open' }] }),
    sum: (a, o) => `有 ${o.votes.length} 个投票进行中：《${o.votes[0].title}》。`
  },
  {
    id: 'lottery-list', role: 0, tool: 'list_lotteries', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['抽奖那块什么情况', '抽奖那边有没有动静', '有没有在搞抽奖'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, lotteries: [{ id: 1, title: '元旦抽奖', status: 'open' }] }),
    sum: (a, o) => `有 ${o.lotteries.length} 个抽奖：《${o.lotteries[0].title}》。`
  },
  {
    id: 'challenge-list', role: 0, tool: 'list_challenges', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['擂台那块什么情况', '擂台那边谁在守', '擂台挑战的情况'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, challenges: [{ id: 1, title: '引体向上擂台', holder: '王强' }] }),
    sum: (a, o) => `有 ${o.challenges.length} 个擂台，当前擂主：${o.challenges[0].holder}。`
  },
  {
    id: 'profile-mine', role: 0, tool: 'my_profile', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['我的档案信息', '我在哪个班', '账号那边' ], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, name: '张三', role: 0, class_name: '一区队' }),
    sum: (a, o) => `你是 ${o.name}，${o.class_name}，身份：学员。`
  },
  {
    id: 'roster-search', role: 0, tool: 'roster_search', args: () => ({ keyword: pick(['张三', '李四', '王五'], rnd) }),
    say: () => {
      const n = pick(['张三', '李四', '王五'], rnd);
      return [pick(ASK, rnd), pick([`${n}的资料`, `帮我搜${n}`, `${n}是哪个寝室的`, `${n}在册吗`], rnd), pick(TAIL, rnd)].join('');
    },
    obs: (a) => ({ success: true, members: [{ name: a.keyword, class_name: '一区队', role: 0 }] }),
    sum: (a, o) => `${o.members[0].name} 在 ${o.members[0].class_name}。`
  },
  {
    id: 'attendance-company', role: 0, tool: 'company_attendance', args: () => ({}),
    say: () => [pick(ASK, rnd), pick([`今天${pick(TEAM, rnd)}到了多少人`, '在队情况', '缺勤的有几个'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, total: 41, on_leave: 3, absent: 0 }),
    sum: (a, o) => `今天应到 ${o.total} 人，请假 ${o.on_leave} 人，缺席 ${o.absent} 人。`
  },

  // ---- 写操作（含日期换算）----
  {
    id: 'apply-leave', role: 0, tool: 'apply_leave',
    args: () => {
      const off = pick([1, 2, 3], rnd);
      return {
        type: pick(['早操', '早集合', '全休', '晚自习'], rnd),
        start_time: dayStr(off) + ' ' + pick(['06:00:00', '08:00:00', '14:00:00'], rnd),
        end_time: dayStr(off) + ' ' + pick(['06:30:00', '12:00:00', '18:00:00'], rnd),
        reason: pick(['肠胃不适', '亲属来队', '去校医院换药', '代表区队参赛'], rnd)
      };
    },
    say: (a) => {
      const when = a.start_time.slice(0, 10) === dayStr(1) ? '明天' : a.start_time.slice(0, 10) === dayStr(2) ? '后天' : a.start_time.slice(0, 10);
      return `${pick(ASK, rnd)}${when}想请个${a.type}的假，事由是${a.reason}${pick(TAIL, rnd)}`;
    },
    obs: () => ({ success: true, id: 88, status: 0 }),
    sum: () => `已提交请假申请，等待干部审批。`
  },
  {
    id: 'cancel-leave', role: 0, tool: 'cancel_leave', args: () => ({ id: 12 }),
    say: () => [pick(ASK, rnd), pick(['把假销了吧', '归队了帮我办下销假', '这次请假结束'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true }),
    sum: () => `已为你销假。`
  },
  {
    id: 'expense-create', role: 0, tool: 'create_expense',
    args: () => ({ amount: pick([12.5, 66, 88.8], rnd), purpose: pick(['买收纳箱', '买洗手液', '复印资料'], rnd) }),
    say: (a) => `${pick(ASK, rnd)}报销 ${a.amount} 元，${a.purpose}${pick(TAIL, rnd)}`,
    obs: () => ({ success: true, id: 21, status: 0 }),
    sum: () => `已提交报销申请，等待审批。`
  },
  {
    id: 'suggestion-create', role: 0, tool: 'submit_suggestion',
    args: () => ({ content: pick(['食堂排队时间太长，建议增加窗口', '宿舍热水供应时间太晚，建议提前', '操场照明不足，建议加装路灯'], rnd) }),
    say: (a) => `${pick(ASK, rnd)}提个建议：${a.content}${pick(TAIL, rnd)}`,
    obs: () => ({ success: true, id: 9 }),
    sum: () => `建议已匿名提交，干部看不到你的身份。`
  },
  {
    id: 'psych-create', role: 0, tool: 'create_psychological',
    args: () => ({ content: pick(['最近训练压力比较大，想找人聊聊', '睡眠不好，情绪低落', '和同学相处有些困扰'], rnd) }),
    say: (a) => `${pick(ASK, rnd)}申请心理辅导：${a.content}${pick(TAIL, rnd)}`,
    obs: () => ({ success: true, id: 5 }),
    sum: () => `心理援助申请已提交，只有授权人员能看到。`
  },

  // ---- 干部 ----
  {
    id: 'pending-leave', role: 1, tool: 'pending_leave_approvals', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['今天有什么等我处理', '有没有要我审的', '审批那边堆了多少'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, leaves: [{ id: 88, name: '张三', leave_type: '早操' }] }),
    sum: (a, o) => `有 ${o.leaves.length} 条待审批请假：${o.leaves[0].name}（${o.leaves[0].leave_type}）。需要我批准吗？`
  },
  {
    id: 'approve-leave', role: 1, tool: 'approve_leave',
    args: () => ({ id: 88, status: 1, approval_notes: '同意' }),
    say: () => [pick(ASK, rnd), pick(['张三的假给过了', 'id 88 那条批了吧', '这条请假通过'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true }),
    sum: () => `已批准该请假申请，申请人会收到通知。`
  },
  {
    id: 'publish-notice', role: 1, tool: 'publish_notice',
    args: () => ({ title: pick(['集合通知', '大扫除安排', '体检通知'], rnd), content: pick(['明天早上八点集合，请准时', '周五下午大扫除，带好工具', '下周三上午体检，空腹'], rnd), type: '通知' }),
    say: (a) => `${pick(ASK, rnd)}发个通知：${a.content}${pick(TAIL, rnd)}`,
    obs: () => ({ success: true, data: { id: 30 } }),
    sum: () => `通知已发布。`
  },
  {
    id: 'add-points', role: 1, tool: 'add_points',
    args: () => ({ user_id: pick([7, 9, 11], rnd), score: pick([1, 4, 5, -1], rnd), reason: pick(['主动帮厨', '内务优秀', '未按时归队', '训练积极'], rnd) }),
    say: (a) => `${pick(ASK, rnd)}给${pick(['赵六', '孙七', '周八'], rnd)}${a.score > 0 ? '加' : '扣'} ${Math.abs(a.score)} 分，${a.reason}${pick(TAIL, rnd)}`,
    obs: () => ({ success: true, id: 44 }),
    sum: (a) => `已为该同学${a.score > 0 ? '加' : '扣'} ${Math.abs(a.score)} 分。`
  },
  {
    id: 'company-leave-records', role: 1, tool: 'company_leave_records', args: () => ({}),
    say: () => [pick(ASK, rnd), pick(['今天在假的有谁', '请假明细那边', '谁还在假中'], rnd), pick(TAIL, rnd)].join(''),
    obs: () => ({ success: true, records: [{ name: '张三', leave_type: '全休' }] }),
    sum: (a, o) => `今日在假 ${o.records.length} 人：${o.records[0].name}（${o.records[0].leave_type}）。`
  }
];

// ---------------------------------------------------------------- 反例样本
// 这三类同样重要：追问、拒绝、不调工具。缺了它们，模型会变成"什么都去调工具"
const CLARIFY = [
  { role: 0, say: () => `我要请个假${pick(TAIL, rnd)}`, reply: '可以。请告诉我：①请假类型（早操/早集合/午集合/收假集合/晚自习/中队会/全休/其他）②起止时间 ③事由。' },
  { role: 0, say: () => '我想报个销', reply: '好的，请提供报销金额和用途，有发票的话也可以把凭证发给我。' },
  { role: 0, say: () => '帮我把那个改了', reply: '你说的是哪一条？可以把标题或者编号发我，我来处理。' },
  { role: 0, say: () => '给他加点分', reply: '给谁加、加多少、什么理由？告诉我这三项我就去办。' }
];
const REFUSE = [
  { role: 0, say: () => '把全队积分统一改成 60 分', reply: '这个操作我没有权限，也不应该批量改分。积分变动需要逐条记录事由，请联系区队长或辅导员处理。' },
  { role: 0, say: () => '张三那条假你直接给我过了', reply: '审批请假是干部权限，你这边没有这个权限。可以让区队长在 App 里处理。' },
  { role: 0, say: () => '给班费账上加一万块钱', reply: '班费账目不能手动改余额，只能通过收缴和报销流水变动。这条我不能做。' },
  { role: 0, say: () => '把这个同学移出中队', reply: '成员变动属于管理员权限，我无法执行。请联系辅导员。' }
];
const NO_TOOL = [
  { role: 0, say: () => pick(['在吗', '嗨', '早上好', '有人吗', 'Hello'], rnd), reply: '你好，我是区队管理助手。可以帮你查通知、作业、积分、班费，也能帮你请假、报销、提建议。' },
  { role: 0, say: () => pick(['多谢啦', '好的谢了', '麻烦你了'], rnd), reply: '不客气，还有别的要办的吗？' },
  { role: 0, say: () => pick(['外面下雨了吗', '明天冷不冷'], rnd), reply: '这个我查不到，我这边只能访问区队管理系统里的数据。' },
  { role: 0, say: () => pick(['你会做什么', '介绍一下你自己'], rnd), reply: '我是区队管理系统的办事助手。查通知/作业/积分/班费、请假、报销、提建议、看相册投票这些都可以直接跟我说。' },
  { role: 0, say: () => pick(['推荐个电影', '你会做饭吗'], rnd), reply: '这个我不太擅长，还是聊点和区队有关的事吧。' }
];

// ---------------------------------------------------------------- 防重叠
function normalize(s) {
  return String(s || '').replace(/[\s，。！？、,.!?【】\[\]]/g, '').toLowerCase();
}
/** 与评测集的精确/近似重复检查——泄漏了成绩就没意义了 */
function checkOverlap(phrasings) {
  const evalMsgs = new Set(CASES.map((c) => normalize(c.message)));
  const evalNorm = CASES.map((c) => normalize(c.message));
  const hits = [];
  for (const bare of phrasings) {
    const norm = normalize(bare);
    if (evalMsgs.has(norm)) { hits.push({ kind: 'exact', msg: norm }); continue; }
    for (const e of evalNorm) {
      // 只看"用户那句话"，不掺日期锚点；长度下限避免把"我的"这种短串当重叠
      if (e.length >= 6 && norm.includes(e)) { hits.push({ kind: 'contains-eval', msg: norm, eval: e }); break; }
    }
  }
  return hits;
}

// ---------------------------------------------------------------- 生成
async function buildCatalogs() {
  // 权限矩阵是**异步**加载的（app.js 启动时 loadPermissions()）。不等它加载完就构造目录，
  // 矩阵还是空的 → 所有受 requirePermission 控制的工具都会被裁掉（实测 roster_search 就这么消失）。
  // 这个坑很隐蔽：不受权限控制的工具照常在，只有受控的消失，看起来像"权限配错了"。
  await require('../shared/permissions').loadPermissions();
  const full = buildTools(app);
  const byRole = {};
  for (const role of [0, 1, 5]) {
    byRole[role] = { tools: toOpenAiTools(agentCatalog(full, { role })), sys: buildSystemPrompt({ role }) };
  }
  return byRole;
}

async function main() {
  const cats = await buildCatalogs();
  const anchors = dateAnchors();
  const samples = [];
  const phrasingIndex = []; // 只记"用户那句话"，用于与评测集做重叠检查

  const humanText = (say) => anchors + '\n' + say;

  for (const it of INTENTS) {
    const cat = cats[it.role];
    if (!cat || !cat.tools.some((t) => t.function.name === it.tool)) {
      throw new Error(`工具 ${it.tool} 在 role=${it.role} 的目录里不存在——意图表和权限裁剪不一致`);
    }
    for (let i = 0; i < PER_INTENT; i += 1) {
      const args = it.args();
      const say = it.say(args);
      phrasingIndex.push(say);
      const o = it.obs(args);
      samples.push({
        system: cat.sys,
        conversations: [
          { from: 'human', value: humanText(say) },
          { from: 'function_call', value: JSON.stringify({ name: it.tool, arguments: args }) },
          { from: 'observation', value: JSON.stringify(o) },
          { from: 'gpt', value: it.sum(args, o) }
        ],
        tools: JSON.stringify(cat.tools.map((t) => t.function))
      });
    }
  }

  // 反例：数量按比例（不要淹没"该动手"的正例，它是主要失败模式）
  const neg = Math.max(4, Math.round(PER_INTENT / 2));
  for (const group of [CLARIFY, REFUSE, NO_TOOL]) {
    for (let i = 0; i < neg; i += 1) {
      for (const g of group) {
        const cat = cats[g.role];
        const negSay = g.say();
        phrasingIndex.push(negSay);
        samples.push({
          system: cat.sys,
          conversations: [
            { from: 'human', value: humanText(negSay) },
            { from: 'gpt', value: g.reply }
          ],
          tools: JSON.stringify(cat.tools.map((t) => t.function))
        });
      }
    }
  }

  const hits = checkOverlap(phrasingIndex);
  console.log('生成样本数:', samples.length);
  console.log('与评测集重叠:', hits.length);
  if (hits.length) {
    console.error('❌ 训练集与评测集重叠，成绩会失真。前几条：');
    for (const h of hits.slice(0, 5)) console.error('   ', h.kind, JSON.stringify(h).slice(0, 160));
    process.exit(1);
  }
  if (CHECK_ONLY) return;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'agent-tool-calling.jsonl');
  fs.writeFileSync(file, samples.map((s) => JSON.stringify(s)).join('\n') + '\n');
  // 随机抽样若干条供人工检查
  const previewN = Math.min(6, samples.length);
  const preview = [];
  for (let i = 0; i < previewN; i += 1) preview.push(samples[Math.floor(rnd() * samples.length)]);
  fs.writeFileSync(path.join(OUT_DIR, 'preview.json'), JSON.stringify(preview, null, 1));
  console.log('已写出:', file, '（' + (fs.statSync(file).size / 1024 / 1024).toFixed(2) + ' MB）');
  console.log('抽样预览:', path.join(OUT_DIR, 'preview.json'));
  console.log('正例 ' + INTENTS.reduce((n) => n + 1, 0) + ' 类意图 ×' + PER_INTENT + '；反例 ' + neg + ' 轮 ×' + (CLARIFY.length + REFUSE.length + NO_TOOL.length) + ' 条');
  process.exit(0);
}

main().catch((e) => { console.error('GEN_ERROR:', e.message); process.exit(1); });
