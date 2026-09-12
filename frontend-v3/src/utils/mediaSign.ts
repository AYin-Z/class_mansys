/**
 * 媒体短期签名（P2-1 前端侧）
 *
 * 背景：/uploads 下的图片需要鉴权，而 <img src> 带不了请求头。此前只能把 24h 的会话 JWT
 * 拼进 URL（?token=），它会出现在代理/CDN 日志、Referer、用户复制的链接里，且无法按文件失效。
 *
 * 现在改成：先用登录态调 `POST /api/media/sign` 换取**短期（默认 15 分钟）+ 按路径限定**的
 * 媒体令牌（?mt=exp.sig），再渲染图片。本模块负责：
 *
 *   1. 批量预取：一屏几十张图只发一次签名请求（同一 tick 内的调用会合并成一批，≤100 个/批）；
 *   2. 内存缓存：exp 之前有效，**距过期不足 2 分钟**时后台续签（避免用户正看图时签名失效）；
 *   3. 并发去重：同一路径的多次调用共用一次请求（waiters 挂在路径上，永不 reject）；
 *   4. 失败退避：请求失败后 30s 内不再重试，避免服务异常时每个渲染帧都打接口；
 *   5. 触发刷新：签名到位后自增一个 Vue ref 版本号；mediaUrl() 读取它，
 *      于是"用过 mediaUrl 的组件"会自动重渲染，拿到新的 ?mt=。
 *
 * 与 media.ts 的分工：本模块不认识 URL 兜底策略，只提供 `signedMediaQuery()`；
 * media.ts 命中则用签名，未命中就用旧 `?token=` 兜底，**保证首屏不会裂图**。
 *
 * 派生图：服务端允许用原图路径的签名访问 `_thumb` / `_medium`，所以这里按"原图基路径"
 * 做缓存与签名（见 backend/shared/mediaToken.js 的派生图策略）。
 */
import { ref } from 'vue'
import { getToken, post } from './request'

/** 签名接口（后端 routes/media.js） */
export const MEDIA_SIGN_ENDPOINT = '/api/media/sign'
/** 后端默认 TTL 的兜底值（响应里会带 ttlSec） */
export const DEFAULT_TTL_SEC = 900
/** 提前续签窗口：距过期不足 2 分钟就后台刷新 */
export const REFRESH_MARGIN_MS = 2 * 60 * 1000
/** 签名请求失败后的退避时间 */
export const FAILURE_BACKOFF_MS = 30 * 1000
/** 与后端一致的单批上限 */
export const MAX_SIGN_PATHS = 100

interface CacheEntry {
  token: string
  /** 绝对过期时间（毫秒） */
  expiresAt: number
}

interface SignResponse {
  success?: boolean
  data?: { tokens?: Record<string, string>; ttlSec?: number; skipped?: string[] }
  tokens?: Record<string, string>
  ttlSec?: number
}

const cache = new Map<string, CacheEntry>()
/** 正在等待某路径签名的回调（无论成功失败都会被 resolve，绝不挂起调用方） */
const waiters = new Map<string, Array<() => void>>()
const inFlight = new Set<string>()
const failedUntil = new Map<string, number>()

let queue: string[] = []
let scheduled = false

/** 签名版本号：签名到位后自增，读过它的组件会自动重渲染 */
const signVersion = ref(0)

/** 供 mediaUrl() 建立响应式依赖（唯一目的是让组件跟踪这个 ref） */
export function readMediaSignVersion(): number {
  return signVersion.value
}

/** 手动触发一次刷新（一般不用，测试/登出时可用） */
export function bumpMediaSignVersion(): void {
  signVersion.value += 1
}

/** 是否是受保护的媒体路径（其余路径原样返回，不参与签名） */
export function isProtectedMedia(path?: string | null): boolean {
  // 必须 /uploads/ 下的具体文件（'/uploads' 本身不是文件，服务端也不会给它签名）
  return typeof path === 'string' && path.startsWith('/uploads/')
}

/**
 * 缓存/签名用的键：派生图归一到原图路径。
 * 服务端用原图签名即可访问 `xxx_thumb.jpg` / `xxx_medium.jpg`，因此这里只签原图，
 * 一次列表页的签名数量不会翻三倍。
 */
export function mediaSignKey(path: string): string {
  return String(path)
    .split('#')[0]
    .split('?')[0]
    .replace(/(?:_(?:thumb|medium))(\.[A-Za-z0-9]+)$/, '$1')
}

/** 命中且未过期 → 返回 `mt=<token>`；否则 null */
export function signedMediaQuery(path?: string | null): string | null {
  if (!isProtectedMedia(path)) return null
  const entry = cache.get(mediaSignKey(path as string))
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(mediaSignKey(path as string))
    return null
  }
  return 'mt=' + encodeURIComponent(entry.token)
}

/** 是否需要（重新）签名：没缓存、临近过期、或已过期 */
export function needsSignRefresh(path?: string | null): boolean {
  if (!isProtectedMedia(path)) return false
  const entry = cache.get(mediaSignKey(path as string))
  if (!entry) return true
  return entry.expiresAt - Date.now() < REFRESH_MARGIN_MS
}

function resolveWaiters(key: string) {
  const list = waiters.get(key)
  if (!list) return
  waiters.delete(key)
  for (const fn of list) {
    try {
      fn()
    } catch {
      /* 回调异常不影响其它等待者 */
    }
  }
}

function scheduleFlush() {
  if (scheduled) return
  scheduled = true
  const run = () => {
    scheduled = false
    void flush()
  }
  if (typeof queueMicrotask === 'function') queueMicrotask(run)
  else Promise.resolve().then(run)
}

async function requestBatch(paths: string[]): Promise<void> {
  const res = await post<SignResponse>(MEDIA_SIGN_ENDPOINT, { paths }, { silent: true })
  const body = (res && (res.data || res)) as SignResponse | undefined
  const tokens = (body && body.tokens) || {}
  const ttlSec = Math.max(30, Number(body && body.ttlSec) || DEFAULT_TTL_SEC)
  const expiresAt = Date.now() + ttlSec * 1000
  let got = false
  for (const key of Object.keys(tokens)) {
    const token = String(tokens[key] || '')
    if (!token) continue
    cache.set(key, { token, expiresAt })
    failedUntil.delete(key)
    got = true
  }
  if (got) signVersion.value += 1
}

async function flush(): Promise<void> {
  const paths = queue
  queue = []
  if (!paths.length) return
  for (const p of paths) inFlight.add(p)

  try {
    // 与后端一致：单批 ≤ MAX_SIGN_PATHS，超出则分批（顺序发送即可，签名很轻）
    for (let i = 0; i < paths.length; i += MAX_SIGN_PATHS) {
      const batch = paths.slice(i, i + MAX_SIGN_PATHS)
      try {
        await requestBatch(batch)
      } catch {
        // 失败不抛给调用方：mediaUrl() 会继续用旧 ?token= 兜底，避免裂图；
        // 同时退避一段时间，防止"接口挂了 → 每帧重试"。
        const until = Date.now() + FAILURE_BACKOFF_MS
        for (const p of batch) failedUntil.set(p, until)
      }
    }
  } finally {
    for (const p of paths) {
      inFlight.delete(p)
      resolveWaiters(p)
    }
  }
}

/**
 * 确保这些路径有可用的媒体签名（命中缓存则直接返回）。
 * 永不 reject —— 调用方不需要 try/catch，失败时自行回落到旧 ?token=。
 */
export function ensureSigned(paths: Array<string | null | undefined> | string | null | undefined): Promise<void> {
  // 没有会话就不请求：接口要求登录，否则只会白拿一个 401
  //（request.ts 收到 401 会清 token 并跳登录页，绝不能在没有会话时触发）
  if (!hasSession()) return Promise.resolve()

  const list = Array.isArray(paths) ? paths : [paths]
  const now = Date.now()
  const need: string[] = []
  for (const raw of list) {
    if (!isProtectedMedia(raw)) continue
    const key = mediaSignKey(raw as string)
    if (need.indexOf(key) !== -1) continue
    if (inFlight.has(key)) continue // 已有同一路径的请求在飞 → 复用
    if (!needsSignRefresh(key)) continue
    const backoff = failedUntil.get(key)
    if (backoff && backoff > now) continue // 刚失败过，先不重试
    need.push(key)
  }
  if (!need.length) return Promise.resolve()

  const waits = need.map(
    (key) =>
      new Promise<void>((resolve) => {
        const arr = waiters.get(key) || []
        arr.push(resolve)
        waiters.set(key, arr)
      })
  )
  for (const key of need) {
    if (queue.indexOf(key) === -1) queue.push(key)
  }
  scheduleFlush()
  return Promise.all(waits).then(() => undefined)
}

/** 清空缓存/队列（登出或测试用） */
export function resetMediaSignCache(): void {
  cache.clear()
  waiters.clear()
  inFlight.clear()
  failedUntil.clear()
  queue = []
  scheduled = false
}

/** 仅测试用：当前缓存里的 token 数量 */
export function signedCacheSize(): number {
  return cache.size
}

/** 配合 request.ts 的登录态：没有会话时不必请求签名（服务端也会 401） */
export function hasSession(): boolean {
  return !!getToken()
}
