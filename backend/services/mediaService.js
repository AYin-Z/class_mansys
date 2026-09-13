/**
 * 媒体文件处理服务（2026-09 文件通路改造）
 *
 * 解决的问题：
 *  1. 相册网格/列表此前直接加载原图（单张 3–8MB），一个 30 张的相册在手机上
 *     要下 100MB+ —— 这就是"相册不可用"的根本原因；
 *  2. 上传端点七零八落（leave/album/fee/homework/announcement/agent 各一套
 *     multer 配置与目录），响应字段也不统一；
 *  3. 文件删了库里还留着 URL，或者反过来，没有反查能力。
 *
 * 本服务提供：
 *  - store(file, opts)：落盘 + 生成 thumb/medium 派生图 + 返回统一元数据
 *  - removeByUrl(url)：删除文件及其派生图（照片被驳回/相册被删时调用）
 *  - 派生图生成优先用 ImageMagick（magick/convert，宿主机已有），
 *    没有则优雅降级（不生成派生图，前端回落到原图），绝不因为缺工具而让上传失败。
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

/** 允许的图片类型（派生图只对图片有意义） */
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** 派生图规格：够用就好，避免一次上传做太多 CPU 工作 */
const VARIANTS = {
  thumb: { size: 480, quality: 78, suffix: '_thumb' },
  medium: { size: 1440, quality: 82, suffix: '_medium' },
};

let magickCmd = null; // 'magick' | 'convert' | null（未知/不可用）
let magickProbed = false;

/** 探测可用的 ImageMagick 命令（只探测一次） */
async function resolveMagick() {
  if (magickProbed) return magickCmd;
  magickProbed = true;
  for (const cmd of ['magick', 'convert']) {
    try {
      await execFileAsync(cmd, ['-version'], { timeout: 5000 });
      magickCmd = cmd;
      return magickCmd;
    } catch { /* 试下一个 */ }
  }
  console.warn('[media] 未找到 ImageMagick（magick/convert），将不生成缩略图');
  return null;
}

function isImageFile(filePathOrName) {
  return IMAGE_EXTS.has(path.extname(String(filePathOrName || '')).toLowerCase());
}

/** 相对 /uploads 的 URL → 绝对路径（防止路径穿越） */
function urlToAbsPath(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  const abs = path.resolve(UPLOAD_ROOT, rel);
  if (!abs.startsWith(path.resolve(UPLOAD_ROOT))) return null; // 越界拒绝
  return abs;
}

function absPathToUrl(abs) {
  const rel = path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');
  return '/uploads/' + rel;
}

/**
 * 生成一档派生图（就地写文件）
 * @returns 派生图的绝对路径；失败返回 null（不抛错）
 */
async function makeVariant(srcAbs, variantKey) {
  const spec = VARIANTS[variantKey];
  if (!spec) return null;
  const cmd = await resolveMagick();
  if (!cmd) return null;

  const ext = path.extname(srcAbs).toLowerCase();
  const base = srcAbs.slice(0, -ext.length);
  // 统一输出 jpg（体积可控、兼容性最好）；png 透明图用 png 保留透明通道
  const outExt = ext === '.png' ? '.png' : '.jpg';
  const outAbs = `${base}${spec.suffix}${outExt}`;

  const args = [
    srcAbs,
    '-auto-orient',      // 按 EXIF 旋转，避免手机竖拍照片侧躺
    '-strip',            // 去掉 EXIF（含 GPS），保护隐私并减小体积
    '-resize', `${spec.size}x${spec.size}>`, // 只缩小不放大
    '-quality', String(spec.quality),
    outAbs,
  ];

  try {
    await execFileAsync(cmd, args, { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const st = await fsp.stat(outAbs);
    if (!st.size) return null;
    return outAbs;
  } catch (err) {
    console.warn('[media] 派生图生成失败:', variantKey, err.message);
    return null;
  }
}

/**
 * 服务端二次压缩（P1-2）
 *
 * 客户端上传前的 canvas 压缩只在"走我们页面"时生效：直接调接口、
 * 或者以后别的客户端接入，仍可能把 6–25MB 的原图直接落盘。
 * 这里对落盘的图片做一次兜底优化：
 *   - 长边 > 2560 → 等比缩到 2560
 *   - 体积 > 2MB → 以 quality 82 重新编码
 * 原地替换（先写临时文件再 rename，避免写到一半被读到）。
 * 任何一步失败都保留原文件，绝不让上传失败。
 *
 * @returns {{ optimized: boolean, before: number, after: number }}
 */
async function optimizeOriginal(abs, { maxEdge = 2560, minBytes = 2 * 1024 * 1024, quality = 82 } = {}) {
  let stat;
  try { stat = await fsp.stat(abs); } catch { return { optimized: false, before: 0, after: 0 }; }
  const before = stat.size;
  const dim = await readImageSize(abs);
  const tooBig = dim ? Math.max(dim.width, dim.height) > maxEdge : false;
  const tooHeavy = before > minBytes;
  if (!tooBig && !tooHeavy) return { optimized: false, before, after: before };

  const cmd = await resolveMagick();
  if (!cmd) return { optimized: false, before, after: before };

  const ext = path.extname(abs).toLowerCase();
  // 统一输出 jpg（png 若带透明通道则保持 png，避免透明变黑）
  const keepPng = ext === '.png';
  const outExt = keepPng ? '.png' : '.jpg';
  const tmp = abs + '.opt' + outExt;

  const args = [abs, '-auto-orient', '-strip'];
  if (tooBig) args.push('-resize', `${maxEdge}x${maxEdge}>`);
  args.push('-quality', String(quality), tmp);

  try {
    await execFileAsync(cmd, args, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const outStat = await fsp.stat(tmp);
    // 压缩后反而更大就丢弃结果
    if (!outStat.size || outStat.size >= before) {
      await fsp.unlink(tmp).catch(() => {});
      return { optimized: false, before, after: before };
    }
    const finalPath = outExt === ext ? abs : abs.slice(0, -ext.length) + outExt;
    await fsp.rename(tmp, finalPath);
    if (finalPath !== abs) await fsp.unlink(abs).catch(() => {});
    return { optimized: true, before, after: outStat.size };
  } catch (err) {
    await fsp.unlink(tmp).catch(() => {});
    console.warn('[media] 原图二次压缩失败（保留原文件）:', err.message);
    return { optimized: false, before, after: before };
  }
}

/** 读取图片尺寸（ImageMagick identify；失败返回 null） */
async function readImageSize(abs) {
  const cmd = await resolveMagick();
  if (!cmd) return null;
  try {
    const { stdout } = await execFileAsync(cmd, ['identify', '-format', '%w %h', abs], { timeout: 8000 });
    const [w, h] = String(stdout).trim().split(/\s+/).map(Number);
    return Number.isFinite(w) && Number.isFinite(h) ? { width: w, height: h } : null;
  } catch {
    return null;
  }
}

/**
 * 落盘后的统一处理：生成派生图 + 收集元数据
 *
 * @param {{ path: string, filename: string, originalname: string, mimetype: string, size: number }} file multer 文件对象
 * @param {{ kind?: string, ownerId?: number, classId?: string }} meta
 * @returns {Promise<{url, thumbUrl, mediumUrl, filename, size, width, height, mime, kind}>}
 */
async function describe(file, meta = {}) {
  const abs = file.path;
  const url = absPathToUrl(abs);
  const isImage = isImageFile(file.filename || file.originalname);

  let thumbUrl = null;
  let mediumUrl = null;
  let width = null;
  let height = null;

  if (isImage) {
    // 先兜底压缩原图，再生成派生图（保证派生图也来自优化后的源）
    const opt = await optimizeOriginal(abs);
    if (opt.optimized) {
      file.size = opt.after;
      console.log(`[media] 原图压缩 ${(opt.before / 1024 / 1024).toFixed(1)}MB → ${(opt.after / 1024).toFixed(0)}KB`);
    }
    const thumb = await makeVariant(abs, 'thumb');
    if (thumb) thumbUrl = absPathToUrl(thumb);
    const medium = await makeVariant(abs, 'medium');
    if (medium) mediumUrl = absPathToUrl(medium);
    const dim = await readImageSize(abs);
    if (dim) {
      width = dim.width;
      height = dim.height;
    }
  }

  return {
    url,
    thumbUrl,
    mediumUrl,
    filename: file.originalname,
    size: file.size,
    width,
    height,
    mime: file.mimetype,
    kind: meta.kind || 'resource',
  };
}

/** 删除文件及其派生图（幂等，绝不抛错） */
async function removeByUrl(url) {
  const abs = urlToAbsPath(url);
  if (!abs) return false;
  const ext = path.extname(abs).toLowerCase();
  const base = abs.slice(0, -ext.length);
  const candidates = [abs];
  for (const spec of Object.values(VARIANTS)) {
    candidates.push(`${base}${spec.suffix}${ext}`);
    candidates.push(`${base}${spec.suffix}.jpg`);
    candidates.push(`${base}${spec.suffix}.png`);
  }
  let removed = false;
  for (const f of candidates) {
    try {
      await fsp.unlink(f);
      removed = true;
    } catch { /* 不存在就跳过 */ }
  }
  return removed;
}

/**
 * 相册相关的权限口径（2026-09 统一）
 *
 * 历史问题：详情页用 `isAdmin(role>=8)` 判断"是否看到待审核照片"，
 * 上传免审用 `role>=8 || 相册创建者`，而权限矩阵里的 APPROVE_PHOTO
 * 可以单独授予 role<8 的干部 —— 导致"配了审核权限却看不到待审照片"，
 * 以及"有审核权的人自己上传还要等别人审"。
 * 这里统一成：**有 APPROVE_PHOTO 权限或相册创建者**。
 */
async function canApprovePhotos(user) {
  try {
    const { hasPermission } = require('../shared/permissions');
    return await hasPermission(user, 'APPROVE_PHOTO');
  } catch {
    return Number(user?.role) >= 8;
  }
}

/** 生成一个不会冲突的文件名（保留扩展名） */
function uniqueName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

module.exports = {
  UPLOAD_ROOT,
  canApprovePhotos,
  VARIANTS,
  isImageFile,
  urlToAbsPath,
  absPathToUrl,
  makeVariant,
  describe,
  optimizeOriginal,
  removeByUrl,
  uniqueName,
  readImageSize,
  resolveMagick,
  _internals: { resolveMagick, magickProbed },
};
