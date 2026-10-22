/**
 * 写操作预校验（确认卡片生成之前，零副作用）
 *
 * 为什么必须放在这里：小模型会生成「type=2」「9/13 的过期日期」「早集合 14:00-14:30」
 * 这类看起来合理、实际会被业务拒绝的候选。旧实现直接生成确认卡片，用户点确认后才失败——
 * 既浪费一次确认，也把"后端规则"暴露成了"执行错误"。
 *
 * 现在：**先生成结构化的可执行候选**，校验不过就不建 action、不执行，把
 * code/message/allowed_types/windows/today/hint 回给模型做有限纠错（最多 2 次）。
 * 校验规则与 services/leaveService.js 保持同一口径（类型必须真实存在、固定时段同日同窗口、
 * 结束晚于现在、≤30 天），区别只是提前执行、错误更结构化。
 */
const crypto = require('crypto');
const LeaveConfig = require('../../models/LeaveConfig');

const MAX_LEAVE_DAYS = 30;
const CONFIG_TTL_MS = 60 * 1000;

/** 稳定序列化：对象键排序，保证同一参数得到同一哈希 */
function canonical(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** 参数哈希（确认时复验参数有没有被改过） */
function paramsHash(args) {
  return sha256(canonical(args || {}));
}

let configCache = { at: 0, list: [], hash: null };

/** 真实请假配置（启用项），60s TTL；配置变更后最多 1 分钟自动重建 */
async function loadLeaveConfig(force) {
  if (!force && configCache.hash && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache;
  const rows = await LeaveConfig.getEnabled();
  const list = rows.map((r) => ({
    type_name: String(r.type_name),
    is_fixed: !!Number(r.is_fixed),
    start_time: r.start_time ? String(r.start_time) : null,
    end_time: r.end_time ? String(r.end_time) : null,
    enabled: !!Number(r.enabled)
  }));
  const hash = sha256(canonical(list));
  configCache = { at: Date.now(), list, hash };
  return configCache;
}

function clearLeaveConfigCache() {
  configCache = { at: 0, list: [], hash: null };
}

function windowsText(list) {
  return (list || [])
    .map((c) => (c.is_fixed && c.start_time && c.end_time
      ? c.type_name + ' ' + c.start_time.slice(0, 5) + '-' + c.end_time.slice(0, 5) + '（同日）'
      : c.type_name + '（不限固定时段）'))
    .join('；');
}

function todayStr(now) {
  const d = now || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 与 leaveService.parseTime 同口径；解析不到返回 null */
function parseTime(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().replace('T', ' ').replace(/\.[0-9]+Z?$/, '').replace(/Z$/, '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2})?:?(\d{2})?:?(\d{2})?$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

function hhmmss(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function positiveInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return n > 0 ? n : null;
  }
  return null;
}

/** 写工具的业务载荷：模块工具在 params 里，快捷工具在顶层 */
function payloadOf(tool, args) {
  if (tool && tool.kind === 'module') return (args && args.params) || {};
  return args || {};
}

function targetPath(tool, args) {
  if (!tool) return '';
  if (tool.kind === 'module') {
    const action = String((args && args.action) || '');
    const i = action.indexOf(' ');
    return i > 0 ? action.slice(i + 1) : '';
  }
  return tool.path || '';
}

/** 识别 lease 业务动作（curated 名称或模块端点都覆盖） */
function leaveKind(tool, args) {
  if (!tool) return null;
  const path = targetPath(tool, args);
  if (tool.name === 'apply_leave' || /^\/api\/leave\/apply$/.test(path)) return 'apply';
  if (tool.name === 'cancel_leave' || /^\/api\/leave\/cancel\/[^/]+$/.test(path) || /^\/api\/leave\/cancel\{/.test(path)) return 'cancel';
  if (tool.name === 'approve_leave' || /^\/api\/leave\/approve$/.test(path)) return 'approve';
  return null;
}

function fail(code, message, extra) {
  return {
    ok: false,
    error: {
      code,
      message,
      allowed_types: extra && extra.allowed_types ? extra.allowed_types : undefined,
      windows: extra && extra.windows ? extra.windows : undefined,
      today: extra && extra.today ? extra.today : undefined,
      hint: (extra && extra.hint) || '请修正后重新调用工具；本次未生成确认卡片，也没有执行任何操作。'
    }
  };
}

/** 附件必须属于本轮消息或当前草稿，且归属本人（归属在 agentService 已校验） */
function validateAttachments(list, allowedUrls) {
  if (list === undefined || list === null) return { ok: true, urls: [] };
  if (!Array.isArray(list)) return fail('INVALID_ATTACHMENTS', 'attachments 必须是数组');
  const allowed = allowedUrls instanceof Set ? allowedUrls : new Set(allowedUrls || []);
  const urls = [];
  for (const item of list) {
    const url = typeof item === 'string' ? item : item && item.url;
    if (!url || typeof url !== 'string') return fail('INVALID_ATTACHMENTS', '附件缺少 url');
    if (!allowed.has(url)) {
      return fail('ATTACHMENT_NOT_CURRENT', '附件不属于本轮消息或当前任务草稿，不能挂到这次申请上', {
        hint: '请不要复用历史请假里的证明；需要新证明时请用户重新上传。'
      });
    }
    urls.push(url);
    if (urls.length > 6) return fail('TOO_MANY_ATTACHMENTS', '一条申请最多 6 个附件');
  }
  return { ok: true, urls };
}

/**
 * 校验写操作。返回：
 *   { ok:true, args, paramsHash, configHash }
 *   { ok:false, error:{code,message,allowed_types,windows,today,hint}, paramsHash, configHash }
 */
async function validate({ tool, args, now, allowedAttachmentUrls, freshConfig } = {}) {
  const a = args || {};
  const hash = paramsHash(a);
  const kind = leaveKind(tool, a);

  if (kind === 'apply') {
    // 确认阶段必须强制读最新配置（freshConfig=true），不能吃 60s 缓存
    const cfg = await loadLeaveConfig(!!freshConfig);
    const payload = payloadOf(tool, a);
    const allowed = cfg.list.map((c) => c.type_name);
    const today = todayStr(now);
    const base = { allowed_types: allowed, windows: windowsText(cfg.list), today };

    const type = payload.type;
    if (type === undefined || type === null || String(type).trim() === '') {
      return { ...fail('MISSING_LEAVE_TYPE', '缺少请假类型', base), paramsHash: hash, configHash: cfg.hash };
    }
    if (typeof type !== 'string' || !allowed.includes(type.trim())) {
      return {
        ...fail(
          'INVALID_LEAVE_TYPE',
          '请假类型「' + String(type) + '」不是后端启用的类型；必须是：' + allowed.join('、') + '（不能写数字或别名）',
          base
        ),
        paramsHash: hash,
        configHash: cfg.hash
      };
    }
    const typeName = type.trim();
    const conf = cfg.list.find((c) => c.type_name === typeName);

    const start = parseTime(payload.start_time);
    const end = parseTime(payload.end_time);
    if (!start || !end) {
      return { ...fail('INVALID_TIME', '开始/结束时间无法解析，格式应为 YYYY-MM-DD HH:mm:ss', base), paramsHash: hash, configHash: cfg.hash };
    }
    const baseNow = now instanceof Date ? now : new Date();
    const anchor = base ? Object.assign({}, base, { today: todayStr(baseNow) }) : base;
    if (start.getTime() >= end.getTime()) {
      return { ...fail('INVALID_RANGE', '结束时间必须晚于开始时间', anchor), paramsHash: hash, configHash: cfg.hash };
    }
    if (end.getTime() <= baseNow.getTime()) {
      return {
        ...fail('LEAVE_EXPIRED', '结束时间已经早于现在（' + todayStr(baseNow) + '），不能提交已过期的请假', anchor),
        paramsHash: hash,
        configHash: cfg.hash
      };
    }
    if ((end.getTime() - start.getTime()) / 86400000 > MAX_LEAVE_DAYS) {
      return { ...fail('LEAVE_TOO_LONG', '单次请假不超过 ' + MAX_LEAVE_DAYS + ' 天', anchor), paramsHash: hash, configHash: cfg.hash };
    }
    if (conf && conf.is_fixed && conf.start_time && conf.end_time) {
      const s = hhmmss(start);
      const e = hhmmss(end);
      if (!sameLocalDay(start, end) || s < conf.start_time || e > conf.end_time) {
        return {
          ...fail(
            'LEAVE_OUTSIDE_WINDOW',
            '「' + typeName + '」只允许 ' + conf.start_time.slice(0, 5) + '-' + conf.end_time.slice(0, 5) + ' 且必须同一天；' +
              '你给的是 ' + s.slice(0, 5) + '-' + e.slice(0, 5) + (sameLocalDay(start, end) ? '' : '（跨天）'),
            anchor
          ),
          paramsHash: hash,
          configHash: cfg.hash
        };
      }
    }
    if (typeof payload.reason !== 'string' || !payload.reason.trim()) {
      return { ...fail('MISSING_REASON', '请填写请假事由（reason 不能为空）', anchor), paramsHash: hash, configHash: cfg.hash };
    }
    const att = validateAttachments(payload.attachments, allowedAttachmentUrls);
    if (!att.ok) return { ...att, paramsHash: hash, configHash: cfg.hash };

    return { ok: true, args: a, paramsHash: hash, configHash: cfg.hash, typeName, config: conf };
  }

  if (kind === 'cancel') {
    const payload = payloadOf(tool, a);
    const id = positiveInt(payload.id !== undefined ? payload.id : payload.leave_id);
    if (!id) {
      return { ...fail('INVALID_ID', '销假需要正整数请假记录 id（不是姓名、不是 0）', { today: todayStr(now) }), paramsHash: hash, configHash: null };
    }
    return { ok: true, args: a, paramsHash: hash, configHash: null, normalizedId: id };
  }

  if (kind === 'approve') {
    const payload = payloadOf(tool, a);
    const id = positiveInt(payload.id);
    if (!id) {
      return { ...fail('INVALID_ID', '审批需要正整数请假记录 id', { today: todayStr(now) }), paramsHash: hash, configHash: null };
    }
    const status = payload.status;
    const rawStatus = typeof status === 'number' ? status : /^[12]$/.test(String(status || '').trim()) ? Number(status) : NaN;
    const statusNum = [1, 2].includes(rawStatus) ? rawStatus : null;
    if (!statusNum) {
      return { ...fail('INVALID_STATUS', '审批结果只能是 1（通过）或 2（驳回）', { today: todayStr(now) }), paramsHash: hash, configHash: null };
    }
    return { ok: true, args: a, paramsHash: hash, configHash: null, normalizedId: id, normalizedStatus: statusNum };
  }

  return { ok: true, args: a, paramsHash: hash, configHash: null, kind: null };
}

module.exports = {
  validate,
  leaveKind,
  loadLeaveConfig,
  clearLeaveConfigCache,
  paramsHash,
  canonical,
  sha256,
  parseTime,
  todayStr,
  windowsText,
  MAX_LEAVE_DAYS,
  CONFIG_TTL_MS
};
