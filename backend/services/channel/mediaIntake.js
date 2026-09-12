/**
 * 微信入站媒体的落盘与登记
 *
 * 收到的图片/文件要变成系统内的附件（`/uploads/...` 的 URL），才能交给 Agent 当附件用
 * （请假证明、相册照片正是现成的用途）。这里复用 `mediaService`，与 App 内上传走同一套：
 * 图片会自动生成 thumb/medium 变体、写入 media_assets 登记表，口径完全一致。
 */
const fs = require('fs');
const path = require('path');
const mediaService = require('../mediaService');
const logger = require('../../config/logger');

/** 图片进 agent 目录（与 App 内对话上传同一目录），其余进 resources（允许非图片） */
function dirFor(kind) {
  return kind === 'image' ? 'agent' : 'resources';
}

function extFor(kind, filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (ext) return ext;
  if (kind === 'image') return '.jpg';
  if (kind === 'video') return '.mp4';
  if (kind === 'voice') return '.silk';
  return '.bin';
}

/**
 * 保存一份入站媒体并返回附件描述（可直接塞进 Agent 的 attachments）。
 *
 * @param {Buffer} buffer 解密后的明文
 * @param {{kind?:string, filename?:string, ownerId?:number, classId?:number}} opts
 * @returns {Promise<{url:string, name:string, mime:string, size:number, kind:string}>}
 */
async function saveInboundMedia(buffer, opts = {}) {
  const kind = opts.kind || 'file';
  const dir = dirFor(kind);
  const base = mediaService.uniqueName('wx' + extFor(kind, opts.filename));
  const absDir = path.join(mediaService.UPLOAD_ROOT, dir);
  fs.mkdirSync(absDir, { recursive: true });
  const absPath = path.join(absDir, base);
  fs.writeFileSync(absPath, buffer);

  const fakeFile = {
    path: absPath,
    filename: base,
    originalname: opts.filename || base,
    size: buffer.length,
    mimetype: opts.mime || undefined
  };

  // describe 会做原图优化 + 生成变体（图片），与 App 内上传同一套处理
  const info = await mediaService.describe(fakeFile, { kind: dir === 'agent' ? 'agent' : 'resource', ownerId: opts.ownerId });

  logger.info(
    { kind, dir, bytes: buffer.length, url: info.url, width: info.width, height: info.height },
    'wechat inbound media saved'
  );

  return {
    url: info.url,
    name: opts.filename || base,
    mime: info.mime || 'application/octet-stream',
    size: info.size || buffer.length,
    kind
  };
}

module.exports = { saveInboundMedia, dirFor, extFor };
