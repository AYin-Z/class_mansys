/**
 * 统一文件上传端点（2026-09 文件通路改造）
 *
 * 为什么要有它：此前 leave / album / fee / homework / announcement / agent
 * 各自一套 multer 配置、各自一个 URL、返回字段也不一致（有的给 url，
 * 有的给 data.url），前端只能一处一处写死，新增功能就得再复制一套。
 *
 * 现在统一为：
 *   POST /api/media/upload?kind=<album|proof|resource|agent|homework>
 *     表单字段：file（必填）、album_id（相册需要）、description（可选）
 *   返回：{ success, url, thumbUrl, mediumUrl, filename, size, width, height, mime, id?, autoApproved? }
 *
 * 媒体访问签名（P2-1）：
 *   POST /api/media/sign  { paths: string[] }   （≤100 个，需登录）
 *     返回：{ success, data: { tokens: { [path]: 'exp.sig' }, ttlSec, skipped: string[] } }
 *   前端把这些令牌拼成 `?mt=<token>` 访问 /uploads（见 frontend-v3/src/utils/mediaSign.ts），
 *   替代此前把 24h 会话 JWT 放进图片 URL 的做法。
 *
 * 兼容策略：老的端点（/api/album/photos/upload、/api/leave/upload-proof …）
 * 保留不动，内部同样走 mediaService，避免线上旧 APK 失效。
 */
const express = require('express');
const path = require('path');
const router = express.Router();
const multer = require('multer');

const mediaService = require('../services/mediaService');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { resolveScope, canAccessOwnClassRecord } = require('../shared/scope');
const { asyncHandler, ok, fail } = require('../shared/http');
const { signMediaToken, isSafeMediaPath, DEFAULT_TTL_SEC, MAX_TTL_SEC } = require('../shared/mediaToken');

/** 单次签名请求的路径上限：一次列表页（网格+查看器预取）通常 ≤60，100 足够且能挡住滥用 */
const MAX_SIGN_PATHS = 100;

/** 每种用途的目录、体积上限与允许类型 */
const KINDS = {
  album: { dir: 'albums', maxSize: 25 * 1024 * 1024, imagesOnly: true },
  proof: { dir: 'leaves', maxSize: 10 * 1024 * 1024, imagesOnly: true },
  resource: { dir: 'resources', maxSize: 100 * 1024 * 1024, imagesOnly: false },
  agent: { dir: 'agent', maxSize: 20 * 1024 * 1024, imagesOnly: true },
  homework: { dir: 'resources', maxSize: 100 * 1024 * 1024, imagesOnly: false },
  fee: { dir: 'resources', maxSize: 100 * 1024 * 1024, imagesOnly: false },
};

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip']);
const DOC_MIMES = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'application/zip', 'application/x-zip-compressed',
]);

/** 按 kind 动态构造 multer（存储目录 + 校验 + 上限） */
function uploaderFor(kind) {
  const cfg = KINDS[kind] || KINDS.resource;
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(mediaService.UPLOAD_ROOT, cfg.dir)),
    filename: (_req, file, cb) => cb(null, mediaService.uniqueName(file.originalname)),
  });
  return multer({
    storage,
    limits: { fileSize: cfg.maxSize },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const isImg = IMAGE_EXTS.has(ext) && IMAGE_MIMES.has(file.mimetype);
      if (isImg) return cb(null, true);
      if (cfg.imagesOnly) return cb(new Error('该上传点仅支持图片（jpg/png/gif/webp）'));
      if (DOC_EXTS.has(ext) && DOC_MIMES.has(file.mimetype)) return cb(null, true);
      return cb(new Error('不支持的文件类型'));
    },
  });
}

/** 把 { url, thumbUrl, mediumUrl … } 记入 media_assets，便于反查与清理 */
async function recordAsset(info, meta) {
  try {
    await db.query(
      `INSERT INTO media_assets (url, thumb_url, medium_url, kind, owner_id, class_id, filename, mime, size, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE thumb_url = VALUES(thumb_url), medium_url = VALUES(medium_url)`,
      [
        info.url, info.thumbUrl, info.mediumUrl, info.kind,
        meta.ownerId || null, meta.classId || null,
        info.filename, info.mime, info.size, info.width, info.height,
      ]
    );
  } catch (err) {
    // 记录失败不影响上传本身
    console.warn('[media] media_assets 写入失败:', err.message);
  }
}

/**
 * 统一上传入口
 * kind 决定目录与校验；album 额外做归属校验并直接建照片记录
 */
router.post('/upload', authenticateToken, (req, res, next) => {
  const kind = String(req.query.kind || req.body?.kind || 'resource');
  if (!KINDS[kind]) return fail(res, 400, '不支持的上传类型：' + kind, 'BAD_KIND');
  req.mediaKind = kind;
  return uploaderFor(kind).single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `文件超过大小限制（${Math.round((KINDS[kind].maxSize || 0) / 1024 / 1024)}MB）`
        : err.message || '上传失败';
      return fail(res, 400, msg, 'UPLOAD_REJECTED');
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  const kind = req.mediaKind;
  if (!req.file) return fail(res, 400, '请选择文件', 'NO_FILE');

  const scope = await resolveScope(req.user);
  const uploadScopeClassId = scope.writeClassId || null;

  // 相册：校验归属 + 直接建照片记录（与旧端点行为一致：创建者/管理员免审）
  if (kind === 'album') {
    const albumId = parseInt(req.body?.album_id, 10);
    if (!albumId) {
      await mediaService.removeByUrl(mediaService.absPathToUrl(req.file.path));
      return fail(res, 400, '缺少相册 ID', 'NO_ALBUM');
    }
    const [albums] = await db.query('SELECT * FROM albums WHERE id = ?', [albumId]);
    const album = albums[0];
    if (!album) {
      await mediaService.removeByUrl(mediaService.absPathToUrl(req.file.path));
      return fail(res, 404, '相册不存在', 'ALBUM_NOT_FOUND');
    }
    if (!canAccessOwnClassRecord(album, scope)) {
      await mediaService.removeByUrl(mediaService.absPathToUrl(req.file.path));
      return fail(res, 403, '无权向该相册上传', 'FORBIDDEN');
    }

    const info = await mediaService.describe(req.file, { kind, ownerId: req.user.id, classId: uploadScopeClassId });
    // 与 /api/album/photos/upload 保持同一口径：有审核权的人或相册创建者免审
    const autoApprove = (await mediaService.canApprovePhotos(req.user))
      || Number(album.creator_id) === Number(req.user.id);

    const [result] = await db.query(
      `INSERT INTO photos (album_id, url, thumb_url, medium_url, width, height, size, mime, description, uploader_id, is_approved, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        albumId, info.url, info.thumbUrl, info.mediumUrl, info.width, info.height, info.size, info.mime,
        req.body?.description || '', req.user.id, autoApprove ? 1 : 0,
        autoApprove ? req.user.id : null, autoApprove ? new Date() : null,
      ]
    );
    await recordAsset(info, { ownerId: req.user.id, classId: uploadScopeClassId });
    return ok(res, {
      id: result.insertId,
      url: info.url,
      thumbUrl: info.thumbUrl,
      mediumUrl: info.mediumUrl,
      filename: info.filename,
      size: info.size,
      width: info.width,
      height: info.height,
      autoApproved: autoApprove,
    }, { message: autoApprove ? '上传成功' : '上传成功，等待审核' });
  }

  // 其它用途：只落盘 + 记元数据，业务表由各自接口写入 URL
  const info = await mediaService.describe(req.file, { kind, ownerId: req.user.id, classId: uploadScopeClassId });
  await recordAsset(info, { ownerId: req.user.id, classId: uploadScopeClassId });
  return ok(res, {
    url: info.url,
    thumbUrl: info.thumbUrl,
    mediumUrl: info.mediumUrl,
    filename: info.filename,
    size: info.size,
    width: info.width,
    height: info.height,
    mime: info.mime,
  }, { message: '上传成功' });
}));

/** 删除自己上传的文件（相册照片有独立接口，这里给其它用途兜底） */
router.delete('/asset', authenticateToken, asyncHandler(async (req, res) => {
  const url = String(req.query.url || '');
  if (!url.startsWith('/uploads/')) return fail(res, 400, '非法的文件地址', 'BAD_URL');
  const [rows] = await db.query('SELECT * FROM media_assets WHERE url = ?', [url]);
  const asset = rows[0];
  if (!asset) return fail(res, 404, '文件不存在', 'NOT_FOUND');
  const isOwner = Number(asset.owner_id) === Number(req.user.id);
  const isAdmin = Number(req.user.role) >= 8;
  if (!isOwner && !isAdmin) return fail(res, 403, '只能删除自己上传的文件', 'FORBIDDEN');
  await mediaService.removeByUrl(url);
  await db.query('DELETE FROM media_assets WHERE url = ?', [url]);
  return ok(res, { url }, { message: '已删除' });
}));

/**
 * 批量签发媒体访问令牌（P2-1）
 *
 * 入参：{ paths: string[] }（≤ MAX_SIGN_PATHS 个）
 * 出参：{ tokens: { [path]: 'exp.sig' }, ttlSec, skipped: string[] }
 *
 * 权限口径：只签 `/uploads/` 下的具体文件路径，并拒绝 `..`、反斜杠、空字节等越界写法。
 * 这里不额外做"文件是否存在/属于谁"的查询：/uploads 下的内容本身对所有已登录用户可读
 * （相册/证明的**业务**可见性由各自的列表接口决定，媒体层从来只要求登录），
 * 加上路径白名单即可，避免为每个路径再加一次 DB 查询。
 *
 * 非法路径**不报错、只跳过**（响应里回 skipped）：前端拿到后对这些路径回落到旧 ?token= 兜底，
 * 不会因为一个坏路径让整批图片裂图。
 */
router.post('/sign', authenticateToken, asyncHandler(async (req, res) => {
  const raw = req.body ? req.body.paths : null;
  if (!Array.isArray(raw) || raw.length === 0) {
    return fail(res, 400, 'paths 必须是非空数组', 'BAD_PATHS');
  }
  if (raw.length > MAX_SIGN_PATHS) {
    return fail(res, 400, `单次最多签名 ${MAX_SIGN_PATHS} 个路径`, 'TOO_MANY_PATHS');
  }

  const ttlSec = Math.min(Math.max(Number(req.body.ttlSec) || DEFAULT_TTL_SEC, 30), MAX_TTL_SEC);
  const tokens = {};
  const skipped = [];
  for (const item of raw) {
    const p = typeof item === 'string' ? item.trim() : '';
    if (!isSafeMediaPath(p)) {
      skipped.push(String(item == null ? '' : item).slice(0, 200));
      continue;
    }
    // 同一个路径重复出现时只签一次（token 与时间戳相关，复用同一个值便于前端缓存）
    if (!tokens[p]) {
      tokens[p] = signMediaToken(p, { ttlSec, userId: req.user && req.user.id });
    }
  }
  return ok(res, { tokens, ttlSec, skipped });
}));

/** 上传能力自检：前端可用来提示"支持的格式与大小" */
router.get('/config', authenticateToken, (req, res) => {
  const out = {};
  for (const [k, v] of Object.entries(KINDS)) {
    out[k] = { maxSize: v.maxSize, imagesOnly: v.imagesOnly, dir: v.dir };
  }
  return ok(res, { kinds: out, variants: Object.keys(mediaService.VARIANTS) });
});

module.exports = router;
