#!/usr/bin/env node
/**
 * 一致性检查：**工具目录里有的，实际必须调得通**
 *
 * 为什么需要这个脚本：
 * 工具目录是从**路由中间件**的权限标注自动采集的（toolCatalog.collectRoutes 读
 * requirePermission 打的标记），但**控制器里可能还有第二道校验**，那样采集不到。
 * 实测踩过：学员目录里看得见 company_attendance / company_leave_records，
 * 一调就是 403「仅区队管理层可查看」——工具目录撒谎，助手白跑一轮，用户看到报错。
 * 根因是权限有两套定义（矩阵 vs 硬编码列表），已修（见 029 迁移 + shared/scope.js），
 * 但**这类问题不能靠人肉发现**，所以固化成可重复执行的检查。
 *
 * 怎么避免"检查本身产生写操作"：
 * - GET 工具：真实调用
 * - 非 GET 工具：发**空参数**。校验中间件（validateBody）在控制器之前跑，
 *   缺必填会返回 400/422 —— **400 恰好证明"权限这关过了"**，且没有产生任何写入。
 * - 模块工具的写 action 无法保证"空参数不会写"，所以跳过（只测 GET action）。
 *
 * 用法：
 *   node scripts/check-tool-permissions.js --base http://127.0.0.1:3002
 *   node scripts/check-tool-permissions.js            # 默认本机 3002
 * 退出码非 0 = 发现"目录里有但调不动"的工具
 */
const { env } = require('../config/env');

function argv(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
}
process.chdir(__dirname + '/..');

const BASE = String(argv('--base', 'http://127.0.0.1:' + (env.PORT || 3002))).replace(/\/+$/, '');
const db = require('../config/database');
const app = require('../app');
const { buildTools, agentCatalog, toOpenAiTools } = require('../services/agent/toolCatalog');
const { resolveTarget } = require('../services/agent/toolRunner');
const authService = require('../services/authService');

const ROLES = [0, 1, 2, 5, 8];

async function callOnce(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* 非 JSON */ }
  return { status: res.status, data };
}

/**
 * 被限流（429）时必须重试：**429 会掩盖真实的 403**，
 * 那样检查就会误报"没问题"，比不检查更糟。重试后仍 429 则标记为"无法判定"。
 */
// 请求间隔：线上限流是 600 请求 / 15 分钟 / IP（app.js），本检查一遍约 230 个请求。
// 加 400ms 间隔是为了"不把预算一次吃满"，也避免与真实用户流量互相挤；
// 注意：**15 分钟内重复跑多次仍会被限流**，那时结果会标成"无法判定"而不是通过。
const GAP_MS = Number(process.env.CHECK_GAP_MS || 400);

async function call(method, path, token, body) {
  await new Promise((r) => setTimeout(r, GAP_MS));
  for (let i = 0; i < 3; i += 1) {
    const r = await callOnce(method, path, token, body);
    if (r.status !== 429) return r;
    await new Promise((res) => setTimeout(res, 2500 * (i + 1)));
  }
  return { status: 429, data: { error: '被限流，重试后仍 429：本次无法判定' } };
}

(async () => {
  const perms = require('../shared/permissions');
  await perms.loadPermissions(); // 矩阵异步加载，不等它构造目录会误裁工具
  const full = buildTools(app);

  let problems = 0;
  let warns = 0;
  let checked = 0;

  for (const role of ROLES) {
    const [rows] = await db.query('SELECT * FROM users WHERE role = ? LIMIT 1', [role]);
    const user = rows[0];
    if (!user) { console.log(`role=${role} 没有测试用户，跳过`); continue; }
    const token = authService.signToken(user);
    const tools = toOpenAiTools(agentCatalog(full, { role }));
    console.log(`\n=== role=${role}（${user.name}）目录 ${tools.length} 个工具 ===`);

    for (const t of tools) {
      const name = t.function.name;
      const tool = full.byName.get(name);
      const target = resolveTarget(tool, {});
      const isModule = tool.kind === 'module';

      // 模块工具：只测 GET action（写 action 无法保证空参数不产生写入）
      let method = target.method;
      let path = target.path;
      let skipReason = null;
      if (isModule) {
        const action = (tool.actions || []).find((a) => a.startsWith('GET '));
        if (!action) { skipReason = '模块只有写 action，跳过'; }
        else { method = 'GET'; path = action.slice(4); }
      } else if (method && method !== 'GET') {
        // 非 GET：发空参数，期待校验失败（400/422）——那证明权限这关过了
        method = tool.method; path = tool.path;
      }
      if (!method || !path) { skipReason = '无法解析出端点'; }
      if (skipReason) { console.log(`  - ${name.padEnd(24)} 跳过（${skipReason}）`); continue; }

      checked += 1;
      const r = await call(method, path, token, {});
      const msg = String((r.data && r.data.error) || '');
      if (r.status === 401 || r.status === 403) {
        // 区分「权限问题」与「需要额外输入」：
        // 前者是目录撒谎（路由权限与控制器校验不一致），必须修；
        // 后者只是这次没带够参数（例如匿名建议的 view_token），工具本身可用，算警告。
        const looksPermission = /权限|无权|仅.*可|禁止|forbidden|unauthorized/i.test(msg);
        if (looksPermission) {
          problems += 1;
          console.log(`  ❌ ${name.padEnd(24)} ${method} ${path} → ${r.status} ${msg}`);
          console.log(`     ↑ 工具目录里有它，但权限上根本调不动——目录在撒谎`);
        } else {
          warns += 1;
          console.log(`  ⚠️  ${name.padEnd(24)} ${method} ${path} → ${r.status} ${msg}（需要额外输入，不是权限问题）`);
        }
      } else if (r.status === 429) {
        warns += 1;
        console.log(`  ⚠️  ${name.padEnd(24)} ${method} ${path} → 429 被限流，本次无法判定（不能当作通过）`);
      } else {
        console.log(`  ✅ ${name.padEnd(24)} ${method} ${path} → ${r.status}`);
      }
    }
  }

  console.log(`\n检查 ${checked} 个端点：${problems} 处权限不一致（必须修），${warns} 处需要额外输入（警告）`);
  if (problems) {
    console.log('修法：要么把控制器的额外校验并入权限矩阵，要么把这个工具从目录里摘掉——不能两套定义并存。');
  }
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error('CHECK_ERROR:', e.message); process.exit(1); });
