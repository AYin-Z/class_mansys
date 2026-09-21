/**
 * 多步 / 多轮行为评测 —— 与 run.mjs 的分工：
 *
 *   run.mjs      只发**一轮**请求，测「第一步有没有选对工具」
 *   本文件        跑**完整循环**（模型 → 工具 → 结果 → 模型 → …），测：
 *                   · 会不会串联（先查人再查记录）
 *                   · 会不会停在半路（查完名册就收尾）
 *                   · 会不会编造 id
 *                   · 会不会把内部 id 推给用户
 *                   · 多轮指代（「其中六区的单独列出来」）能不能接住
 *
 * 为什么用剧本化的工具结果而不是打真库：真实循环会写生产表（agent_conversations 等），
 * 不适合放进 CI/回归。行为问题（规划）与数据问题（工具返回对不对）是两件事，
 * 前者用剧本就能测准，后者由后端自己的测试覆盖。
 *
 * 用法：
 *   node tests/eval/multistep.mjs --base-url http://127.0.0.1:8090/v1 [--model m] [--json out.json]
 *   node tests/eval/multistep.mjs --only bare-name
 *
 * 场景定义见 multistep-cases.mjs，每条都标注了它来自哪次真实投诉。
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

// 后端是 CommonJS，本文件是 ESM：用 createRequire 把后端模块 require 进来
// （与 run.mjs 同一套做法，保证测的是线上真实目录与提示词）
const require = createRequire(import.meta.url);

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const app = require('../../app');
const { buildTools, agentCatalog, toOpenAiTools } = require('../../services/agent/toolCatalog');
const { buildSystemPrompt, buildUserContext } = require('../../services/agent/persona');

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};
const BASE_URL = String(arg('--base-url', process.env.EVAL_BASE_URL || '')).replace(/\/+$/, '');
const MODEL = arg('--model', 'eval');
const ONLY = arg('--only', '');
const OUT = arg('--json', '');
const MAX_STEPS = Number(arg('--max-steps', 6));
const TIMEOUT_MS = Number(arg('--timeout', 120000));

if (!BASE_URL) {
  console.log('[multistep] 未提供 --base-url，跳过（CI 环境没有本地模型端点）');
  process.exit(0);
}

/** 一次模型调用；返回 { content, toolCalls } */
async function callModel(messages, tools) {
  const body = {
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: 700,
    temperature: Number(process.env.EVAL_TEMPERATURE ?? 0)
  };
  if (process.env.EVAL_NO_THINK === '1') body.chat_template_kwargs = { enable_thinking: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer eval' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) return { error: 'HTTP ' + res.status };
    const data = await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return { content: msg.content || '', toolCalls: msg.tool_calls || [] };
  } catch (e) {
    return { error: (e && e.message) || 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** 跑一个场景：多轮用户输入 + 剧本化工具结果，返回工具序列与最终回复 */
async function runScenario(sc, cat) {
  const messages = [{ role: 'system', content: cat.sys }];
  const chain = [];
  const unknownTools = [];
  let reply = '';
  for (const turn of sc.turns) {
    messages.push({ role: 'user', content: cat.ctx + '\n' + turn });
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const out = await callModel(messages, cat.tools);
      if (out.error) return { chain, unknownTools, reply, error: out.error };
      const calls = out.toolCalls || [];
      if (!calls.length) {
        reply = out.content || '';
        messages.push({ role: 'assistant', content: reply });
        break;
      }
      messages.push({ role: 'assistant', content: out.content || null, tool_calls: calls });
      for (const call of calls) {
        const name = call.function && call.function.name;
        let args = {};
        try { args = JSON.parse((call.function && call.function.arguments) || '{}'); } catch (e) { /* 参数不是合法 JSON：照样记录 */ }
        const label = args && args.action ? name + ' ' + args.action : name;
        chain.push(label);
        // 剧本查表：先精确（工具+action），再通配（工具 *），再工具名本身
        let result = sc.tools[label];
        if (result === undefined && args && args.action) result = sc.tools[name + ' *'];
        if (result === undefined) result = sc.tools[name];
        if (result === undefined) {
          unknownTools.push(label);
          // 剧本没给这个调用的返回：明确标出来，方便补剧本（而不是让模型"猜"）
          result = { success: false, error: '剧本未覆盖该调用：' + label };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 4000) });
      }
    }
    // 多轮：上一轮若以工具调用结束而没有文字，补一个占位，避免 messages 结构不合法
    if (!reply) reply = '';
  }
  return { chain, unknownTools, reply };
}

async function main() {
  const { SCENARIOS } = await import('./multistep-cases.mjs');
  await require('../../shared/permissions').loadPermissions();
  const full = buildTools(app);
  const catalogs = {};
  for (const role of [0, 1, 8]) {
    catalogs[role] = {
      tools: toOpenAiTools(agentCatalog(full, { role })),
      sys: buildSystemPrompt({ role }),
      ctx: buildUserContext({ name: '评测', role })
    };
  }

  const cases = SCENARIOS.filter((s) => !ONLY || s.id.startsWith(ONLY));
  const failures = [];
  let passed = 0;
  const t0 = Date.now();
  const detail = [];

  for (const sc of cases) {
    const cat = catalogs[sc.role] || catalogs[0];
    const r = await runScenario(sc, cat);
    const problems = [];
    if (r.error) problems.push('请求失败: ' + r.error);
    for (const want of sc.expectChain || []) {
      // 支持 'A OR B'（同一意图有 curated 与模块两条路）与 'ANY_QUERY'（只要动起来了）
      if (want === 'ANY_QUERY') {
        if (!r.chain.length) problems.push('一次工具都没调（该去查却只用文字回答）');
        continue;
      }
      const alts = want.split(' OR ').map((s) => s.trim());
      if (!alts.some((a) => r.chain.includes(a))) problems.push('缺少工具 ' + want);
    }
    for (const bad of sc.forbidChain || []) {
      if (r.chain.includes(bad)) problems.push('不该调用 ' + bad);
    }
    // warnChain：真正错但会自我纠正的（例如查别人时先误调了"我的请假"又改对）。
    // 它值得盯着，但不该让整个场景判失败——否则门禁会被噪音淹没。
    const warns = [];
    for (const soft of sc.warnChain || []) {
      if (r.chain.includes(soft)) warns.push('多余调用 ' + soft);
    }
    for (const re of sc.expectReply || []) {
      if (!re.test(r.reply)) problems.push('回复未命中 ' + re);
    }
    for (const re of sc.forbidReply || []) {
      if (re.test(r.reply)) problems.push('回复命中禁忌 ' + re + '：' + r.reply.slice(0, 80));
    }
    if (sc.noTool && r.chain.length) problems.push('不该调工具却调了 ' + r.chain.join(','));
    detail.push({ id: sc.id, role: sc.role, chain: r.chain, reply: r.reply.slice(0, 300), problems, warns });
    if (problems.length) failures.push({ id: sc.id, problems });
    else passed += 1;
  }

  const total = cases.length;
  const score = total ? Math.round((passed / total) * 1000) / 10 : 0;
  console.log('\n=== 多步 / 多轮行为评测 ===');
  console.log(`  端点 ${BASE_URL}  模型 ${MODEL}`);
  console.log(`  场景 ${total} 个，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  通过 ${passed}/${total} = ${score}%   （门禁线 90%）`);
  const allWarns = detail.filter((d) => d.warns && d.warns.length);
  if (allWarns.length) {
    console.log('\n  警告（不判失败，但值得盯）:');
    for (const d of allWarns) console.log(`   ⚠️  ${d.id} —— ${d.warns.join('；')}`);
  }
  if (failures.length) {
    console.log('\n  失败明细:');
    for (const f of failures) console.log(`   ❌ ${f.id} —— ${f.problems.join('；')}`);
  }
  if (process.env.MULTISTEP_TRACE === '1') {
    console.log('\n  全过程:');
    for (const d of detail) console.log(`   · ${d.id} [${d.chain.join(' → ') || '无工具'}] ${d.reply.replace(/\n/g, ' ').slice(0, 120)}`);
  }
  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify({ baseUrl: BASE_URL, model: MODEL, total, passed, score, failures, detail, at: new Date().toISOString() }, null, 1));
    console.log('  结果已写入 ' + OUT);
  }
  const min = Number(arg('--min-score', 90));
  process.exit(score >= min ? 0 : 1);
}

main().catch((e) => {
  console.error('[multistep] 异常: ' + ((e && e.stack) || e));
  process.exit(1);
});
