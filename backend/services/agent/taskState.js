/**
 * 会话内结构化任务草稿
 *
 * 业务办理不能靠模型从自由文本里「记住」：用户改口、补图、失败重试时，
 * 历史消息里既有旧值又有新值，小模型经常挑错。把当前任务写进
 * agent_conversations.state（JSON）后，每一轮都把「工具 / 已收集字段 / 附件 / 上次错误」
 * 作为确定性上下文注入给模型；模型只负责补缺和改口，不再负责记忆。
 *
 * 状态机：
 *   collecting ──(字段齐全 + 预校验通过)──> awaiting_confirm
 *        ^                                      │
 *        └────────(失败可补正, last_error)───────┘
 *   awaiting_confirm ──(确认执行成功)──> completed
 *                    └─(执行失败)─────> failed ──(用户补正)──> collecting
 *
 * 合并规则（只对**同一 tool 的活跃草稿**生效）：
 *   - 模型本次显式给出的字段覆盖旧值；没给的字段保留
 *   - 附件按 URL 去重后累积（本轮新图 + 草稿旧图）
 *   - 换工具 / 已完成 / 已取消 → 开新草稿，不继承旧附件（避免误挂旧请假证明）
 */
const ACTIVE_STATUSES = new Set(['collecting', 'awaiting_confirm', 'failed']);

function isActive(state) {
  // tool 可以为空：用户先补了图、还没说要办什么时，也要有一条 collecting 草稿承载附件
  return !!(state && ACTIVE_STATUSES.has(state.status));
}

function hasValue(v) {
  return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
}

/** attachments 是草稿的独立字段，不写进 fields；避免下一轮被当成「显式参数」 */
function withoutAttachments(args) {
  const out = { ...(args || {}) };
  delete out.attachments;
  return out;
}

function attachList(list) {
  const out = [];
  const seen = new Set();
  for (const a of Array.isArray(list) ? list : []) {
    const url = typeof a === 'string' ? a : a && a.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      name: (a && a.name) || String(url).split('/').pop(),
      mime: (a && a.mime) || '',
      size: Number((a && a.size) || 0)
    });
  }
  return out;
}

/**
 * 生成本轮草稿（调用方负责用 AgentRepo.mutateConversationState 持久化）。
 * @param {object|null} prev 旧 state
 * @param {{tool:string, args:object, attachments?:Array, status?:string}} input
 */
function mergeDraft(prev, { tool, action, args, attachments, replaceAttachments }) {
  const sameAction = !action || !prev || !prev.action || prev.action === action;
  const sameTool = isActive(prev) && !!prev.tool && prev.tool === tool && sameAction;
  // 同一工具，或工具还没确定（用户先补图）时才继承附件；换工具/完成后不继承
  const inheritAttachments = isActive(prev) && (!prev.tool || prev.tool === tool);
  const fields = sameTool && prev.fields && typeof prev.fields === 'object' ? { ...prev.fields } : {};
  for (const [k, v] of Object.entries(args || {})) {
    if (k === 'attachments') continue;
    if (hasValue(v)) fields[k] = v;
  }
  const mergedAttachments = replaceAttachments
    ? attachList(attachments || [])
    : attachList(inheritAttachments ? [...(prev.attachments || []), ...(attachments || [])] : attachments || []);
  return {
    tool,
    action: action || null,
    status: 'collecting',
    fields,
    attachments: mergedAttachments,
    last_error: null,
    revision: Number((prev && prev.revision) || 0) + 1,
    inherited: sameTool
  };
}

/** 当前写工具的参数载荷：模块工具在 params 里 */
function payloadOf(tool, args) {
  return tool && tool.kind === 'module' ? (args && args.params) || {} : args || {};
}

function hasExplicitAttachments(tool, args) {
  const payload = payloadOf(tool, args);
  return Object.prototype.hasOwnProperty.call(payload, 'attachments');
}

/**
 * 把草稿已收集字段真正并入本次工具参数（不是只注入 prompt）。
 * - curated：顶层字段合并
 * - module：只合并 args.params，保留 action
 * - 本次显式给出的值（含空数组、null）覆盖草稿；未给出的字段从草稿补齐
 */
function mergeArgs(tool, state, incoming) {
  const args = incoming || {};
  const incomingAction = tool && tool.kind === 'module' ? args.action : null;
  const sameAction = !incomingAction || !state || !state.action || state.action === incomingAction;
  if (!tool || !isActive(state) || state.tool !== tool.name || !sameAction) return args;
  const draft = state.fields && typeof state.fields === 'object' ? state.fields : {};
  if (tool.kind === 'module') {
    const params = { ...draft };
    for (const [k, v] of Object.entries(args.params || {})) {
      if (v !== undefined) params[k] = v;
    }
    return { ...args, params };
  }
  const merged = { ...draft };
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined) merged[k] = v;
  }
  return merged;
}

/** 字段齐全且预校验通过 → 等待用户确认 */
function toAwaitingConfirm(draft, args, attachments) {
  return {
    ...draft,
    status: 'awaiting_confirm',
    fields: withoutAttachments(args),
    attachments: attachList(attachments && attachments.length ? attachments : draft.attachments),
    last_error: null,
    revision: Number(draft.revision || 0) + 1
  };
}

/** 预校验/执行失败：保留字段与错误，允许用户补正 */
function markFailed(state, error) {
  return {
    ...(state || { tool: null, fields: {}, attachments: [] }),
    status: 'failed',
    last_error: error ? { code: error.code || 'FAILED', message: error.message || String(error) } : null,
    revision: Number((state && state.revision) || 0) + 1
  };
}

function markCollecting(state) {
  return { ...(state || {}), status: 'collecting', last_error: null, revision: Number((state && state.revision) || 0) + 1 };
}

function markCompleted(state) {
  return {
    ...(state || {}),
    status: 'completed',
    last_error: null,
    revision: Number((state && state.revision) || 0) + 1
  };
}

/** 把附件字段补进写工具参数（草稿里有证明但模型本轮没重复给 URL 时） */
function withDraftAttachments(tool, args, attachments) {
  const list = attachList(attachments);
  if (!list.length) return args;
  const isApplyLeave = tool && (tool.name === 'apply_leave' || (tool.kind === 'module' && /\/api\/leave\/apply$/.test(String((args || {}).action || ''))));
  if (!isApplyLeave) return args;
  if (tool.kind === 'module') {
    const params = { ...((args && args.params) || {}) };
    // 显式给出 attachments（包括空数组）就是权威值：允许清空/替换，不再自动补旧图
    if (!Object.prototype.hasOwnProperty.call(params, 'attachments')) {
      params.attachments = list.map((a) => a.url);
    }
    return { ...args, params };
  }
  if (!Object.prototype.hasOwnProperty.call(args, 'attachments')) {
    return { ...args, attachments: list.map((a) => a.url) };
  }
  return args;
}

/** 撤回草稿附件（保留字段/工具，状态回到 collecting） */
function clearAttachments(state) {
  return {
    ...(state || { tool: null, fields: {}, attachments: [] }),
    status: 'collecting',
    attachments: [],
    last_error: { code: 'ATTACHMENTS_CLEARED', message: '用户已撤回草稿附件' },
    revision: Number((state && state.revision) || 0) + 1
  };
}

/** 注入到本轮 user 消息前的任务上下文（确定性、无敏感内容） */
function promptBlock(state) {
  if (!state) return '';
  if (!state.tool && !(state.attachments || []).length) return '';
  const actionLabel = state.action ? ' / ' + state.action : '';
  const lines = ['【当前任务草稿】工具 ' + (state.tool || '（待选择）') + actionLabel + '，状态 ' + state.status + '（第 ' + Number(state.revision || 0) + ' 版）'];
  const fields = state.fields && typeof state.fields === 'object' ? state.fields : {};
  const keys = Object.keys(fields);
  if (keys.length) {
    lines.push('已收集：' + keys.map((k) => k + '=' + JSON.stringify(fields[k])).join('；'));
  }
  if (Array.isArray(state.attachments) && state.attachments.length) {
    lines.push('任务附件（' + state.attachments.length + ' 个，均为本人上传）：');
    for (const a of state.attachments.slice(0, 6)) lines.push('- ' + (a.name || '附件') + '：' + a.url);
  }
  if (state.last_error) {
    lines.push('上次失败：[' + state.last_error.code + '] ' + state.last_error.message);
    lines.push('请根据失败原因补正；不要复用历史请假/其他任务的证明附件。');
  }
  lines.push('规则：用户本轮显式给出的新值覆盖旧值；缺的字段再问用户（能查到的自己查）。');
  return lines.join('\n');
}

module.exports = {
  ACTIVE_STATUSES,
  isActive,
  mergeDraft,
  mergeArgs,
  withoutAttachments,
  hasExplicitAttachments,
  clearAttachments,
  toAwaitingConfirm,
  markFailed,
  markCollecting,
  markCompleted,
  withDraftAttachments,
  promptBlock,
  attachList
};
