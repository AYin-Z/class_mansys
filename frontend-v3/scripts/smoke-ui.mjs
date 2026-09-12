#!/usr/bin/env node
/**
 * 真实浏览器冒烟（P1-1）
 *
 * 为什么需要它：2026-09 连续三次"手机白屏"，单测一个都没抓到——
 *   ① 动态 chunk 404（构建删了旧文件）
 *   ② TabBar 路径写错（/pages/index vs /pages/index/index）→ 点 tab 空白且无报错
 *   ③ 页面 class 名改了但测试里沿用旧选择器
 * 三次都是我临时起 Playwright 才定位。这个脚本把那套手工流程固化下来，跑在 CI 里。
 *
 * 检查项：
 *   1. 首页挂载且内容非空
 *   2. 逐个点击 TabBar 每个 tab：URL 命中已注册路由（不是兜底）、内容非空
 *   3. 关键页面直接访问：内容非空
 *   4. 全程任何 pageerror / 未捕获异常都算失败
 *   5. 图片类页面（相册）不报错
 *
 * 用法（CI 或本地）：
 *   SMOKE_BASE=http://127.0.0.1:3199 \
 *   SMOKE_TOKEN=<登录JWT> \
 *   CHROME_PATH=/home/ayin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome \
 *   node frontend-v3/scripts/smoke-ui.mjs
 *
 * 依赖：playwright-core（纯 JS，不下载浏览器，用 CHROME_PATH 指定本机 chromium）
 */
import { chromium, devices } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = (process.env.SMOKE_BASE || 'http://127.0.0.1:3002').replace(/\/+$/, '')
const TOKEN = process.env.SMOKE_TOKEN || ''
const USER_ID = Number(process.env.SMOKE_USER_ID || 1)
const ROLE = Number(process.env.SMOKE_USER_ROLE || 8)
/**
 * 找一个可用的 Chromium：优先 CHROME_PATH，其次 playwright 缓存里最新的 chromium，
 * 最后回退到系统 chromium。避免把某个具体的缓存版本号写死在 CI 里。
 */
function resolveChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME || '', '.cache/ms-playwright')
  try {
    const dirs = fs.readdirSync(cacheRoot)
      .filter((d) => d.startsWith('chromium-'))
      .map((d) => ({ d, m: fs.statSync(path.join(cacheRoot, d)).mtimeMs }))
      .sort((a, b) => b.m - a.m)
    for (const { d } of dirs) {
      for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = path.join(cacheRoot, d, rel)
        if (fs.existsSync(p)) return p
      }
    }
  } catch { /* ignore */ }
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome']) {
    try { return execFileSync('which', [bin], { encoding: 'utf8' }).trim() } catch { /* next */ }
  }
  return ''
}

const CHROME_PATH = resolveChrome()

/**
 * TabBar 每个 tab 点击后**必须落到的路由**。
 *
 * 这一条是 2026-09-11 事故的直接护栏：当时 tab 路径写成 /pages/index（少了 /index），
 * 点任何 tab 都匹配不到路由、内容空白且无报错。
 * 后来加了 catch-all 兜底（未知路径重定向首页），于是"内容非空"不再足以发现问题——
 * 必须断言"落到哪个路由"，否则错误路径会被兜底悄悄吞掉。
 */
const TAB_ROUTES = [
  { label: '首页', path: '/pages/index/index' },
  { label: '待办', path: '/pages/dashboard/index' },
  { label: '中队', path: '/pages/company/index' },
  { label: '助手', path: '/pages/agent/index' },
  { label: '我的', path: '/pages/profile/index' },
]

/** 期望可达、且内容非空的页面（key = 路由，value = 说明） */
const PAGES = [
  ['/pages/index/index', '首页'],
  ['/pages/dashboard/index', '待办'],
  ['/pages/company/index', '中队'],
  ['/pages/agent/index', '助手'],
  ['/pages/profile/index', '我的'],
  ['/pages/notice/index', '通知中心'],
  ['/pages/announcement/index', '公告'],
  ['/pages/leave/index', '请假'],
  ['/pages/homework/index', '作业'],
  ['/pages/fee/index', '班费'],
  ['/pages/album/index', '相册'],
  ['/pages/help/index', '用户手册'],
]

const failures = []
const notes = []

function fail(msg) {
  failures.push(msg)
  console.log(`  ❌ ${msg}`)
}

async function main() {
  if (!TOKEN) {
    console.error('缺少 SMOKE_TOKEN（登录令牌），无法冒烟')
    process.exit(2)
  }

  if (!CHROME_PATH) {
    console.error('找不到可用的 Chromium（可设置 CHROME_PATH，或安装 playwright chromium）')
    process.exit(2)
  }
  console.log(`使用浏览器：${CHROME_PATH}`)
  const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ ...devices['Pixel 5'], locale: 'zh-CN', hasTouch: true, isMobile: true })
  await ctx.addInitScript(({ token, userId, role }) => {
    localStorage.setItem('backend_token', token)
    localStorage.setItem('user_profile', JSON.stringify({ id: userId, name: '冒烟', role }))
  }, { token: TOKEN, userId: USER_ID, role: ROLE })

  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('VITE_API_BASE_URL')) pageErrors.push('console: ' + m.text().slice(0, 200))
  })
  page.on('response', (r) => {
    // 静态资源 404 是"构建产物缺失"的典型信号，必须抓出来
    if (r.status() === 404 && /\/assets\/.+\.(js|css)$/.test(r.url())) {
      pageErrors.push(`资源 404：${r.url().split('/').pop()}`)
    }
  })

  const contentLen = () => page.evaluate(() => (document.querySelector('.app-content')?.innerText || '').trim().length)
  const currentHash = () => page.evaluate(() => location.hash)
  const hasTabBar = () => page.evaluate(() => !!document.querySelector('.tab-bar'))

  // 1) 首页
  console.log('▶ 首页')
  await page.goto(`${BASE}/#/pages/index/index`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  if ((await contentLen()) < 5) fail('首页内容为空（白屏）')
  else notes.push(`首页内容 ${await contentLen()} 字符`)

  // 2) 逐个点击 tab（这正是"tab 路径写错"事故的直接覆盖点）
  console.log('▶ 逐个点击 TabBar')
  if (!(await hasTabBar())) {
    fail('首页没有 TabBar（登录态可能失效，后续导航检查无意义）')
  } else {
    const count = await page.locator('.tab-bar .tab-item').count()
    for (let i = 0; i < count; i++) {
      const raw = (await page.locator('.tab-bar .tab-item').nth(i).innerText()).replace(/\s+/g, ' ').trim()
      // 标签里可能带角标数字（如「1 待办」），用包含匹配找到期望路由
      const expected = TAB_ROUTES.find((t) => raw.includes(t.label))
      await page.locator('.tab-bar .tab-item').nth(i).click()
      await page.waitForTimeout(1200)
      const hash = await currentHash()
      const len = await contentLen()
      if (len < 5) {
        fail(`点击 tab「${raw}」后内容为空（hash=${hash}）`)
      } else if (expected && hash !== '#' + expected.path) {
        // 被 catch-all 兜回首页也算失败：说明该 tab 的路径与路由表不一致
        fail(`点击 tab「${raw}」后落在 ${hash}，期望 #${expected.path}（很可能是路由路径写错了）`)
      } else {
        notes.push(`tab「${raw}」→ ${hash} 内容 ${len} 字符`)
      }
    }
  }

  // 3) 关键页面直接访问
  console.log('▶ 直接访问关键页面')
  for (const [path, name] of PAGES) {
    await page.goto(`${BASE}/#${path}`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(900)
    const len = await contentLen()
    const panel = await page.evaluate(() => !!document.querySelector('.page-error'))
    if (panel) fail(`${name}（${path}）显示了页面级错误面板`)
    else if (len < 5) fail(`${name}（${path}）内容为空`)
    else notes.push(`${name} ${len} 字符`)
  }

  // 4) 全程错误
  if (pageErrors.length) {
    for (const e of [...new Set(pageErrors)].slice(0, 10)) fail(`运行时报错：${e}`)
  }

  await browser.close()

  console.log('\n──────── 冒烟结果 ────────')
  console.log(notes.map((n) => `  ✓ ${n}`).join('\n'))
  if (failures.length) {
    console.log(`\n失败 ${failures.length} 项：`)
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
  console.log('\n✅ 冒烟全部通过')
}

main().catch((err) => {
  console.error('冒烟脚本异常：', err?.message || err)
  process.exit(2)
})
