const crypto = require('crypto');
const AgentRepo = require('./repo');
const llm = require('./llm');
const { buildTools, agentCatalog, toOpenAiTools, isWriteCall } = require('./toolCatalog');
const { execute, callApi, resolveTarget } = require('./toolRunner');
const undo = require('./undo');
const argGuard = require('./argGuard');
const vision = require('./vision');
const actionPreview = require('./actionPreview');
const preflight = require('./preflight');
const taskState = require('./taskState');
const attachmentAuth = require('./attachmentAuth');
const { buildSystemPrompt, buildUserContext } = require('./persona');
const usage = require('./usage');
const { trimHistoryToBudget } = require('./history');
const { normalize: normalizeAttachments, withAttachmentText } = require('./attachments');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { BadRequestError, ForbiddenError, NotFoundError, HttpError } = require('../../shared/http');

/** 一轮对话里预校验失败最多允许模型纠错 2 次，超过后给用户确定性的失败原因 */
const MAX_PREFLIGHT_CORRECTIONS = 2;

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

/** 写工具保存到草稿的业务载荷（模块工具在 params 里） */
function draftArgsOf(tool, args) {
  if (tool && tool.kind === 'module') return (args && args.params) || {};
  return args || {};
}

/** 显式撤回草稿附件（不调用模型）；用户说「证明不传了 / 撤回附件」 */
function isAttachmentClearCommand(message) {
  return /^[/／](?:撤回附件|清除附件|删除附件)$/.test(String(message || '').trim());
}

/**
 * 建立/校验本轮上下文：会话归属、附件所有权、历史、任务草稿与真实配置注入。
 * chat 与 chatStream 共用，避免两条链路行为分叉。
 */
async function prepareTurn(user, { conversationId, message, attachments }, app) {
  const rawAtts = normalizeAttachments(attachments);
  if (!String(message || '').trim() && !rawAtts.length) throw new BadRequestError('消息不能为空');
  const userContent = withAttachmentText(message, rawAtts);
  const used = await AgentRepo.countUserMessagesLast24h(user.id);
  if (used >= env.AGENT_DAILY_QUOTA) {
    throw new HttpError(429, '今日对话次数已达上限，请明天再试', 'AGENT_QUOTA_EXCEEDED');
  }

  // 附件所有权：未登记 / 别人的图 → 403（在创建会话/写消息前拦下，避免留下孤儿会话）
  const atts = await attachmentAuth.authorize(user.id, rawAtts);

  const catalog = agentCatalogFor(app, user);
  let convId = conversationId ? Number(conversationId) : null;
  let conv;
  if (convId) {
    conv = await AgentRepo.getConversation(convId, user.id);
    if (!conv) throw new ForbiddenError('会话不存在或不属于你');
    if (conv.closed_at) throw new ForbiddenError('该会话已结束，请开始新会话', 'CONVERSATION_CLOSED');
  } else {
    convId = await AgentRepo.createConversation(user.id, String(message || rawAtts[0].name || '图片').slice(0, 40));
    conv = await AgentRepo.getConversationById(convId);
  }

  if (atts.length) await AgentRepo.bindAttachmentsToConversation(user.id, atts.map((a) => a.url), convId);

  // 新一轮消息：旧确认立即失效（改口/预校验失败/补图/取消后再说话都不能留下可执行旧卡），
  // 并把本轮附件并入草稿（即使模型这一轮不调工具）。附件撤回命令清空草稿附件。
  let stateRef = { state: conv.state || null, version: Number(conv.state_version || 0) };
  const clearAttachments = isAttachmentClearCommand(message);
  const wasAwaiting = !!(stateRef.state && stateRef.state.status === 'awaiting_confirm');
  let attachmentCleared = false;
  if (wasAwaiting || clearAttachments || atts.length) {
    if (wasAwaiting || clearAttachments) {
      await AgentRepo.invalidatePendingActions(convId, user.id, 'superseded');
      if (wasAwaiting) {
        logger.info({ event: 'confirm_conflict', userId: user.id, conversationId: convId, code: 'NEW_TURN' }, 'old action invalidated by new turn');
      }
    }
    const saved = await AgentRepo.mutateConversationState(convId, (prev) => {
      let next = prev;
      if (next && next.status === 'awaiting_confirm') {
        next = {
          ...next,
          status: 'collecting',
          last_error: { code: 'SUPERSEDED_BY_NEW_TURN', message: '用户开始了新一轮消息，旧确认已失效' },
          revision: Number(next.revision || 0) + 1
        };
      }
      if (clearAttachments) {
        attachmentCleared = true;
        return taskState.clearAttachments(next);
      }
      if (atts.length) {
        return taskState.mergeDraft(next, { tool: (next && next.tool) || null, args: {}, attachments: atts });
      }
      return next;
    });
    stateRef = { state: saved.state, version: saved.version };
  }

  await AgentRepo.addMessage(convId, 'user', userContent);
  await AgentRepo.touchConversation(convId);

  const history = await AgentRepo.listMessages(convId, 30);
  const runtimeContext = await buildRuntimeContext(stateRef.state, atts);
  const messages = [{ role: 'system', content: buildSystemPrompt(user) }];
  const kept = trimHistoryToBudget(history, env.AGENT_HISTORY_TOKEN_BUDGET);

  // 本轮有新图 → 发新图；没有新图但草稿活跃 → 最多回送 2 张草稿图（用户说「那是我的证明」时不能丢图）
  const imageSource = atts.length
    ? atts
    : taskState.isActive(stateRef.state)
      ? (stateRef.state.attachments || []).slice(-vision.MAX_IMAGES)
      : [];
  const imageParts = imageSource.length ? await vision.buildImageParts(imageSource) : [];

  for (let i = 0; i < kept.length; i += 1) {
    const m = kept[i];
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (!m.content) continue;
    // 「当前用户/任务」上下文只拼在本轮这条 user 消息上，不进 system prompt（见 persona 注释：
    // 用户相关的东西写进 system prompt 会让前缀缓存整体失效，实测差 19 倍）
    const isCurrent = i === kept.length - 1 && m.role === 'user';
    // 明确分隔「辅助上下文」与用户原话：mock/小模型都不会把配置里的词当成用户意图
    const text = isCurrent ? buildUserContext(user, m.content, runtimeContext) + '\n【用户原话】\n' + m.content : m.content;
    messages.push({ role: m.role, content: isCurrent && imageParts.length ? [{ type: 'text', text }].concat(imageParts) : text });
  }

  return { convId, catalog, messages, atts, stateRef, attachmentCleared };
}

/** 本轮注入：真实配置 + 任务草稿 + 附件清单（确定性事实，不依赖模型记忆） */
async function buildRuntimeContext(state, currentAtts) {
  const lines = [];
  try {
    const cfg = await preflight.loadLeaveConfig();
    lines.push('【真实请假配置】' + preflight.windowsText(cfg.list) + '。type 必须用这些名称，不能写数字/别名；固定类型必须同日且在窗口内。');
  } catch (e) {
    logger.warn({ err: e && e.message }, 'load leave config for prompt failed');
  }
  if (currentAtts && currentAtts.length) {
    lines.push('【本轮附件】' + currentAtts.map((a) => (a.name || '附件') + '：' + a.url).join('；'));
  }
  const draft = taskState.promptBlock(state);
  if (draft) lines.push(draft);
  return lines.join('\n');
}

function preflightErrorText(error) {
  const parts = ['这次没能提交：' + error.message];
  if (error.allowed_types && error.allowed_types.length) parts.push('可用的请假类型：' + error.allowed_types.join('、'));
  if (error.windows) parts.push('真实时段：' + error.windows);
  if (error.today) parts.push('今天是 ' + error.today);
  parts.push('请补充或修正后再发一次；本次没有生成确认卡片，也没有执行任何操作。');
  return parts.join('\n');
}

/** 保存草稿状态；冲突由 repo 的读改写重试处理 */
async function commitDraft(convId, stateRef, tool, args, atts, replaceAttachments) {
  const action = tool.kind === 'module' ? String((args && args.action) || '') : null;
  const saved = await AgentRepo.mutateConversationState(convId, (prev) =>
    taskState.mergeDraft(prev, {
      tool: tool.name,
      action,
      args: draftArgsOf(tool, args),
      attachments: atts,
      replaceAttachments: !!replaceAttachments
    })
  );
  stateRef.state = saved.state;
  stateRef.version = saved.version;
  return saved.state;
}

async function markState(convId, stateRef, mutator) {
  const saved = await AgentRepo.mutateConversationState(convId, (prev) => mutator(prev));
  stateRef.state = saved.state;
  stateRef.version = saved.version;
  return saved.state;
}

/** 生成 action 前：旧 pending 作废 + 动作版本/哈希绑定 */
async function createPendingAction({ convId, user, tool, args, stateRef, desc, pre, undoCtx }) {
  await AgentRepo.supersedePendingActions(convId, user.id);
  // 版本语义：先把会话推进到 awaiting_confirm，拿到新 version，再用同一个 version 创建动作。
  // 这样 action.state_version === conversation.state_version，确认时可在一条 UPDATE 里原子校验。
  await markState(convId, stateRef, (prev) =>
    taskState.toAwaitingConfirm(prev || { tool: tool.name, fields: {}, attachments: [], revision: 0 }, args, (prev && prev.attachments) || [])
  );
  const boundVersion = stateRef.version;
  const target = resolveTarget(tool, args);
  let actionId;
  try {
    actionId = await AgentRepo.createAction({
      conversationId: convId,
      userId: user.id,
      tool: tool.name,
      method: target.method,
      path: target.path,
      params: args,
      preview: desc.summary,
      risk: desc.risk,
      impact: desc.impact,
      ttlMs: env.AGENT_ACTION_TTL_MS,
      stateVersion: boundVersion,
      paramsHash: pre ? pre.paramsHash : preflight.paramsHash(args),
      configHash: pre ? pre.configHash : null
    });
  } catch (e) {
    await markState(convId, stateRef, (prev) => taskState.markFailed(prev, { code: 'ACTION_CREATE_FAILED', message: e.message }));
    throw e;
  }
  if (undoCtx) undoCtx.actionId = actionId;
  return actionId;
}

/**
 * 处理一次工具调用（chat/chatStream 共用）。
 * 返回 { blocked, pendingAction, reply }；tool 结果直接 push 到 messages。
 */
async function processToolCall({ call, catalog, user, token, convId, stateRef, messages, counters, stream, send }) {
  const name = call.function && call.function.name;
  const tool = catalog.byName.get(name);
  let args;
  try {
    args = call.function && call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch (e) {
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '参数不是合法 JSON' }) });
    return { blocked: false };
  }
  if (!tool) {
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: '未知工具 ' + name }) });
    return { blocked: false };
  }

  if (!isWriteCall(tool, args)) {
    const guarded = argGuard.guard(tool, args);
    if (guarded.missing.length) {
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({
          error: '缺少必填参数：' + guarded.missing.join('、'),
          hint: '请补齐这些字段后重新调用工具（本次未执行任何操作）'
        })
      });
      return { blocked: false };
    }
    if (stream) send({ type: 'tool', name: tool.name, label: tool.label || tool.name });
    const result = await execute(tool, guarded.args, { token, userId: user.id, conversationId: convId });
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ status: result.status, data: result.data }).slice(0, 6000) });
    return { blocked: false };
  }

  // ---- 写操作：先落草稿（跨轮保留），再把草稿字段并入本次参数，最后才预校验/生成卡片 ----
  const explicitAttachments = taskState.hasExplicitAttachments(tool, args);
  const explicitUrls = explicitAttachments
    ? (tool.kind === 'module' ? (args.params && args.params.attachments) : args.attachments) || []
    : null;
  // 显式 attachments 是权威替换值（可清空），但仍必须逐条验证所有权：
  // 模型可能把别人的 /uploads URL 塞进参数，不能因为「显式给了」就绕过 agent_attachments owner 校验。
  const explicitAuthorized = explicitAttachments
    ? await attachmentAuth.authorize(user.id, explicitUrls.map((u) => (typeof u === 'string' ? { url: u } : u)))
    : null;
  // 没给才使用本轮消息附件并入草稿
  const draft = await commitDraft(convId, stateRef, tool, args, explicitAttachments ? explicitAuthorized : counters.currentAtts, explicitAttachments);
  let effectiveArgs = taskState.mergeArgs(tool, draft, args);
  effectiveArgs = taskState.withDraftAttachments(tool, effectiveArgs, (draft && draft.attachments) || []);

  const allowedUrls = new Set([
    ...counters.currentAtts.map((a) => a.url),
    ...((draft && draft.attachments) || []).map((a) => a.url)
  ]);
  const pre = await preflight.validate({ tool, args: effectiveArgs, user, allowedAttachmentUrls: allowedUrls });
  if (!pre.ok) {
    counters.preflightFailures += 1;
    logger.warn(
      { event: 'preflight_failed', userId: user.id, conversationId: convId, tool: tool.name, code: pre.error.code, attempt: counters.preflightFailures },
      'agent preflight rejected write candidate'
    );
    await markState(convId, stateRef, (prev) => taskState.markFailed(prev, pre.error));
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({
        error: pre.error.message,
        code: pre.error.code,
        allowed_types: pre.error.allowed_types,
        windows: pre.error.windows,
        today: pre.error.today,
        hint: pre.error.hint
      })
    });
    if (counters.preflightFailures >= MAX_PREFLIGHT_CORRECTIONS) {
      return { blocked: true, reply: preflightErrorText(pre.error) };
    }
    return { blocked: false };
  }

  // 非请假类写工具仍走必填守卫（请假类已由 preflight 完整校验）
  if (pre.kind === null) {
    const guarded = argGuard.guard(tool, effectiveArgs);
    effectiveArgs = guarded.args;
    if (guarded.missing.length) {
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({
          error: '缺少必填参数：' + guarded.missing.join('、'),
          hint: '请补齐这些字段后重新调用工具（本次未执行任何操作）'
        })
      });
      return { blocked: false };
    }
  }

  const desc = await actionPreview.describe(tool, effectiveArgs, user);

  // 降噪：后果无害且只影响自己的操作直接办，不回卡片。
  if (desc.policy === 'auto') {
    const autoResult = await execute(tool, effectiveArgs, { token, userId: user.id, conversationId: convId });
    const ok = autoResult && autoResult.ok !== false;
    logger.info({ userId: user.id, tool: tool.name, ok }, 'agent low-risk write auto-executed');
    if (ok) {
      const autoTarget = resolveTarget(tool, effectiveArgs);
      await registerUndo({
        user, tool, method: autoTarget.method, path: autoTarget.path,
        resultData: autoResult.data, conversationId: convId
      });
      await markState(convId, stateRef, (prev) => taskState.markCompleted(prev));
    }
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify(ok ? { success: true, note: '已直接执行（低风险操作，无需确认）' } : { success: false, error: autoResult && autoResult.error })
    });
    return { blocked: false };
  }

  const actionId = await createPendingAction({ convId, user, tool, args: effectiveArgs, stateRef, desc, pre });
  const pendingAction = {
    id: actionId, tool: tool.name, label: tool.label || tool.name,
    preview: desc.summary, risk: desc.risk, impact: desc.impact, irreversible: desc.irreversible
  };
  if (stream) send({ type: 'pending', action: pendingAction });
  return {
    blocked: true,
    pendingAction,
    reply: '需要你确认后才会执行：' + pendingAction.label + ' —— ' + pendingAction.preview
  };
}

/** 执行成功后登记一条可撤销记录（拿不到新建资源 id 就不登记，不猜） */
async function registerUndo({ user, tool, method, path, resultData, actionId, conversationId }) {
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

function logFallback(out, user, convId, step) {
  if (out && out.fellBack) {
    logger.info({ event: 'llm_fell_back', userId: user.id, conversationId: convId, step, servedBy: out.servedBy, model: out.model }, 'llm upstream fell back');
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
    const turn = await prepareTurn(user, { conversationId, message, attachments }, app);
    const { convId, catalog, messages, atts, stateRef } = turn;
    if (turn.attachmentCleared) {
      const reply = '已撤回草稿中的附件。';
      await AgentRepo.addMessage(convId, 'assistant', reply);
      await AgentRepo.touchConversation(convId);
      return { conversationId: convId, reply, pendingAction: null };
    }
    let tools;
    try {
      const cfg = await preflight.loadLeaveConfig();
      tools = toOpenAiTools(catalog, { leaveTypes: cfg.list });
    } catch (e) {
      tools = toOpenAiTools(catalog);
    }

    const counters = { preflightFailures: 0, currentAtts: atts };
    let reply = '';
    let pendingAction = null;

    for (let step = 0; step < env.AGENT_MAX_STEPS; step += 1) {
      const startedAt = Date.now();
      const out = await llm.chat({ messages, tools });
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
      logFallback(out, user, convId, step);
      const calls = out.tool_calls || [];

      if (!calls.length) {
        reply = out.content || '（没有更多信息）';
        break;
      }

      messages.push({ role: 'assistant', content: out.content || null, tool_calls: calls });
      let blocked = false;
      for (const call of calls) {
        const r = await processToolCall({
          call, catalog, user, token, convId, stateRef, messages, counters, stream: false, send: null
        });
        if (r.pendingAction) pendingAction = r.pendingAction;
        if (r.reply) reply = r.reply;
        if (r.blocked) { blocked = true; break; }
      }
      if (blocked) break;
    }

    if (!reply) reply = '我没能完成这次请求，请换个说法或稍后再试。';
    await AgentRepo.addMessage(convId, 'assistant', reply, pendingAction ? [{ pendingAction }] : null);
    await AgentRepo.touchConversation(convId);
    return { conversationId: convId, reply, pendingAction };
  }

  /**
   * 流式对话：读操作立即执行并把过程/结果通过 send 事件推送；写操作推送 pending 事件。
   * send(event) 由路由层实现（SSE）。
   */
  static async chatStream(user, token, { conversationId, message, attachments }, app, send) {
    const turn = await prepareTurn(user, { conversationId, message, attachments }, app);
    const { convId, catalog, messages, atts, stateRef } = turn;
    if (turn.attachmentCleared) {
      const reply = '已撤回草稿中的附件。';
      await AgentRepo.addMessage(convId, 'assistant', reply);
      await AgentRepo.touchConversation(convId);
      return { conversationId: convId, reply, pendingAction: null };
    }
    let tools;
    try {
      const cfg = await preflight.loadLeaveConfig();
      tools = toOpenAiTools(catalog, { leaveTypes: cfg.list });
    } catch (e) {
      tools = toOpenAiTools(catalog);
    }

    const counters = { preflightFailures: 0, currentAtts: atts };
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
      logFallback(out, user, convId, step);
      const calls = out.tool_calls || [];
      if (!calls.length) {
        reply = out.content || '（没有更多信息）';
        break;
      }
      messages.push({ role: 'assistant', content: out.content || null, tool_calls: calls });

      let blocked = false;
      for (const call of calls) {
        const r = await processToolCall({
          call, catalog, user, token, convId, stateRef, messages, counters, stream: true, send
        });
        if (r.pendingAction) pendingAction = r.pendingAction;
        if (r.reply) reply = r.reply;
        if (r.blocked) { blocked = true; break; }
      }
      if (blocked) break;
    }

    if (!reply) reply = '我没能完成这次请求，请换个说法或稍后再试。';
    await AgentRepo.addMessage(convId, 'assistant', reply, pendingAction ? [{ pendingAction }] : null);
    await AgentRepo.touchConversation(convId);
    return { conversationId: convId, reply, pendingAction };
  }

  /**
   * 确认执行：先原子抢占（status=pending + state_version 匹配），抢占成功后再用最新配置复验；
   * 重复/并发确认只有一个能执行，其余按 executed/superseded/expired 幂等回复。
   */
  static async confirm(user, token, actionId, app) {
    const catalog = catalogFor(app);
    const action = await AgentRepo.findAction(Number(actionId));
    if (!action) throw new NotFoundError('待确认动作不存在');
    if (Number(action.user_id) !== Number(user.id)) throw new ForbiddenError('无权执行该动作');

    const tool = catalog.byName.get(action.tool);
    if (!tool) throw new BadRequestError('该动作对应的工具已不可用');

    const idempotent = (reply, extra) => ({ reply, success: !!(extra && extra.success), already: true, status: extra && extra.status, result: null, undoId: null, ...extra });
    const actionConv = action.conversation_id ? await AgentRepo.getConversationById(action.conversation_id) : null;
    const conversationClosed = !!(actionConv && actionConv.closed_at);

    if (action.status === 'executed') {
      return idempotent('该操作已经执行过，本次没有重复执行。', { success: true, status: 'executed' });
    }
    if (conversationClosed) {
      if (action.status === 'pending') {
        await AgentRepo.markAction(action.id, 'invalidated', { error: '会话已结束', code: 'CONVERSATION_CLOSED' });
      }
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id, code: 'CONVERSATION_CLOSED' }, 'agent confirm rejected: conversation closed');
      return idempotent('会话已结束，旧确认卡片已失效，请开始新会话。', { success: false, status: 'closed', code: 'CONVERSATION_CLOSED' });
    }
    if (action.status === 'superseded' || action.status === 'invalidated') {
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id, status: action.status }, 'agent confirm rejected');
      return idempotent('这次操作的信息已经更新，旧确认卡片已失效，请重新确认最新版本。', { success: false, status: action.status, code: 'ACTION_INVALIDATED' });
    }
    if (action.status === 'cancelled') {
      return idempotent('这次操作已被取消，不会执行。', { success: false, status: 'cancelled', code: 'ACTION_CANCELLED' });
    }
    if (action.status === 'failed') {
      return idempotent('这次操作上次执行失败，未重复执行；请修正后重新提交。', { success: false, status: 'failed', code: 'ACTION_FAILED' });
    }
    if (action.status === 'executing') {
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id, status: 'executing' }, 'agent confirm conflict');
      return idempotent('这次操作正在执行或刚被处理，请勿重复提交。', { success: false, status: 'executing', code: 'ACTION_CONFLICT' });
    }
    if (action.expires_at && new Date(action.expires_at).getTime() <= Date.now()) {
      return idempotent('这次操作的确认已过期，请重新发起。', { success: false, status: 'expired', code: 'ACTION_EXPIRED' });
    }

    // 预检：动作必须绑定会话**当前**版本；改口/补图/预校验失败只要推进了版本，旧卡就作废
    if (actionConv && actionConv.state_version !== action.state_version) {
      await AgentRepo.markAction(action.id, 'invalidated', { error: '会话状态版本已推进', code: 'STATE_VERSION_CHANGED' });
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id, code: 'STATE_VERSION_CHANGED' }, 'agent confirm rejected: stale state version');
      return idempotent('这次操作的信息已经更新，旧确认卡片已失效，请重新确认最新版本。', { success: false, status: 'invalidated', code: 'ACTION_INVALIDATED' });
    }

    const claimToken = crypto.randomUUID();
    const claimed = await AgentRepo.claimAction({
      id: action.id,
      userId: user.id,
      stateVersion: action.state_version,
      claimToken
    });
    if (!claimed) {
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id }, 'agent confirm claim lost');
      const latest = await AgentRepo.findAction(action.id);
      const latestConv = latest && latest.conversation_id ? await AgentRepo.getConversationById(latest.conversation_id) : null;
      let status = latest ? latest.status : 'unknown';
      let code = 'ACTION_CONFLICT';
      let reply = '这次操作正在执行或已被处理，请勿重复提交。';
      if (status === 'executed') {
        code = undefined;
        reply = '该操作已经执行过，本次没有重复执行。';
      } else if (latestConv && latestConv.closed_at) {
        status = 'closed';
        code = 'CONVERSATION_CLOSED';
        reply = '会话已结束，旧确认卡片已失效，请开始新会话。';
      } else if (status === 'superseded' || status === 'invalidated') {
        code = 'ACTION_INVALIDATED';
        reply = '这次操作的信息已经更新，旧确认卡片已失效，请重新确认最新版本。';
      } else if (status === 'pending' && latestConv && latestConv.state_version !== latest.state_version) {
        await AgentRepo.markAction(latest.id, 'invalidated', { error: '会话状态版本已推进', code: 'STATE_VERSION_CHANGED' });
        status = 'invalidated';
        code = 'ACTION_INVALIDATED';
        reply = '这次操作的信息已经更新，旧确认卡片已失效，请重新确认最新版本。';
      } else if (status === 'cancelled') {
        code = 'ACTION_CANCELLED';
        reply = '这次操作已被取消，不会执行。';
      } else if (status === 'failed') {
        code = 'ACTION_FAILED';
        reply = '这次操作上次执行失败，未重复执行。';
      }
      return idempotent(reply, { success: status === 'executed', status, code });
    }

    // 抢占成功后重读一次会话，做一次防御性校验（claim 的 JOIN 已经原子保证，这里是兜底）
    const conv = action.conversation_id ? await AgentRepo.getConversationById(action.conversation_id) : null;
    if (conv && (conv.closed_at || conv.state_version !== action.state_version)) {
      const code = conv.closed_at ? 'CONVERSATION_CLOSED' : 'STATE_VERSION_CHANGED';
      await AgentRepo.markAction(action.id, 'invalidated', { error: '会话已关闭或版本已推进', code });
      logger.info({ event: 'confirm_conflict', userId: user.id, actionId: action.id, code }, 'agent confirm rejected after claim');
      return idempotent(
        conv.closed_at ? '会话已结束，旧确认卡片已失效，请开始新会话。' : '这次操作的信息已经更新，旧确认卡片已失效，请重新确认最新版本。',
        { success: false, status: conv.closed_at ? 'closed' : 'invalidated', code: conv.closed_at ? 'CONVERSATION_CLOSED' : 'ACTION_INVALIDATED' }
      );
    }

    // 抢占成功：**强制读最新 leave_config**（不用 60s 缓存）复验参数；配置/参数变了就作废，零副作用
    const dbAtts = action.conversation_id ? await AgentRepo.listAttachmentsByConversation(action.conversation_id, 100) : [];
    const allowedUrls = new Set(dbAtts.map((a) => a.url));
    const actionAttachments = [
      ...((action.params && action.params.attachments) || []),
      ...((action.params && action.params.params && action.params.params.attachments) || [])
    ];
    for (const a of actionAttachments) {
      if (typeof a === 'string') allowedUrls.add(a);
      else if (a && a.url) allowedUrls.add(a.url);
    }
    for (const a of (conv && conv.state && conv.state.attachments) || []) allowedUrls.add(a.url);

    const pre = await preflight.validate({ tool, args: action.params || {}, user, allowedAttachmentUrls: allowedUrls, freshConfig: true });
    const paramsChanged = action.params_hash && action.params_hash !== pre.paramsHash;
    const configChanged = action.config_hash && pre.configHash && action.config_hash !== pre.configHash;
    if (!pre.ok || paramsChanged || configChanged) {
      const code = !pre.ok ? pre.error.code : paramsChanged ? 'PARAMS_CHANGED' : 'CONFIG_CHANGED';
      const message = !pre.ok ? pre.error.message : '参数或业务配置在确认前发生了变化';
      logger.warn({ event: 'confirm_conflict', userId: user.id, actionId: action.id, code }, 'agent confirm revalidation failed');
      await AgentRepo.markAction(action.id, 'invalidated', { error: message, code });
      if (action.conversation_id) {
        await AgentRepo.mutateConversationState(action.conversation_id, (prev) => taskState.markFailed(prev, { code, message }));
        await AgentRepo.addMessage(action.conversation_id, 'assistant', '这次操作的信息已更新，旧确认已失效：' + message + '\n请重新发起并确认。');
        await AgentRepo.touchConversation(action.conversation_id);
      }
      return { reply: '这次操作的信息已更新，旧确认已失效：' + message + '\n请重新发起并确认。', success: false, status: 'invalidated', code: 'ACTION_INVALIDATED', result: null, undoId: null };
    }

    let result;
    try {
      result = await execute(tool, action.params || {}, { token, userId: user.id, conversationId: action.conversation_id });
    } catch (e) {
      await AgentRepo.markAction(action.id, 'failed', { error: e.message });
      if (action.conversation_id) {
        await AgentRepo.mutateConversationState(action.conversation_id, (prev) => taskState.markFailed(prev, { code: 'EXECUTION_FAILED', message: e.message }));
        await AgentRepo.addMessage(action.conversation_id, 'assistant', '执行未成功：' + e.message + '\n可以补正后重新提交。');
      }
      throw e;
    }

    const success = result.ok && result.data && result.data.success !== false;
    await AgentRepo.markAction(action.id, success ? 'executed' : 'failed', result.data);

    let undoId = null;
    if (success) {
      undoId = await registerUndo({
        user, tool, method: resolveTarget(tool, action.params).method, path: resolveTarget(tool, action.params).path,
        resultData: result.data,
        actionId: action.id, conversationId: action.conversation_id
      });
    }

    if (action.conversation_id) {
      await AgentRepo.mutateConversationState(action.conversation_id, (prev) =>
        success ? taskState.markCompleted(prev) : taskState.markFailed(prev, { code: 'EXECUTION_FAILED', message: (result.data && result.data.error) || '执行未成功' })
      );
      await AgentRepo.addMessage(action.conversation_id, 'user', '确认执行');
      const summary = success
        ? '已执行：' + (tool.label || tool.name) + '。' + (result.data && result.data.message ? result.data.message : '') +
          (undoId ? '\n（若发错了，回复「撤销」可以撤回）' : '')
        : '执行未成功：' + ((result.data && result.data.error) || '未知错误');
      await AgentRepo.addMessage(action.conversation_id, 'assistant', summary, [{ tool: tool.name, result: result.data }]);
      await AgentRepo.touchConversation(action.conversation_id);
    }

    const summary = success
      ? '已执行：' + (tool.label || tool.name) + '。' + (result.data && result.data.message ? result.data.message : '') +
        (undoId ? '\n（若发错了，回复「撤销」可以撤回）' : '')
      : '执行未成功：' + ((result.data && result.data.error) || '未知错误');

    logger.info({ userId: user.id, tool: tool.name, success }, 'agent action executed');
    return { reply: summary, success, status: result.status, result: result.data, undoId: undoId || null, already: false };
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
}

module.exports = AgentService;
module.exports.clearAgentCatalogCache = clearAgentCatalogCache;
module.exports.agentCatalogFor = agentCatalogFor;
module.exports.prepareTurn = prepareTurn;
module.exports.processToolCall = processToolCall;
module.exports.MAX_PREFLIGHT_CORRECTIONS = MAX_PREFLIGHT_CORRECTIONS;
