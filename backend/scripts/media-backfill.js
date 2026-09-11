#!/usr/bin/env node
/**
 * 存量图片回填派生图（2026-09 文件通路改造配套）
 *
 * 背景：缩略图/中图是本次改造新增的能力，**改造前上传的图片只有原图**
 * （请假证明 100+MB、相册老照片等）。前端虽然能用 `_thumb` 约定直接请求，
 * 但文件不存在时会回退到原图 —— 列表依旧慢。
 *
 * 这个脚本遍历 uploads 下所有图片，为缺少 `_thumb` / `_medium` 的图片补生成，
 * 让存量数据也享受缩略图收益（不改数据库，文件名约定与服务端一致）。
 *
 * 用法：
 *   node scripts/media-backfill.js              # 预演，只统计
 *   node scripts/media-backfill.js --yes        # 真正生成
 *   node scripts/media-backfill.js --yes --dir=leaves   # 只处理某个子目录
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mediaService = require('../services/mediaService');

const args = process.argv.slice(2);
const APPLY = args.includes('--yes');
const dirArg = args.find((a) => a.startsWith('--dir='));
const SUBDIR = dirArg ? dirArg.split('=')[1] : null;

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && IMAGE_RE.test(e.name)) out.push(full);
  }
  return out;
}

async function main() {
  const root = SUBDIR ? path.join(mediaService.UPLOAD_ROOT, SUBDIR) : mediaService.UPLOAD_ROOT;
  const files = walk(root);

  // 只处理"原图"：跳过派生图自身
  const originals = files.filter((f) => !/_(thumb|medium)\./i.test(path.basename(f)));
  let needThumb = 0;
  let needMedium = 0;
  let generated = 0;
  let bytesIn = 0;

  for (const abs of originals) {
    const ext = path.extname(abs);
    const base = abs.slice(0, -ext.length);
    const thumbCandidates = [`${base}_thumb.jpg`, `${base}_thumb.png`];
    const mediumCandidates = [`${base}_medium.jpg`, `${base}_medium.png`];
    const hasThumb = thumbCandidates.some((f) => fs.existsSync(f));
    const hasMedium = mediumCandidates.some((f) => fs.existsSync(f));
    if (!hasThumb) needThumb++;
    if (!hasMedium) needMedium++;
    if (hasThumb && hasMedium) continue;

    try { bytesIn += fs.statSync(abs).size; } catch { /* ignore */ }
    if (!APPLY) continue;

    if (!hasThumb && await mediaService.makeVariant(abs, 'thumb')) generated++;
    if (!hasMedium && await mediaService.makeVariant(abs, 'medium')) generated++;
  }

  console.log(`扫描图片 ${originals.length} 张：缺缩略图 ${needThumb} 张，缺中图 ${needMedium} 张`);
  console.log(`原图合计 ${(bytesIn / 1024 / 1024).toFixed(1)}MB`);
  if (APPLY) {
    console.log(`已生成 ${generated} 个派生图`);
    const after = walk(root).length;
    console.log(`目录文件数：${files.length} → ${after}`);
  } else {
    console.log('（预演模式，加 --yes 真正生成）');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('回填失败:', e.message);
  process.exit(1);
});
