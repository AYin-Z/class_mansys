/**
 * 对话附件所有权校验
 *
 * 附件 URL 只是字符串，模型可以原样复用历史消息里的 `/uploads/...`，甚至被诱导引用别人的图。
 * 在上传/入站落盘时登记 agent_attachments（owner + sha256），每次 chat 前按 URL 查库：
 *   - 未登记 → 403（历史遗留 URL 也不放行，避免拿别人的图当自己的证明）
 *   - 登记了但 user_id 不是本人 → 403
 * 这样「把别人的请假证明挂到自己申请上」在数据层就走不通。
 */
const fs = require('fs');
const crypto = require('crypto');
const AgentRepo = require('./repo');
const { normalize } = require('./attachments');
const { ForbiddenError } = require('../../shared/http');
const logger = require('../../config/logger');

async function rowsByUrls(urls) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return [];
  const [rows] = await require('../../config/database').query('SELECT * FROM agent_attachments WHERE url IN (?)', [list]);
  return rows;
}

/**
 * 校验并返回规范化后的附件（保留 isImage 等字段）。
 * @throws {ForbiddenError} 未登记或不属于本人
 */
async function authorize(userId, rawList) {
  const list = normalize(rawList);
  if (!list.length) return [];
  const rows = await rowsByUrls(list.map((a) => a.url));
  const byUrl = new Map(rows.map((r) => [r.url, r]));
  for (const att of list) {
    const row = byUrl.get(att.url);
    if (!row) {
      logger.warn({ event: 'attachment_rejected', userId, reason: 'unregistered' }, 'agent attachment rejected');
      throw new ForbiddenError('附件未登记或已失效，请重新上传', 'ATTACHMENT_NOT_REGISTERED');
    }
    if (Number(row.user_id) !== Number(userId)) {
      logger.warn({ event: 'attachment_rejected', userId, reason: 'not_owner' }, 'agent attachment rejected');
      throw new ForbiddenError('无权使用他人上传的附件', 'ATTACHMENT_NOT_OWNED');
    }
    att.id = row.id;
    att.sha256 = row.sha256;
    att.conversationId = row.conversation_id;
  }
  return list;
}

/** 给草稿附件补所有权信息（不抛错：草稿来自本人会话，异常项直接丢弃） */
async function filterOwned(userId, list) {
  const urls = (list || []).map((a) => (typeof a === 'string' ? a : a && a.url)).filter(Boolean);
  if (!urls.length) return [];
  const rows = await rowsByUrls(urls);
  return rows
    .filter((r) => Number(r.user_id) === Number(userId))
    .map((r) => ({ url: r.url, name: r.name, mime: r.mime, size: Number(r.size), id: r.id, sha256: r.sha256 }));
}

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

/** App 上传路由使用：落盘后登记（上传时还不知道会话 id） */
async function registerUpload({ userId, absPath, url, name, mime, size, source }) {
  const sha256 = absPath ? sha256File(absPath) : null;
  return AgentRepo.registerAttachment({
    userId, conversationId: null, url, name, mime,
    size: size || (absPath ? fs.statSync(absPath).size : 0),
    sha256, source: source || 'app'
  });
}

module.exports = { authorize, filterOwned, registerUpload, sha256File, rowsByUrls };
