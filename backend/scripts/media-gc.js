#!/usr/bin/env node
/**
 * 媒体孤儿文件清理（2026-09 文件通路改造配套）
 *
 * 背景：上传过的文件如果业务记录被删（请假撤销、照片驳回、相册删除、
 * 通知删除…），磁盘上的文件不一定会被清掉；反过来，数据库里也可能留着
 * 指向已删文件的 URL。这个脚本做两个方向的巡检：
 *
 *   1. 孤儿文件：uploads/** 下存在、但没有任何业务表引用，且 mtime 超过 N 天
 *   2. 死链接  ：数据库里有 URL、但文件已不存在（只报告，不自动改数据）
 *
 * 默认 **dry-run**（只报告），确认无误后加 --yes 才真正删除。
 *
 * 用法：
 *   node scripts/media-gc.js                 # 巡检，列出孤儿文件与死链接
 *   node scripts/media-gc.js --days=30       # 只把 30 天前的文件视为可删
 *   node scripts/media-gc.js --yes           # 真正删除孤儿文件
 *   node scripts/media-gc.js --json          # 机器可读输出
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const args = process.argv.slice(2);
const APPLY = args.includes('--yes');
const AS_JSON = args.includes('--json');
const daysArg = args.find((a) => a.startsWith('--days='));
const KEEP_DAYS = daysArg ? Number(daysArg.split('=')[1]) : 14;
const cutoff = Date.now() - KEEP_DAYS * 86400000;

/** 递归列出 uploads 下所有文件 */
function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

/** 相对 /uploads 的 URL */
function toUrl(abs) {
  return '/uploads/' + path.relative(UPLOAD_ROOT, abs).split(path.sep).join('/');
}

/** 收集数据库里所有被引用的文件 URL（含派生图） */
async function collectReferencedUrls() {
  const urls = new Set();
  const addAll = (list) => {
    for (const u of list) {
      if (typeof u === 'string' && u.startsWith('/uploads/')) urls.add(u);
    }
  };

  // media_assets 索引表（新上传都会记录）
  try {
    const [rows] = await db.query('SELECT url, thumb_url, medium_url FROM media_assets');
    addAll(rows.flatMap((r) => [r.url, r.thumb_url, r.medium_url]));
  } catch { /* 表可能尚未迁移 */ }

  // 照片（相册）
  try {
    const [rows] = await db.query('SELECT url, thumb_url, medium_url FROM photos');
    addAll(rows.flatMap((r) => [r.url, r.thumb_url, r.medium_url]));
  } catch { /* ignore */ }

  // 各类表里的 URL 字段 / JSON 数组字段
  const scans = [
    ['leaves', ['attachments']],
    ['expenses', ['proof_url']],
    ['homework', ['attachments']],
    ['homework_submissions', ['file_url', 'attachment_url', 'attachments']],
    ['notices', ['attachments']],
    ['announcements', ['attachments']],
    ['album_photos', ['url']],
    ['challenges', ['proof_urls', 'attachments']],
    ['challenge_applications', ['proof_urls']],
    ['users', ['avatarUrl']],
    ['psychological_records', ['attachments']],
    ['agent_messages', ['attachments']],
  ];
  for (const [table, columns] of scans) {
    for (const col of columns) {
      try {
        const [rows] = await db.query(`SELECT \`${col}\` AS v FROM \`${table}\``);
        for (const r of rows) {
          const v = r.v;
          if (typeof v === 'string') {
            if (v.startsWith('/uploads/')) urls.add(v);
            else if (v.startsWith('[')) {
              try { addAll(JSON.parse(v)); } catch { /* 非 JSON */ }
            }
          } else if (Array.isArray(v)) {
            addAll(v);
          }
        }
      } catch { /* 表/列不存在就跳过 */ }
    }
  }
  return urls;
}

async function main() {
  const files = walk(UPLOAD_ROOT);
  const referenced = await collectReferencedUrls();

  const orphans = [];
  const missing = [];
  const statOf = (f) => { try { return fs.statSync(f); } catch { return null; } };

  for (const abs of files) {
    const url = toUrl(abs);
    // 派生图跟着原图一起判断：只要原图被引用，派生图就不算孤儿
    const isVariant = /_(thumb|medium)\.(jpg|jpeg|png|webp)$/i.test(url);
    const baseUrl = isVariant ? url.replace(/_(thumb|medium)(\.\w+)$/i, '$2') : url;
    if (referenced.has(url) || referenced.has(baseUrl)) continue;
    const st = statOf(abs);
    if (!st || st.mtimeMs > cutoff) continue; // 太新的不动，避免删掉"刚上传还没落库"的文件
    orphans.push({ url, size: st.size, mtime: st.mtime.toISOString() });
  }

  for (const url of referenced) {
    const abs = path.join(UPLOAD_ROOT, url.slice('/uploads/'.length));
    if (!fs.existsSync(abs)) missing.push(url);
  }

  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);
  const report = {
    scannedFiles: files.length,
    referencedUrls: referenced.size,
    keepDays: KEEP_DAYS,
    orphans: orphans.length,
    orphanBytes,
    missingFiles: missing.length,
    mode: APPLY ? 'apply' : 'dry-run',
  };

  if (AS_JSON) {
    // --all 时输出完整清单（供交叉校验/自动化使用）
    const all = args.includes('--all');
    console.log(JSON.stringify({
      report,
      orphans: all ? orphans : orphans.slice(0, 50),
      missingFiles: all ? missing : missing.slice(0, 50),
    }, null, 2));
  } else {
    console.log(`扫描上传目录：${files.length} 个文件，数据库引用 ${referenced.size} 个 URL（保留 ${KEEP_DAYS} 天内的新文件）`);
    console.log(`孤儿文件：${orphans.length} 个，共 ${(orphanBytes / 1024 / 1024).toFixed(2)} MB`);
    for (const o of orphans.slice(0, 20)) console.log(`  - ${o.url}  ${(o.size / 1024).toFixed(0)}KB  ${o.mtime.slice(0, 10)}`);
    if (orphans.length > 20) console.log(`  … 其余 ${orphans.length - 20} 个省略`);
    console.log(`数据库中指向已删文件的死链接：${missing.length} 个`);
    for (const m of missing.slice(0, 10)) console.log(`  ! ${m}`);
  }

  if (APPLY && orphans.length) {
    let removed = 0;
    for (const o of orphans) {
      try { fs.unlinkSync(path.join(UPLOAD_ROOT, o.url.slice('/uploads/'.length))); removed++; } catch { /* ignore */ }
    }
    if (AS_JSON) console.error(`已删除 ${removed} 个孤儿文件`);
    else console.log(`已删除 ${removed} 个孤儿文件`);
  } else if (!APPLY && orphans.length && !AS_JSON) {
    console.log('（当前是 dry-run，确认无误后加 --yes 执行删除）');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('media-gc 执行失败:', err.message);
    process.exit(1);
  });
