#!/usr/bin/env node
/**
 * 清理 dist 里的历史构建产物（配合 vite.config.ts 的 emptyOutDir: false）
 *
 * 背景：保留旧 hash 文件是为了让「还跑着旧版入口包」的手机不会因为
 * 动态 import 的 chunk 404 而白屏（见 vite.config.ts 的注释）。
 * 文件不能无限增长，这里按时间清理：默认保留 7 天内的文件。
 *
 * 用法：
 *   node scripts/prune-dist.mjs            # 保留 7 天
 *   KEEP_DAYS=3 node scripts/prune-dist.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(__dirname, '..', 'dist', 'assets')
const keepDays = Number(process.env.KEEP_DAYS || 7)
const cutoff = Date.now() - keepDays * 86400000

if (!fs.existsSync(assetsDir)) {
  console.log('[prune-dist] 没有 dist/assets，跳过')
  process.exit(0)
}

let removed = 0
let kept = 0
for (const name of fs.readdirSync(assetsDir)) {
  const full = path.join(assetsDir, name)
  let st
  try { st = fs.statSync(full) } catch { continue }
  if (!st.isFile()) continue
  if (st.mtimeMs < cutoff) {
    try { fs.unlinkSync(full); removed++ } catch { /* ignore */ }
  } else {
    kept++
  }
}
console.log(`[prune-dist] 保留 ${kept} 个（${keepDays} 天内），清理 ${removed} 个历史文件`)
