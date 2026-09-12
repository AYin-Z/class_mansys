/**
 * 工具目录（Agent 的全部能力 = 用户手动可达的能力）
 *
 * 两类工具：
 * 1) 模块工具：由 Express 路由表自动生成（每模块一个，action 枚举 = 该模块真实端点），
 *    保证「手动可达 = 对话可达」，路由新增后自动出现，不会遗漏。
 * 2) 快捷工具：高频流程的友好封装（参数语义化），内部同样映射到真实端点。
 */

const MODULE_META = {
  '/api/auth': '账号：登录态、我的资料、改密（写操作）',
  '/api/users': '用户资料：查询与更新本人资料',
  '/api/leave': '请假：提交请假、我的请假、销假、审批（干部）',
  '/api/notice': '通知：列表/详情、标记已读完成、待办',
  '/api/announcement': '公告：列表/详情、发布（干部）、资源上传',
  '/api/album': '相册：相册与照片、上传与审核',
  '/api/fee': '班费：收缴、报销申请、审批、公示、汇总',
  '/api/homework': '作业：列表/详情、提交、批改（干部）',
  '/api/psychological': '心理：提交申请、我的申请、处理（干部）',
  '/api/challenge': '擂台：列表/详情、报名、裁判（干部）',
  '/api/vote': '投票：列表/详情、投票、创建与关闭（干部）',
  '/api/suggestion': '建议箱：匿名提交、我的提交、处理（干部）',
  '/api/lottery': '抽奖：列表/详情、参与、开奖（干部）',
  '/api/points': '积分：我的积分、排行、管理（干部）',
  '/api/classes': '班级列表',
  '/api/message': '留言：按目标查看与发表',
  '/api/admin': '管理后台：成员名册、操作记录、角色与请假配置（干部/超管）',
  '/api/app': 'App 版本信息',
  '/api/company': '中队：出勤概览、当日请假明细、区队列表（干部）'
};

const { systemGuide } = require('./guide');
const { hasPermission } = require('../../shared/permissions');

// 本地工具（不调用 HTTP）
const LOCAL_TOOLS = [
  {
    name: 'system_guide',
    kind: 'local',
    // inline=true：内容已内联进 persona 的 system prompt。
    // 对 LLM 不再暴露成工具（少一轮往返，且小模型不再把「帮我请假」误判成「怎么请假」）；
    // MCP 外部客户端没有 system prompt，仍然保留这个工具。
    inline: true,
    label: '系统使用引导',
    desc: '查询某个功能怎么用（步骤 + 页面路径）。topic 可取：请假/通知公告/作业/班费/建议箱/积分/心理/相册/投票抽奖擂台/账号/中队出勤',
    params: ['topic'],
    handler: systemGuide
  }
];

// 干部管理快捷工具（写操作需二次确认）
const CADRE_CURATED = [
  { name: 'pending_leave_approvals', label: '待审批请假', method: 'GET', path: '/api/leave/all', desc: '查看全部请假记录（需 VIEW_ROSTER 权限），可据此筛选待审批项' },
  { name: 'pending_fee_approvals', label: '待审批班费', method: 'GET', path: '/api/fee/approvals/pending', desc: '查看当前待我审批的班费申请' },
  { name: 'roster_search', label: '成员名册', method: 'GET', path: '/api/admin/members', desc: '按姓名/学号/手机号搜索本区队成员（需 VIEW_ROSTER 权限）', query: ['keyword'] },
  {
    name: 'publish_notice', label: '发布通知', method: 'POST', path: '/api/notice/create', write: true,
    desc: '发布通知（干部）。is_todo=true 时成员需点完成', body: ['title', 'content', 'type', 'is_todo', 'is_pinned']
  },
  {
    name: 'approve_leave', label: '审批请假', method: 'PUT', path: '/api/leave/approve', write: true,
    desc: '审批请假：status=1 通过，status=2 驳回；approval_notes 为批注', body: ['id', 'status', 'approval_notes']
  },
  {
    name: 'approve_expense', label: '审批班费申请', method: 'POST', path: '/api/fee/approvals/{id}', pathParams: ['id'], write: true,
    desc: '通过某条班费申请（干部），notes 为批注', body: ['notes']
  },
  {
    name: 'add_points', label: '积分加减', method: 'POST', path: '/api/points', write: true,
    desc: '给成员加/减积分（干部）。score 可为负数，reason 必填', body: ['user_id', 'score', 'reason']
  }
];

const QUERY_KEYS = ['date', 'class_id', 'company_id', 'status', 'category', 'keyword', 'limit', 'page', 'pageSize', 'ids', 'tokens', 'target_type', 'target_id'];

/** 快捷工具：高频流程 */
const CURATED = [
  { name: 'my_leaves', label: '我的请假记录', method: 'GET', path: '/api/leave/my', desc: '查看本人全部请假记录（含状态）' },
  {
    name: 'apply_leave', label: '提交请假申请', method: 'POST', path: '/api/leave/apply', write: true,
    desc: '提交请假申请。type 必须是后端配置的请假类型（如 早操/早集合/午集合/收假集合/晚自习/中队会/全休/其他），start_time/end_time 为 YYYY-MM-DD HH:mm:ss',
    body: ['type', 'start_time', 'end_time', 'reason', 'attachments']
  },
  { name: 'cancel_leave', label: '销假', method: 'PUT', path: '/api/leave/cancel/{id}', pathParams: ['id'], write: true, desc: '对本人某条请假记录销假（id 为请假记录 id）' },
  { name: 'my_expenses', label: '我的班费报销', method: 'GET', path: '/api/fee/expenses/my', desc: '查看本人提交的班费报销申请与审批状态' },
  {
    name: 'create_expense', label: '提交班费报销', method: 'POST', path: '/api/fee/expenses', write: true,
    desc: '提交班费报销申请。amount 为金额（元），purpose 为用途说明，proof_url 为已上传的证明材料地址（可选）',
    body: ['amount', 'type', 'purpose', 'details', 'semester', 'proof_url']
  },
  { name: 'my_points', label: '我的积分', method: 'GET', path: '/api/points/mine', desc: '查看本人积分明细与总分' },
  { name: 'points_ranking', label: '积分排行', method: 'GET', path: '/api/points/ranking', desc: '查看积分排行榜', query: ['limit'] },
  { name: 'list_notices', label: '通知列表', method: 'GET', path: '/api/notice', desc: '查看通知列表（含未读/待办状态）' },
  { name: 'notice_detail', label: '通知详情', method: 'GET', path: '/api/notice/{id}', pathParams: ['id'], desc: '查看某条通知详情（id 为通知 id）' },
  { name: 'my_homework', label: '作业列表', method: 'GET', path: '/api/homework', desc: '查看作业列表与截止时间' },
  {
    name: 'submit_suggestion', label: '写建议信', method: 'POST', path: '/api/suggestion', write: true,
    desc: '匿名提交建议/反馈（内容至少 5 个字）', body: ['content', 'category']
  },
  { name: 'company_attendance', label: '中队出勤概览', method: 'GET', path: '/api/company/overview', desc: '各区队出勤/请假/未销假统计（需 VIEW_COMPANY 权限）', query: ['date'] },
  { name: 'company_leave_records', label: '中队当日请假明细', method: 'GET', path: '/api/company/leave-records', desc: '当日跨区队请假明细（需 VIEW_COMPANY 权限）', query: ['date', 'company_id'] },
  { name: 'my_psychological', label: '我的心理申请', method: 'GET', path: '/api/psychological/mine', desc: '查看本人心理援助申请及处理状态' },
  { name: 'create_psychological', label: '提交心理申请', method: 'POST', path: '/api/psychological', write: true, desc: '提交心理援助申请（内容至少 3 字）', body: ['content'] },
  { name: 'list_albums', label: '相册列表', method: 'GET', path: '/api/album', desc: '查看区队相册' },
  { name: 'list_votes', label: '投票列表', method: 'GET', path: '/api/vote', desc: '查看投票列表（含本人是否已投）' },
  { name: 'list_lotteries', label: '抽奖列表', method: 'GET', path: '/api/lottery', desc: '查看抽奖活动' },
  { name: 'list_challenges', label: '擂台列表', method: 'GET', path: '/api/challenge', desc: '查看擂台挑战' },
  { name: 'my_profile', label: '我的资料', method: 'GET', path: '/api/auth/userinfo', desc: '查看本人账号资料与角色' }
];

function joinPath(prefix, p) {
  if (!p || p === '/') return prefix || '/';
  return (prefix || '') + (p.startsWith('/') ? p : '/' + p);
}

function collectRoutes(router, prefix, out) {
  const stack = (router && router.stack) || [];
  for (const layer of stack) {
    if (layer.route) {
      const full = joinPath(prefix, layer.route.path);
      // 从该路由的中间件里取 requirePermission 打的标记（无标记 = 登录即可访问）
      let perm = null;
      for (const mw of layer.route.stack || []) {
        const handle = mw && mw.handle;
        if (handle && handle.__permission) { perm = handle.__permission; break; }
      }
      for (const m of Object.keys(layer.route.methods || {})) {
        if (layer.route.methods[m]) out.push({ method: m.toUpperCase(), path: full, perm });
      }
    } else if (layer.handle && layer.handle.stack) {
      collectRoutes(layer.handle, prefix, out);
    }
  }
}

function normPath(p) {
  return String(p).replace(/\{[^}]+\}/g, ':p').replace(/:[A-Za-z0-9_]+/g, ':p');
}

function moduleKey(mount) {
  return mount.replace(/^\/api\//, '').replace(/[^a-z0-9_]/gi, '_');
}

function buildTools(app) {
  const mounts = (app.locals && app.locals.routeMounts) || [];
  const routes = [];
  for (const [mount, router] of mounts) {
    if (mount.startsWith('/api/agent') || mount.startsWith('/api/mcp')) continue; // 自身接口不暴露为工具
    collectRoutes(router, mount, routes);
  }

  const tools = [];
  const byName = new Map();

  // 1) 模块工具：action 枚举 = 真实端点
  for (const [mount] of mounts) {
    if (mount.startsWith('/api/agent') || mount.startsWith('/api/mcp')) continue;
    const list = routes.filter((r) => r.path.startsWith(mount + '/') || r.path === mount);
    if (!list.length) continue;
    const name = moduleKey(mount);
    const actions = list.map((r) => r.method + ' ' + r.path);
    const actionPerms = {};
    for (const r of list) actionPerms[r.method + ' ' + r.path] = r.perm || null;
    const tool = {
      name,
      module: mount,
      label: mount,
      description: (MODULE_META[mount] || mount) + '。可用 action：' + actions.join(' | '),
      kind: 'module',
      actions,
      actionPerms
    };
    tools.push(tool);
    byName.set(name, tool);
  }

  // 2) 本地工具（使用引导）
  for (const lt of LOCAL_TOOLS) {
    const tool = { ...lt, write: false };
    tools.push(tool);
    byName.set(tool.name, tool);
  }

  // 3) 快捷工具（含干部管理快捷项）
  for (const c of [...CURATED, ...CADRE_CURATED]) {
    const route = routes.find((r) => r.method === c.method && normPath(r.path) === normPath(c.path));
    if (!route) continue; // 路由不存在则不注册（保持与真实能力一致）
    const tool = { ...c, kind: 'curated', write: c.method !== 'GET', perm: route.perm || null };
    tools.push(tool);
    byName.set(c.name, tool);
  }

  return { tools, byName, routeCount: routes.length };
}

/**
 * 按用户权限裁剪工具目录（供 LLM 使用）
 *
 * 为什么必须裁：目录原本对所有角色一视同仁，学员也看得见 approve_leave / add_points /
 * publish_notice。实测把 48 个工具裁到学员白名单后，prompt 从 8738 tok 降到约 1700 tok，
 * 同一块 32K 上下文能开的并发槽位从 3 个变成 10 个；同时候选变少，误选也明显减少。
 *
 * 注意：**不要**在这里删 system_guide，它只是不从 LLM 工具表暴露（inline 标记），
 * MCP 外部客户端仍需要它（那些客户端没有 system prompt）。
 */
function agentCatalog(catalog, user, opts) {
  const keepInline = !!(opts && opts.keepInline);
  const allowed = (perm) => !perm || hasPermission(user, perm);
  const tools = [];
  const byName = new Map();
  for (const t of catalog.tools) {
    if (t.kind === 'local') {
      // inline 工具的正文已进 system prompt，对 LLM 不再暴露；但 MCP 外部客户端没有
      // system prompt，必须保留（keepInline=true）。
      if (t.inline && !keepInline) continue;
      tools.push(t);
      byName.set(t.name, t);
      continue;
    }
    if (t.kind === 'module') {
      const actions = t.actions.filter((a) => allowed((t.actionPerms || {})[a]));
      if (!actions.length) continue; // 该模块下没有他有权的端点 → 整个不给
      const filtered = { ...t, actions };
      tools.push(filtered);
      byName.set(filtered.name, filtered);
      continue;
    }
    if (!allowed(t.perm)) continue;
    tools.push(t);
    byName.set(t.name, t);
  }
  return { tools, byName, routeCount: catalog.routeCount, filtered: true };
}

/**
 * 是否需要二次确认（写操作）
 *
 * 关键：**模块工具**的 action 是真实端点（"POST /api/points" 这种），
 * 早期只判断 curated 的 tool.write，导致模型改用模块工具即可绕过确认卡片直接写库。
 * 现在统一按"解析后的 HTTP 方法"判定：非 GET 一律需要确认。
 */
function isWriteCall(tool, args) {
  if (!tool) return false;
  if (tool.kind === 'module') {
    const action = String((args && args.action) || '');
    const idx = action.indexOf(' ');
    const method = idx > 0 ? action.slice(0, idx) : '';
    return !!method && method.toUpperCase() !== 'GET';
  }
  if (tool.kind === 'local') return false;
  return !!tool.write;
}


/** 转成 OpenAI function-calling 工具格式 */
function toOpenAiTools(catalog) {
  return catalog.tools.map((t) => {
    if (t.kind === 'module') {
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: t.actions, description: '要调用的端点（METHOD path）' },
              params: { type: 'object', description: '写操作的请求体（POST/PUT/DELETE 时使用）' },
              query: { type: 'object', description: '查询参数（GET 时使用）' }
            },
            required: ['action']
          }
        }
      };
    }
    if (t.kind === 'local') {
      const lprops = {};
      for (const k of t.params || []) lprops[k] = { type: 'string', description: '参数 ' + k };
      return {
        type: 'function',
        function: {
          name: t.name,
          description: (t.label ? t.label + '：' : '') + (t.desc || ''),
          parameters: { type: 'object', properties: lprops, required: (t.params || []).slice(0, 1) }
        }
      };
    }
    const props = {};
    const required = [];
    for (const k of t.pathParams || []) {
      props[k] = { type: 'string', description: k };
      required.push(k);
    }
    for (const k of t.body || []) {
      props[k] = { type: ['string', 'number', 'array', 'object'], description: k };
      if (['type', 'start_time', 'end_time', 'amount', 'content', 'purpose'].includes(k)) required.push(k);
    }
    for (const k of t.query || []) {
      props[k] = { type: 'string', description: k };
    }
    return {
      type: 'function',
      function: {
        name: t.name,
        description: (t.label ? t.label + '：' : '') + (t.desc || ''),
        parameters: { type: 'object', properties: props, required }
      }
    };
  });
}

module.exports = { buildTools, agentCatalog, toOpenAiTools, isWriteCall, CURATED, CADRE_CURATED, LOCAL_TOOLS, MODULE_META, QUERY_KEYS };
