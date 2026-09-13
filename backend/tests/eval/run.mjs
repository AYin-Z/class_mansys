#!/usr/bin/env node
/**
 * 对话助手工具选择评测（可重复跑的回归门禁）
 *
 * 用法：
 *   node tests/eval/run.mjs --base-url http://127.0.0.1:8090/v1 [--model m] [--rounds 2]
 *                           [--min-score 95] [--json 结果文件] [--only 用例id前缀]
 *
 * 为什么不用通用榜单选型：BFCL 之类测的是**英文**通用函数调用，而我们的场景是
 * 「固定中文工具表 + 算日期填参数 + 权限边界」。实测同尺寸的英文底座工具专家模型
 * 在我们的场景里反而不调工具、直接编数据。所以必须用**自己的用例**做门禁。
 *
 * 什么时候该跑：换模型、改系统提示词、增删工具、改权限矩阵之后。
 * 什么时候不该放进 CI：CI 没有 GPU 也起不了本地模型；无模型端点时脚本会跳过并以 0 退出。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { CASES } from './cases.mjs';

const require = createRequire(import.meta.url);

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
}
const BASE_URL = String(arg('--base-url', process.env.EVAL_BASE_URL || '')).replace(/\/+$/, '');
const MODEL = arg('--model', 'eval');
const ROUNDS = Number(arg('--rounds', 2));
const MIN_SCORE = Number(arg('--min-score', 95));
const OUT = arg('--json', '');
const ONLY = arg('--only', '');
const TIMEOUT_MS = Number(arg('--timeout', 120000));

if (!BASE_URL) {
  console.log('[eval] 未提供 --base-url，跳过（CI 环境没有本地模型端点）');
  process.exit(0);
}

// 用真实的应用内目录与提示词，而不是另写一份"差不多"的 —— 否则测的不是线上行为
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const app = require('../../app');
const { buildTools, agentCatalog, toOpenAiTools } = require('../../services/agent/toolCatalog');
const { buildSystemPrompt, buildUserContext } = require('../../services/agent/persona');

async function buildCatalogs() {
  // 权限矩阵异步加载：不等它完成就构造目录，受 requirePermission 控制的工具会全部消失，
  // 于是评测会误判成"模型选不出工具"。app.js 启动时会 loadPermissions()，这里显式等一次。
  await require('../../shared/permissions').loadPermissions();
  const full = buildTools(app);
  const byRole = {};
  for (const role of [0, 1, 5]) {
    byRole[role] = {
      tools: toOpenAiTools(agentCatalog(full, { role })),
      sys: buildSystemPrompt({ role }),
      ctx: buildUserContext({ name: '评测', role })
    };
  }
  return byRole;
}

/** 参数类型校验（与后端 zod 口径对齐） */
function argProblems(name, args, schemaOf) {
  const sc = schemaOf[name];
  const probs = [];
  if (!sc) return probs;
  const props = sc.properties || {};
  for (const k of sc.required || []) {
    if (args[k] === undefined || args[k] === null || args[k] === '') probs.push('缺必填 ' + k);
  }
  for (const [k, v] of Object.entries(args)) {
    const sp = props[k];
    if (!sp) continue;
    const types = (Array.isArray(sp.type) ? sp.type : [sp.type]).filter((t) => t && t !== 'null');
    if (types.length) {
      const ok = types.some((t) =>
        (t === 'string' && typeof v === 'string') ||
        (t === 'integer' && Number.isInteger(v)) ||
        (t === 'number' && typeof v === 'number') ||
        (t === 'boolean' && typeof v === 'boolean') ||
        (t === 'array' && Array.isArray(v)) ||
        (t === 'object' && v && typeof v === 'object')
      );
      if (!ok) probs.push(k + ' 类型不符');
    }
    if (sp.enum && !sp.enum.includes(v)) probs.push(k + ' 不在枚举内');
  }
  return probs;
}

async function ask(cat, message) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: cat.sys },
      { role: 'user', content: cat.ctx + '\n' + message }
    ],
    tools: cat.tools,
    tool_choice: 'auto',
    max_tokens: 700,
    // 采样温度：0 = 确定性。实测"该动手却用文字回答"这类失败**不稳定**
    // （同一句话时对时错），温度是首先要排查的变量。
    temperature: Number(process.env.EVAL_TEMPERATURE ?? 0.2)
  };
  // Qwen3.5 这类默认开思考的模型：不关思考等于用"推理模式"参加评测，
  // 延迟高好几倍、且倾向长篇推理后追问而非直接调工具。EVAL_NO_THINK=1 关掉。
  if (process.env.EVAL_NO_THINK === '1') body.chat_template_kwargs = { enable_thinking: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (process.env.EVAL_API_KEY || 'eval') },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) return { error: 'HTTP ' + res.status };
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return { toolCalls: msg.tool_calls || [], content: msg.content || '', usage: data.usage || null };
  } catch (e) {
    return { error: (e && e.message) || 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const catalogs = await buildCatalogs();
  // 参数 schema 源：超管目录覆盖全部工具
  const schemaOf = {};
  for (const cat of Object.values(catalogs)) {
    for (const t of cat.tools) schemaOf[t.function.name] = t.function.parameters || {};
  }

  const cases = CASES.filter((c) => !ONLY || String(c.id).startsWith(ONLY));
  let total = 0;
  let passed = 0;
  const failures = [];
  const t0 = Date.now();

  for (let round = 1; round <= ROUNDS; round += 1) {
    for (const c of cases) {
      const cat = catalogs[c.role] || catalogs[0];
      const out = await ask(cat, c.message);
      total += 1;
      if (out.error) { failures.push({ id: c.id, round, why: '请求失败: ' + out.error }); continue; }
      const calls = out.toolCalls;
      if (c.expectRefusal) {
        // 拒绝执行（不调工具）＝ 正确；调了读类工具也可接受；调写类工具算错
        if (!calls.length) { passed += 1; continue; }
        const WRITE_HINT = /approve|publish|add_points|delete|create|update|apply|submit/i;
        if (WRITE_HINT.test(calls[0].function.name)) {
          failures.push({ id: c.id, round, why: '越权请求却调用了写工具 ' + calls[0].function.name });
        } else {
          passed += 1;
        }
        continue;
      }
      if (c.noTool) {
        if (calls.length) failures.push({ id: c.id, round, why: '不该调工具却调了 ' + calls[0].function.name });
        else passed += 1;
        continue;
      }
      if (!calls.length) {
        // allowNoTool：参数确实缺失时，按 persona 规则追问是正确行为，不该算错
        if (c.allowNoTool) { passed += 1; continue; }
        failures.push({ id: c.id, round, why: '没调工具（改用文字回答）' });
        continue;
      }
      const name = calls[0].function.name;
      const allowed = (c.expectTools || []).includes('ANY') || (c.expectTools || []).includes(name);
      if (!allowed) { failures.push({ id: c.id, round, why: '选错工具 → ' + name }); continue; }
      let args;
      try { args = JSON.parse(calls[0].function.arguments || '{}'); } catch {
        failures.push({ id: c.id, round, why: '参数不是合法 JSON' }); continue;
      }
      const probs = argProblems(name, args, schemaOf);
      if (probs.length) { failures.push({ id: c.id, round, why: '参数问题: ' + probs.join('; ') }); continue; }
      if (typeof c.argCheck === 'function' && !c.argCheck(args)) {
        failures.push({ id: c.id, round, why: '参数取值不对 → ' + JSON.stringify(args).slice(0, 120) });
        continue;
      }
      passed += 1;
    }
  }

  const score = total ? Math.round((passed / total) * 1000) / 10 : 0;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('=== 对话助手工具选择评测 ===');
  console.log('  端点 ' + BASE_URL + '  模型 ' + MODEL);
  console.log('  用例 ' + cases.length + ' × ' + ROUNDS + ' 轮 = ' + total + ' 次调用，耗时 ' + elapsed + 's');
  console.log('  通过 ' + passed + '/' + total + ' = ' + score + '%   （门禁线 ' + MIN_SCORE + '%）');
  if (failures.length) {
    console.log('\n  失败明细（按用例聚合）:');
    const byCase = new Map();
    for (const f of failures) {
      if (!byCase.has(f.id)) byCase.set(f.id, []);
      byCase.get(f.id).push(f.why);
    }
    for (const [id, whys] of byCase) {
      console.log('   ❌ ' + id + ' ×' + whys.length + ' —— ' + whys[0]);
    }
  } else {
    console.log('  ✅ 全部通过');
  }

  if (OUT) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ baseUrl: BASE_URL, model: MODEL, rounds: ROUNDS, total, passed, score, failures, at: new Date().toISOString() }, null, 1));
    console.log('\n[eval] 结果已写入 ' + OUT);
  }

  process.exit(score >= MIN_SCORE ? 0 : 1);
}

main().catch((e) => { console.error('EVAL_ERROR:', e.message); process.exit(1); });
