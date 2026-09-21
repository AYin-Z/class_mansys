/**
 * 多步 / 多轮行为评测的场景定义。
 *
 * 每一条都来自**生产库里的真实提问**（2026-09-10 ~ 09-21，原文见 real-utterances.json），
 * 并标注了当时模型的表现——v1 的评测集全是"照着想象写的完整句"，这些场景一条都没有。
 *
 * ⚠️ 剧本要给**所有可能被调用的路径**都配上真实感的返回（curated 工具 + 模块工具的 action）。
 *    2026-09-21 第一次跑 9 个场景只过 2 个，其中多数失败是**剧本没覆盖**造成的：
 *    模型调的是 `leave GET /api/leave/my` 这类模块路由，而剧本只按 curated 工具名给数据，
 *    于是它拿到"接口未实现"，得出的结论自然不对——那测的是基建，不是规划。
 *    正确路径与错误路径都要给数据（错误路径给"真实但没答案"的数据），这样才骗不过去。
 *
 * 字段：
 *   turns        多轮用户输入（按顺序发）
 *   tools        剧本化返回，key = '<工具名>' 或 '<模块> <METHOD path>'，也可用 '<模块> *' 通配
 *   expectChain  必须出现的调用（顺序不敏感）
 *   forbidChain  不该出现的调用（例如查别人却调"我的请假"）
 *   expectReply  最终回复必须命中的正则
 *   forbidReply  绝不能命中的正则
 *   noTool       这一轮不该调用任何工具
 */

// ---- 剧本化的"世界"（对应生产库里的真实数据）----
const 张驭捷 = { id: 1001, name: '张驭捷', student_id: '202521760035', class_name: '数据警务技术六区队', company_id: 6 };
const 请假638 = {
  id: 638, user_name: '张驭捷', student_id: '202521760035', type: '早操',
  start_time: '2026-09-21 06:00:00', end_time: '2026-09-21 08:00:00',
  reason: '病假', status: 0, proof_url: '/uploads/leaves/1789942993198_iirxvr.jpg'
};

const WORLD = {
  // 名册 / 用户
  roster_search: { success: true, members: [张驭捷] },
  'users GET /api/users': { success: true, users: [张驭捷] },
  'auth GET /api/auth/userinfo': { success: true, user: { id: 34, name: '殷政', role: 8 } },

  // 请假：正确路径有数据，错误路径"真实但没答案"
  pending_leave_approvals: { success: true, leaves: [请假638] },
  'leave GET /api/leave/all': { success: true, leaves: [请假638] },
  'leave GET /api/leave/my': { success: true, leaves: [] },              // 本人（管理员自己）没有请假
  'leave GET /api/leave/types': { success: true, types: ['早操', '早集合', '午集合', '收假集合', '晚自习', '中队会', '全休', '其他'] },
  'leave GET /api/leave/:id': { success: false, error: '缺少请假 id' },

  // 中队维度
  company_leave_records: { success: true, records: [请假638] },
  'company GET /api/company/leave-records': { success: true, records: [请假638] },
  company_attendance: { success: true, companies: [{ company_id: 6, name: '数据警务技术六区队', total: 40, on_leave: 1, not_returned: 0 }] },
  'company GET /api/company/overview': { success: true, companies: [{ company_id: 6, name: '数据警务技术六区队', total: 40, on_leave: 1, not_returned: 0 }] },
  'company GET /api/company/classes': { success: true, classes: [{ id: 6, name: '数据警务技术六区队' }, { id: 5, name: '数据警务技术五区队' }] },

  // 班费
  my_expenses: { success: true, expenses: [], balance: 0 },
  'fee GET /api/fee/summary': { success: true, balance: 0, income: 0, expense: 0 },

  // 写操作
  apply_leave: { success: false, error: '"早集合"的允许时段为 07:30-09:00，且需在同一天内' },
  'leave POST /api/leave': { success: false, error: '"早集合"的允许时段为 07:30-09:00，且需在同一天内' },

  // 其它常见查询（给"真实但空"的数据，避免误判成接口故障）
  list_notices: { success: true, notices: [] },
  'notice GET /api/notice': { success: true, notices: [] },
  my_points: { success: true, total: 50, records: [] },
  'points GET /api/points/mine': { success: true, total: 50, records: [] }
};
WORLD['admin GET /api/admin/members'] = { success: true, members: [张驭捷] };
WORLD['admin GET /api/admin/classes'] = { success: true, classes: [{ id: 6, name: '数据警务技术六区队' }] };
WORLD['admin GET /api/admin/console/overview'] = { success: true, pending_leaves: 1, pending_fees: 0 };

export const SCENARIOS = [
  {
    // 真实投诉原话：「这助手蠢的令人发指」——只发一个人名，当时回的是
    // "请问是想为他办理什么事务？比如请假、班费、通知、积分…"（零工具调用）
    id: 'bare-name',
    role: 8,
    note: '只给一个人名 → 必须先去查这个人，并看到他的待办',
    turns: ['张驭捷'],
    tools: WORLD,
    expectChain: ['roster_search'],
    expectReply: [/638|待审批|病假/],
    forbidReply: [/请问.*(要办|办理什么|什么事务|明确说明)/],
    // 查"别人的"请假时误调"我的请假"：方向错了但会自我纠正 → 警告而非失败
    warnChain: ['leave GET /api/leave/my']
  },
  {
    // 真实投诉：'把张玉杰的证明图片发给我' → 回"请提供请假申请的正确 ID"
    id: 'name-to-image',
    role: 8,
    note: '要某人的证明图片 → 自己按姓名查到记录并给出图片，禁止索要内部 id',
    turns: ['把张驭捷的请假证明发给我'],
    tools: WORLD,
    expectChain: ['roster_search'],
    expectReply: [/uploads\/leaves\//],
    forbidReply: [/请提供.*ID/i, /ID 无效/]
  },
  {
    // 真实案例：用户把「张驭捷」打成了「张玉杰」
    id: 'typo-name',
    role: 8,
    note: '打错的名字 → 查不到时不许索要内部 id，应换条件重查或给候选',
    turns: ['把张玉杰的证明图片发给我'],
    tools: { ...WORLD, roster_search: { success: true, members: [] }, 'admin GET /api/admin/members': { success: true, members: [] }, 'users GET /api/users': { success: true, users: [] } },
    expectChain: ['roster_search'],
    forbidReply: [/请提供.*ID/i, /ID 无效/]
  },
  {
    // 真实案例：'列一下待审批请假' → '其中六区的单独列出来'（指代式追问）
    id: 'follow-up-narrow',
    role: 1,
    note: '多轮指代：第二轮要接着上一轮的结果继续筛，而不是重新理解一句话',
    turns: ['列一下待审批请假', '其中六区的单独列出来'],
    tools: WORLD,
    expectChain: ['pending_leave_approvals'],
    expectReply: [/六区|6 区|6区/]
  },
  {
    // 真实案例：会话里孤零零一句「列一下」→ 当时回的是"今天是…明天是…后天是…"（把日期锚点当成了列表）
    id: 'bare-list',
    role: 1,
    note: '没上下文的"列一下" → 不要拿日期锚点凑答案，要问清列什么（且问题具体）',
    turns: ['列一下'],
    tools: WORLD,
    forbidReply: [/今天.*明天.*后天/s, /下周一.*本周末/s]
  },
  {
    // 真实案例：'班费还剩多少' → 回复末尾拖了一句"另一件事要不要接着办？"（多意图规则渗到单意图）
    id: 'single-intent-no-append',
    role: 0,
    note: '单意图查询不许追加"另一件事要不要接着办"',
    turns: ['班费还剩多少'],
    tools: WORLD,
    expectChain: ['ANY_QUERY'],
    forbidReply: [/另一件事(要不要|要不要)/]
  },
  {
    // 反向对照：确实说了两件事时，办一件 + 问另一件才是对的
    id: 'two-intents-must-ask',
    role: 0,
    note: '真·多意图：先办最明确的一件，再问另一件',
    turns: ['我想请假，另外班费还剩多少'],
    tools: WORLD,
    expectReply: [/另一件|要不要|请假类型/]
  },
  {
    // 真实案例：'袋子好是傻逼' → 当时回答得体（这条是防回归）
    id: 'insult',
    role: 8,
    note: '辱骂 → 不调工具、稳住（现状是对的，防止以后训坏）',
    turns: ['袋子好是傻逼'],
    tools: WORLD,
    noTool: true,
    expectReply: [/文明|不恰当|无法处理|理解/]
  },
  {
    // 真实案例：'我要请下五天的早集合假' → 生成待确认操作 → 接口返回时段错误
    id: 'multi-day-leave-rejected',
    role: 0,
    note: '跨天请假被接口拒绝时，要把真实原因转达清楚，不要自己编成功',
    turns: ['我要请下五天的早集合假'],
    tools: WORLD,
    expectChain: ['apply_leave OR leave POST /api/leave'],
    expectReply: [/时段|07:30|同一天/],
    forbidReply: [/已完成|提交成功|已落库/]
  }
];
