/**
 * 把附件里的图片真正变成模型能"看见"的内容块。
 *
 * 背景：我们用的是 Qwen3-VL（视觉模型），但架构里附件到模型那里只有一行 Markdown 路径
 * （`![证明](/uploads/xxx.jpg)`）——**从来没有发过 image_url**，视觉能力 100% 浪费。
 * 而微信渠道已经实现了收图：用户发请假证明照片过去，模型看到的只是一串路径。
 *
 * 实测（2026-09-12，Qwen3-VL-4B + mmproj）：给一张请假条图片，模型能读出信息并生成
 * 正确的 apply_leave 调用；热态延迟 1.0~1.5s（纯文本 0.67s），prompt 多约 1500 token。
 *
 * 但 OCR 并不可靠：换成"直接读出这几个字段"的问法，它会答"图中未显示"。
 * 所以定位是**模型预填 + 用户用确认卡片核对**，不是"拍照自动填表"。
 *
 * 三件事必须控制好，否则会拖垮对话：
 * 1. **只发当前这条消息里的图**，不发历史里的（否则每轮都重发，token 与延迟翻倍）
 * 2. **限制张数与体积**（图片 token 很贵；原图动辄几 MB）
 * 3. **不支持的模型要能降级**（回落 DeepSeek 时它看不了图，此时保留 Markdown 路径即可）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const mediaService = require('../mediaService');
const logger = require('../../config/logger');

const execFileAsync = promisify(execFile);

/** 最多几张图送进模型（每张约 1.5K token，且要过视觉编码器） */
const MAX_IMAGES = 2;
/** 单张图送进模型的体积上限（超过就压缩） */
const MAX_BYTES = 1.5 * 1024 * 1024;
/** 压缩后的长边（够读证件文字，又不会太大） */
const MAX_EDGE = 1600;

const isImage = (att) => !!(att && (att.isImage || String(att.mime || '').startsWith('image/')));

/** 优先用 medium 变体（1440px，体积小得多，读文字够用），没有就用原图 */
function pickFile(absPath) {
  const ext = path.extname(absPath);
  const medium = absPath.slice(0, -ext.length) + '_medium' + ext;
  if (fs.existsSync(medium)) return medium;
  return absPath;
}

/** 体积超限时用 ImageMagick 压一份到临时文件 */
async function shrink(absPath) {
  const out = path.join(os.tmpdir(), 'agent-vision-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg');
  try {
    const cmd = (await mediaService.resolveMagick()) || 'convert';
    await execFileAsync(cmd, [absPath, '-auto-orient', '-resize', MAX_EDGE + 'x' + MAX_EDGE + '>', '-quality', '82', out], { timeout: 20000 });
    return fs.existsSync(out) ? out : null;
  } catch (e) {
    logger.warn({ err: e && e.message }, 'vision shrink failed');
    return null;
  }
}

function mimeOf(file) {
  const e = path.extname(file).toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * 把图片附件转成 OpenAI 兼容的内容块。
 * @returns {Promise<Array<{type:'image_url',image_url:{url:string}}>>}
 */
async function buildImageParts(attachments) {
  const list = (attachments || []).filter(isImage).slice(0, MAX_IMAGES);
  const parts = [];
  for (const att of list) {
    try {
      const abs = mediaService.urlToAbsPath(att.url);
      if (!fs.existsSync(abs)) continue;
      let file = pickFile(abs);
      let stat = fs.statSync(file);
      if (stat.size > MAX_BYTES) {
        const small = await shrink(file);
        if (small) { file = small; stat = fs.statSync(file); }
      }
      const b64 = fs.readFileSync(file).toString('base64');
      parts.push({ type: 'image_url', image_url: { url: 'data:' + mimeOf(file) + ';base64,' + b64 } });
      logger.info({ url: att.url, bytes: stat.size }, 'vision attachment attached');
    } catch (e) {
      logger.warn({ err: e && e.message, url: att && att.url }, 'vision attachment failed');
    }
  }
  return parts;
}

/** 把消息内容里的图片块剥掉，只留文本（回落纯文本模型时用） */
function stripImageParts(content) {
  if (!Array.isArray(content)) return content;
  const texts = content.filter((p) => p && p.type === 'text').map((p) => p.text || '');
  return texts.join('\n');
}

/** 该上游是否支持视觉 */
function targetSupportsVision(target) {
  return !!(target && target.vision);
}

module.exports = { buildImageParts, stripImageParts, targetSupportsVision, isImage, MAX_IMAGES, MAX_BYTES, MAX_EDGE };
