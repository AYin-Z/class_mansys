/**
 * 对话附件（图片/文件）
 *
 * 用户上传后随消息一起提交：持久化成 Markdown（图片用 ![]()，文件用 []()），
 * 这样模型能拿到 URL 直接交给业务工具（请假证明、相册图片等），前端也能直接渲染缩略图。
 */
const MAX_ATTACHMENTS = 6;
const IMAGE_MIME = /^image\//;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic)$/i;

function isSafeUrl(url) {
  return typeof url === 'string' && (url.startsWith('/uploads/') || /^https?:\/\//.test(url));
}

function isImage(att) {
  return IMAGE_MIME.test(att.mime || '') || IMAGE_EXT.test(att.url || '') || IMAGE_EXT.test(att.name || '');
}

/** 规范化前端提交的附件（丢弃非法项，最多 6 个） */
function normalize(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!isSafeUrl(url)) continue;
    const att = {
      url,
      name: String(raw.name || '').slice(0, 120) || url.split('/').pop(),
      mime: String(raw.mime || '').slice(0, 80),
      size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : 0
    };
    att.isImage = isImage(att);
    out.push(att);
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out;
}

/** 附件 → Markdown（存库与渲染共用；路径保持原样，前端负责补 token） */
function toMarkdown(attachments) {
  return (attachments || [])
    .map((a) => (a.isImage
      ? '![' + (a.name || '图片') + '](' + a.url + ')'
      : '[' + (a.name || '附件') + '](' + a.url + ')'))
    .join('\n');
}

/** 用户消息 + 附件（写入会话，也作为模型上下文） */
function withAttachmentText(message, attachments) {
  const md = toMarkdown(attachments);
  if (!md) return message;
  return String(message || '') + '\n\n' + md;
}

module.exports = { MAX_ATTACHMENTS, normalize, toMarkdown, withAttachmentText, isSafeUrl };
