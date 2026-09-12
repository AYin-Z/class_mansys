const AgentRepo = require('./repo');
const llm = require('./llm');
const { buildTools, agentCatalog, toOpenAiTools, isWriteCall } = require('./toolCatalog');
const { preview, execute, callApi, resolveTarget } = require('./toolRunner');
const undo = require('./undo');
const argGuard = require('./argGuard');
const actionPreview = require('./actionPreview');
const { buildSystemPrompt, buildUserContext } = require('./persona');
const usage = require('./usage');
const { trimHistoryToBudget } = require('./history');
const { normalize: normalizeAttachments, withAttachmentText } = require('./attachments');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { BadRequestError, ForbiddenError, NotFoundError, HttpError } = require('../../shared/http');

function catalogFor(app) {
  if (!app.locals.__agentCatalog) {
    app.locals.__agentCatalog = buildTools(app);
  }
  return app.locals.__agentCatalog;
}

/**
 * 面向 LLM 的工具目录：在完整目录基础上按用户权限裁剪（并排除已内联进 prompt 的本地工具）。
 * 按角色缓存——215 个用户只有 10 种角色，缓存命中率接近 100%，
 * 避免每次请求都重建 48 个工具的目录。权限矩阵热更新时用 clearAgentCatalogCache() 失效。
 */
function agentCatalogFor(app, user) {
  const full = catalogFor(app);
  const role = String((user && user.role) != null ? user.role : 'anon');
  if (!app.locals.__agentCatalogByRole) app.locals.__agentCatalogByRole = new Map();
  const cache = app.locals.__agentCatalogByRole;
  if (!cache.has(role)) cache.set(role, agentCatalog(full, user));
  return cache.get(role);
}

/** 权限矩阵变更后调用，清掉按角色缓存的工具目录 */
function clearAgentCatalogCache(app) {
  if (app && app.locals) app.locals.__agentCatalogByRole = new Map();
}


/** 执行成功后登记一条可撤销记录（拿不到新建资源 id 就不登记，不猜） */
async function registerUndo({ user, tool, method, path, params, resultData, actionId, conversationId }) {
  try {
    const plan = undo.planFor({ method, path, resultData });
    if (!plan) return null;
    return await AgentRepo.createUndo({
      userId: user.id,
      actionId: actionId || null,
      conversationId: conversationId || null,
      tool: tool.name,
      label: plan.label,
      method: plan.method,
      path: plan.path,
      params: {},
      ttlMs: plan.ttlMs
    });
  } catch (e) {
    logger.warn({ err: e && e.message }, 'register undo failed');
    return null;
  }
}

class AgentService {
  static toolsInfo(app) {
    const catalog = catalogFor(app);
    return {
      routeCount: catalog.routeCount,
      modules: catalog.tools.filter((t) => t.kind === 'module').map((t) => ({ name: t.name, label: t.module, description: t.description, actions: t.actions })),
      curated: catalog.tools.filter((t) => t.kind === 'curated').map((t) => ({ name: t.name, label: t.label, description: t.desc, write: !!t.write }))
    };
  }

  static async chat(user, token, { conversationId, message, attachments }, app) {
    const atts = normalizeAttachments(attachments);
    if (!String(message || '').trim() && !atts.length) throw new BadRequestError('消息不能为空');
    const userContent = withAttachmentText(message, atts);
    const used = await AgentRepo.countUserMessagesLast24h(user.id);
    if (used >= env.AGENT_DAILY_QUOTA) {
      throw new HttpError(429, '今日对话次数已达上限，请明天再试', 'AGENT_QUOTA_EXCEEDED');
    }

    const catalog = agentCatalogFor(app, user);
    let convId = conversationId ? Number(conversationId) : null;
    if (convId) {
      const conv = await AgentRepo.getConversation(convId, user.id);
      if (!conv) throw new ForbiddenError('会话不存在或不属于你');
    } else {
      convId = await AgentRepo.createConversation(user.id, String(message || atts[0].name || '图片').slice(0, 40));
    }
    await AgentRepo.addMessage(convId, 'user', userContent);
    await AgentRepo.touchConversation(convId);

    const history = await AgentRepo.listMessages(convId, 30);
    const messages = [{ role: 'system', content: buildSystemPrompt(user) }];
    const kept = trimHistoryToBudget(history, env.AGENT_HISTORY_TOKEN_BUDGET);
    for (let i = 0; i < kept.length; i += 1) {
      const m = kept[i];
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      if (!m.content) continue;
      // 「当前用户」上下文只拼在本轮这条 user 消息上，不进 system prompt（见 persona 注释：
      // 用户相关的东西写进 system prompt 会让前缀缓存整体失效，实测差 19 倍）
      const isCurrent = i === kept.length - 1 && m.role === 'user';
      messages.push({ role: m.role, content: isCurrent ? buildUserContext(user) + '\n' + m.content : m.content });
    }

    const tools = toOpenAiTools(catalog);
    let reply = '';
    let pendingAction = null;

    for (let step = 0; step < env.AGENT_MAX_STEPS; step += 1) {
      const startedAt = Date.now();
      const out = await llm.chat({ messages, tools });
      // 记账是旁路，record() 内部已吞掉异常，不会影响对话
      usage.record({
        userId: user.id,
        role: user.role,
        conversationId: convId,
        step,
        servedBy: out.servedBy,
        model: out.model,
        fellBack: out.fellBack,
        usage: out.usage,
        latencyMs: Date.now() - startedAt,
        streamed: false
      });
      const calls = out.tool_calls || [];

      if (!calls.length) {
        reply = out.content || '（没有更多信息）';
        break;
      }

      messages.push({ role: 'assistant', content: out.content || null, tool_calls: calls });

      let blocked = false;
      for (const call of calls) {
        const name = call.function && call.function.name;
        const tool = catalog.byName.get(name);
        let args;
        try {
          args = call.function && call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '参数不是合法 JSON' }) });
          continue;
        }

        if (!tool) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '未知工具 ' + name }) });
          continue;
        }

        // 参数守卫：类型纠正 + 必填校验。
        // 小模型常漏必填、把布尔写成字符串；不拦的话用户会看到一串面向开发者的 zod 报错。
        // 缺字段时**不发起请求**，把"缺哪些"回给模型让它补（模型在循环里能自己补）。
        const guarded = argGuard.guard(tool, args);
        args = guarded.args;
        if (guarded.missing.length) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              error: '缺少必填参数：' + guarded.missing.join('、'),
              hint: '请补齐这些字段后重新调用工具（本次未执行任何操作）'
            })
          });
          continue;
        }

        // 写操作 → 生成待确认动作，交给用户确认
        // （模块工具的 action 是真实端点，非 GET 也必须走确认，否则可绕过确认直接写库）
        if (isWriteCall(tool, args)) {
          // 卡片内容走 actionPreview：说人话 + 由后端查真实影响面（见该模块注释）
          const desc = await actionPreview.describe(tool, args, user);
          // 降噪：后果无害且只影响自己的操作直接办，不回卡片。
          // 为什么必须降噪——全都弹卡片的结果是全都不看，确认就失去了信号价值。
          if (desc.policy === 'auto') {
            const autoResult = await execute(tool, args, { token, userId: user.id, conversationId: convId });
            const ok = autoResult && autoResult.ok !== false;
            logger.info({ userId: user.id, tool: tool.name, ok }, 'agent low-risk write auto-executed');
            if (ok) {
              const autoTarget = resolveTarget(tool, args);
              await registerUndo({
                user, tool, method: autoTarget.method, path: autoTarget.path,
                params: args, resultData: autoResult.data, conversationId: convId
              });
            }
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(ok ? { success: true, note: '已直接执行（低风险操作，无需确认）' } : { success: false, error: autoResult && autoResult.error })
            });
            continue;
          }
          const target = resolveTarget(tool, args);
          const actionId = await AgentRepo.createAction({
            conversationId: convId,
            userId: user.id,
            tool: tool.name,
            method: target.method,
            path: target.path,
            params: args,
            preview: desc.summary,
            risk: desc.risk,
            impact: desc.impact,
            ttlMs: env.AGENT_ACTION_TTL_MS
          });
          pendingAction = {
            id: actionId, tool: tool.name, label: tool.label || tool.name,
            preview: desc.summary, risk: desc.risk, impact: desc.impact, irreversible: desc.irreversible
          };
          reply = '需要你确认后才会执行：' + pendingAction.label + ' —— ' + pendingAction.preview;
          blocked = true;
          break;
        }

        const result = await execute(tool, args, { token, userId: user.id, conversationId: convId });
        const content = JSON.stringify({ status: result.status, data: result.data }).slice(0, 6000);
        messages.push({ role: 'tool', tool_call_id: call.id, content });
      }
      if (blocked) break;
    }

    if (!reply) reply = '我没能完成这次请求，请换个说法或稍后再试。';
    await AgentRepo.addMessage(convId, 'assistant', reply, pendingAction ? [{ pendingAction }] : null);
    await AgentRepo.touchConversation(convId);
    return { conversationId: convId, reply, pendingAction };
  }

  static async confirm(user, token, actionId, app) {
    const catalog = catalogFor(app);
    const action = await AgentRepo.getAction(Number(actionId));
    if (!action) throw new NotFoundError('待确认动作不存在或已过期');
    if (Number(action.user_id) !== Number(user.id)) throw new ForbiddenError('无权执行该动作');

    const tool = catalog.byName.get(action.tool);
    if (!tool) throw new BadRequestError('该动作对应的工具已不可用');

    let result;
    try {
      result = await execute(tool, action.params || {}, { token, userId: user.id, conversationId: action.conversation_id });
    } catch (e) {
      await AgentRepo.markAction(action.id, 'failed', { error: e.message });
      throw e;
    }

    const success = result.ok && result.data && result.data.success !== false;
    await AgentRepo.markAction(action.id, success ? 'executed' : 'failed', result.data);

    // 撤销登记：只有真有反向端点的操作才登记（见 services/agent/undo.js）
    let undoId = null;
    if (success) {
      undoId = await registerUndo({
        user, tool, method: resolveTarget(tool, action.params).method, path: resolveTarget(tool, action.params).path,
        params: action.params, resultData: result.data,
        actionId: action.id, conversationId: action.conversation_id
      });
    }

    const summary = success
      ? '已执行：' + (tool.label || tool.name) + '。' + (result.data && result.data.message ? result.data.message : '') +
        (undoId ? '\n（若发错了，回复「撤销」可以撤回）' : '')
      : '执行未成功：' + ((result.data && result.data.error) || '未知错误');

    if (action.conversation_id) {
      await AgentRepo.addMessage(action.conversation_id, 'user', '确认执行');
      await AgentRepo.addMessage(action.conversation_id, 'assistant', summary, [{ tool: tool.name, result: result.data }]);
      await AgentRepo.touchConversation(action.conversation_id);
    }

    logger.info({ userId: user.id, tool: tool.name, success }, 'agent action executed');
    return { reply: summary, success, status: result.status, result: result.data, undoId: undoId || null };
  }

  /**
   * 撤销最近一次（或指定一次）写操作。
   * 撤销本身也是一次写操作：以用户身份走内部 API，权限矩阵照旧生效。
   */
  static async undoLast(user, token, app, opts) {
    const target = opts && opts.id
      ? await AgentRepo.getUndo(Number(opts.id), user.id)
      : await AgentRepo.latestUndo(user.id);
    if (!target) {
      throw new NotFoundError('没有可撤销的操作（可能已撤销、已过期，或这个操作本身不支持撤销）');
    }
    let result;
    try {
      result = await callApi({
        method: target.method,
        path: target.path,
        body: target.method === 'DELETE' ? undefined : target.params,
        token,
        conversationId: target.conversation_id
      });
    } catch (e) {
      await AgentRepo.markUndo(target.id, 'failed');
      throw e;
    }
    const ok = result.ok && (!result.data || result.data.success !== false);
    await AgentRepo.markUndo(target.id, ok ? 'used' : 'failed');
    const reply = ok
      ? '已撤销：' + target.label
      : '撤销未成功：' + ((result.data && result.data.error) || '未知错误');
    if (target.conversation_id) {
      await AgentRepo.addMessage(target.conversation_id, 'assistant', reply);
      await AgentRepo.touchConversation(target.conversation_id);
    }
    logger.info({ userId: user.id, undoId: target.id, ok }, 'agent undo executed');
    return { reply, success: ok, undoId: target.id };
  }

  static async listConversations(user) {
    return AgentRepo.listConversations(user.id, 30);
  }

  static async listMessages(user, conversationId) {
    const conv = await AgentRepo.getConversation(Number(conversationId), user.id);
    if (!conv) throw new ForbiddenError('会话不存在或不属于你');
    return AgentRepo.listMessages(Number(conversationId), 100);
  }

  /**
   * 流式对话：读操作立即执行并把过程/结果通过 send 事件推送；写操作推送 pending 事件。
   * send(event) 由路由层实现（SSE）。
   */
  static async chatStream(user, token, { conversationId, message, attachments }, app, send) {
    const atts = normalizeAttachments(attachments);
    if (!String(message || '').trim() && !atts.length) throw new BadRequestError('消息不能为空');
    const userContent = withAttachmentText(message, atts);
    const used = await AgentRepo.countUserMessagesLast24h(user.id);
    if (used >= env.AGENT_DAILY_QUOTA) throw new HttpError(429, '今日对话次数已达上限，请明天再试', 'AGENT_QUOTA_EXCEEDED');

    const catalog = agentCatalogFor(app, user);
    let convId = conversationId ? Number(conversationId) : null;
    if (convId) {
      const conv = await AgentRepo.getConversation(convId, user.id);
      if (!conv) throw new ForbiddenError('会话不存在或不属于你');
    } else {
      convId = await AgentRepo.createConversation(user.id, String(message || atts[0].name || '图片').slice(0, 40));
    }
    await AgentRepo.addMessage(convId, 'user', userContent);
    await AgentRepo.touchConversation(convId);

    const history = await AgentRepo.listMessages(convId, 30);
    const messages = [{ role: 'system', content: buildSystemPrompt(user) }];
    const kept = trimHistoryToBudget(history, env.AGENT_HISTORY_TOKEN_BUDGET);
    for (let i = 0; i < kept.length; i += 1) {
      const m = kept[i];
      if ((m.role !== 'user' && m.role !== 'assistant') || !m.content) continue;
      const isCurrent = i === kept.length - 1 && m.role === 'user';
      messages.push({ role: m.role, content: isCurrent ? buildUserContext(user) + '\n' + m.content : m.content });
    }

    const tools = toOpenAiTools(catalog);
    let reply = '';
    let pendingAction = null;

    for (let step = 0; step < env.AGENT_MAX_STEPS; step += 1) {
      const startedAt = Date.now();
      const out = await llm.chatStream({ messages, tools, onDelta: (t) => send({ type: 'delta', content: t }) });
      usage.record({
        userId: user.id,
        role: user.role,
        conversationId: convId,
        step,
        servedBy: out.servedBy,
        model: out.model,
        fellBack: out.fellBack,
        usage: out.usage,
        latencyMs: Date.now() - startedAt,
        streamed: true
      });
      const calls = out.tool_calls || [];
      if (!calls.length) {
        reply = out.content || '（没有更多信息）';
        break;
      }
      messages.push({ role: 'assistant', content: out.content || null, tool_calls: calls });

      let blocked = false;
      for (const call of calls) {
        const name = call.function && call.function.name;
        const tool = catalog.byName.get(name);
        let args;
        try {
          args = call.function && call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '参数不是合法 JSON' }) });
          continue;
        }
        if (!tool) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '未知工具 ' + name }) });
          continue;
        }
        // 参数守卫：类型纠正 + 必填校验（与 chat 路径同理，见 services/agent/argGuard.js）
        const guarded = argGuard.guard(tool, args);
        args = guarded.args;
        if (guarded.missing.length) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              error: '缺少必填参数：' + guarded.missing.join('、'),
              hint: '请补齐这些字段后重新调用工具（本次未执行任何操作）'
            })
          });
          continue;
        }
        if (isWriteCall(tool, args)) {
          const desc = await actionPreview.describe(tool, args, user);
          // 降噪：低风险直接办（与 chat 路径同理，见 actionPreview.policyFor）
          if (desc.policy === 'auto') {
            const autoResult = await execute(tool, args, { token, userId: user.id, conversationId: convId });
            const ok = autoResult && autoResult.ok !== false;
            logger.info({ userId: user.id, tool: tool.name, ok }, 'agent low-risk write auto-executed');
            if (ok) {
              await registerUndo({
                user, tool, method: tool.method, path: tool.path,
                params: args, resultData: autoResult.data, conversationId: convId
              });
            }
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(ok ? { success: true, note: '已直接执行（低风险操作，无需确认）' } : { success: false, error: autoResult && autoResult.error })
            });
            continue;
          }
          const target = resolveTarget(tool, args);
          const actionId = await AgentRepo.createAction({
            conversationId: convId, userId: user.id, tool: tool.name, method: target.method, path: target.path,
            params: args, preview: desc.summary, risk: desc.risk, impact: desc.impact, ttlMs: env.AGENT_ACTION_TTL_MS
          });
          pendingAction = {
            id: actionId, tool: tool.name, label: tool.label || tool.name,
            preview: desc.summary, risk: desc.risk, impact: desc.impact, irreversible: desc.irreversible
          };
          reply = '需要你确认后才会执行：' + pendingAction.label + ' —— ' + pendingAction.preview;
          send({ type: 'pending', action: pendingAction });
          blocked = true;
          break;
        }
        send({ type: 'tool', name: tool.name, label: tool.label || tool.name });
        const result = await execute(tool, args, { token, userId: user.id, conversationId: convId });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ status: result.status, data: result.data }).slice(0, 6000) });
      }
      if (blocked) break;
    }

    if (!reply) reply = '我没能完成这次请求，请换个说法或稍后再试。';
    await AgentRepo.addMessage(convId, 'assistant', reply, pendingAction ? [{ pendingAction }] : null);
    await AgentRepo.touchConversation(convId);
    return { conversationId: convId, reply, pendingAction };
  }
}

module.exports = AgentService;
module.exports.clearAgentCatalogCache = clearAgentCatalogCache;
module.exports.agentCatalogFor = agentCatalogFor;