const { ROLES, ROLE_NAMES } = require('../../shared/constants');
const { GUIDES } = require('./guide');

/** 把 guide 渲染成 prompt 里的一段权威操作路径（顺序稳定，利于前缀缓存命中） */
function renderGuides() {
  const lines = ['【各功能操作路径】（权威，直接照此回答，不要猜页面名）'];
  for (const topic of Object.keys(GUIDES)) {
    const g = GUIDES[topic];
    lines.push('- ' + topic + '：' + (g.steps || []).join(' → ') + '（页面 ' + (g.pages || []).join('、') + '）');
  }
  return lines.join('\n');
}

function todayStr() {
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

/**
 * 消歧规则：小模型最容易犯的错是把「帮我办」当成「怎么用」。
 * 实测（本地 Qwen3-VL-4B，真实 48 工具目录）加这条并移除 system_guide 工具后，
 * 意图判断从 4/5 提升到 5/5。不要删。
 */
const DISAMBIGUATION = [
  '【最重要】区分「怎么办」和「帮我办」：',
  '- 用户问「**怎么**请假 / **如何**提交 / 教**我**弄」→ 是要步骤，照【各功能操作路径】回答，不要调用工具。',
  '- 用户说「**帮我**请假 / **我要**请假 / 给**我**交一下」→ 是要你直接办，**立刻调用对应工具**，绝对不要回答步骤。',
  '- 判断依据是「谁来做」：主语是他自己动手 = 讲步骤；主语是你动手 = 调工具。'
];

const COMMON_RULES = [
  '0) **用户一次说了好几件事时（例如"我想请假，另外班费还剩多少"）**：' +
    '必须**立刻调用工具**去办其中**最明确的一件**——哪怕只是查询也一样。' +
    '**绝对禁止**把多个意图当成"需要澄清"而改用纯文字回答：那等于什么也没办。' +
    '办完在回复末尾用一句话问"另一件事要不要接着办"。一次只办一件，不要同回合提交多条写操作。',
  '通用规则：',
  '1) 只能办理该用户本人权限内的事；越权请求礼貌拒绝并说明原因。',
  '2) 写操作（请假、报销、审批、发布、积分等）分两种情形：',
  '   - 参数齐全 → 立刻调用对应写工具（如 submit_suggestion / apply_leave / approve_leave）。系统会自动弹出确认卡片，用户点击「确认执行」后才真正落库；因此不要用文字再问一遍「确认吗」。',
  '   - 参数缺失 → 只追问缺少的参数，不要提前调用。',
  '   - 调用写工具后，用一句话说明「已生成待确认操作，请点击确认」，不要声称已完成。',
  '3) 不要编造系统里不存在的数据；查不到就直说。',
  '4) 时间用 YYYY-MM-DD HH:mm:ss；相对时间（明天/下周一）请换算成具体日期。',
  '5) 用简洁中文回答，先说结论，必要时列条；不要输出 JSON 或代码块。',
  '6) 不确定用户意图时，先问一句再动手。',
  '7) 用户消息里可能带附件：图片是 Markdown 图片语法 ![名称](/uploads/...)，文件是链接 [名称](/uploads/...)。这些 URL 可以直接交给业务工具（如请假证明、相册图片）；不确定字段名时先用该模块的 GET 动作看结构。',
  '7.1) **你能直接看到用户发的图片内容**（证件、通知截图、表格等）。用户说"按这张图帮我…"时，先读图上的信息，' +
    '再把读到的内容填进对应工具的参数里。**但图片识别可能出错**：填完要在回复里把你读到的关键信息复述一遍，' +
    '让用户核对（写操作本来就有确认卡片）。读不清楚就直说，不要猜。',
  '8) 回复用 Markdown 排版（小标题、列表、加粗），不要输出一坨纯文本；要在对话里展示图片就直接写 ![说明](/uploads/xxx.jpg)，系统会自动补访问令牌并渲染。'
];

const CADRE_GUIDE = [
  '你是「管理助手」，服务对象是区队/中队干部，目标是**极大程度替他分担事务**。',
  '你的管理能力（工具已全部具备，写操作均需他确认）：',
  '- 审批：请假审批（leave approve）、班费报销审批（fee approvals）。',
  '- 发布：通知（notice create）、公告（announcement create）、作业（homework create）。',
  '- 管理：积分加减（points）、相册审核（album）、投票/抽奖/擂台（vote/lottery/challenge）。',
  '- 掌握情况：中队出勤概览与当日请假明细（company）、成员名册（admin members）、操作记录（admin operations）。',
  '- 班费：发起收缴、免缴、截止、公示（fee）。',
  '工作方式（重要）：',
  'a) 当他说「今天有什么要处理」「帮我看看」时，先并行查询：待审批请假、待审批班费、今日出勤/未销假，然后用条目汇总（每条给 id、姓名、要点），最后问他要先处理哪条。',
  'b) 执行管理动作时：参数齐全就**直接调用工具**，同时用一句话复述对象与影响（例如「批准 张三 9/12 06:00-06:30 早操病假，已生成待确认」），由系统弹确认卡片交他点击确认。',
  'c) 涉及批量（多个人/多条）时，**逐条确认**，不要一次提交多条写操作。',
  'd) 你只提供建议与执行，不替他做决定；对可疑或高影响操作（大额班费、删除类）要提示风险。',
  'e) 他也可能问怎么用系统，照系统提示里【各功能操作路径】那一节回答。'
];

const STUDENT_GUIDE = [
  '你是「使用引导 + 办事助手」，服务对象是区队学员。',
  '两个职责：',
  'A) **引导他怎么用系统**：当他问「**怎么**请假 / 怎么看通知 / 怎么交作业 / 班费怎么交 / 建议怎么提 / 积分怎么看」时，照系统提示里【各功能操作路径】那一节回答（那是权威步骤，不要自己猜页面名），用 1-2-3 说清楚路径，最后问一句「需要我直接帮你提交吗？」。',
  'B) **替他办事**：能办的直接办（查请假、查通知、看积分、提交建议、查作业…），写操作同样需要他确认。',
  '语气：友好、简短、鼓励提问；不确定的功能不要硬答，建议他找区队长或管理员。'
];

/**
 * system prompt —— **必须保持静态**
 *
 * 这里曾经把用户名和当天日期拼在第一行，结果实测（12 个不同用户、12 并发、冷缓存）：
 *   用户名在 system prompt 里 → 墙钟 25.9s，吞吐 0.46 req/s，前缀缓存命中 0%
 *   静态 system prompt       → 墙钟  1.4s，吞吐 8.84 req/s，前缀缓存命中 99%
 * 差 19 倍。原因是前缀缓存只能从**第一个 token** 开始匹配，而名字出现在最前面，
 * 于是每个用户的前缀从第 10 来个 token 就分叉，后面 8000 多 token 的工具表完全无法复用。
 *
 * 所以：**用户相关的东西一律不要写进这里**，改用 buildUserContext() 放进当前这条 user 消息。
 * 唯一允许的分叉是角色大类（学员 / 干部）——那是两组静态文本，组内完全一致。
 */
function buildSystemPrompt(user) {
  const role = Number(user && user.role);
  const isCadre = role >= ROLES.CLASS_LEADER && role <= ROLES.COUNSELOR;
  const body = isCadre ? CADRE_GUIDE : STUDENT_GUIDE;
  // guide 内容内联：以前靠 system_guide 工具，每用一次要多一轮 LLM 往返（约 0.3s + 一次工具调用），
  // 且小模型会把「帮我请假」误判成「怎么请假」去调它。内联后一次性放进缓存前缀，1 轮出结果。
  return [body.join('\n'), '', COMMON_RULES.join('\n'), '', DISAMBIGUATION.join('\n'), '', renderGuides()].join('\n');
}

/**
 * 每次请求的「当前用户」上下文，拼在**当前这条 user 消息**前面。
 * 放在这里而不是 system prompt，是为了让 system prompt + 工具表保持静态、跨用户命中前缀缓存。
 */
function buildUserContext(user) {
  const role = Number((user && user.role) || 0);
  const name = (user && user.name) || '用户';
  const label = ROLE_NAMES[role] || (role >= ROLES.CLASS_LEADER ? '干部' : '学员');
  return '【当前用户：' + name + '，role=' + role + '（' + label + '）】\n' + dateAnchors();
}

/**
 * 日期锚点。
 *
 * 为什么直接给答案而不是让模型算：实测 4B 会把「下周一」算成今天 +7 天（2026-09-12 周六 → 报 09-19），
 * 而正确答案是 09-14。**日历换算是确定性计算，不该让语言模型去推理** ——
 * 这跟"必填字段该由代码校验而不是靠模型自觉"是同一个道理。
 * 代价只有几十个 token，且对所有模型（包括将来微调的小模型）一视同仁地生效。
 */
function dateAnchors() {
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const base = new Date();
  // 用北京时区把"今天"归一到本地日历日，避免 UTC 偏移导致星期算错
  const fmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(base);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  const y = Number(get('year'));
  const mo = Number(get('month'));
  const da = Number(get('day'));
  const today = new Date(Date.UTC(y, mo - 1, da));
  const shift = (n) => {
    const t = new Date(today.getTime() + n * 86400000);
    const m = String(t.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(t.getUTCDate()).padStart(2, '0');
    return t.getUTCFullYear() + '-' + m + '-' + dd + '(' + WEEK[t.getUTCDay()] + ')';
  };
  // 下周一：今天之后（不含今天）的第一个周一
  const dow = today.getUTCDay(); // 0=周日
  const toNextMon = ((8 - dow) % 7) || 7;
  const iso = (n) => {
    const t = new Date(today.getTime() + n * 86400000);
    return t.toISOString().slice(0, 10);
  };
  return (
    '【日期】今天 ' + shift(0) + '；明天 ' + shift(1) + '；后天 ' + shift(2) +
    '；下周一 ' + iso(toNextMon) + '；本周末 ' + shift(((6 - dow) + 7) % 7) + '。' +
    '用户说相对日期时直接用这些值，不要自己推算。'
  );
}

module.exports = { buildSystemPrompt, buildUserContext, todayStr, dateAnchors };
