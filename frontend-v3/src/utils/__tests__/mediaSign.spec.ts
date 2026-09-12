import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ensureSigned,
  signedMediaQuery,
  needsSignRefresh,
  mediaSignKey,
  readMediaSignVersion,
  resetMediaSignCache,
  signedCacheSize,
  MAX_SIGN_PATHS,
} from '@/utils/mediaSign'
import { setToken } from '@/utils/request'
import { mediaUrl } from '@/utils/media'

const A = '/uploads/albums/a.jpg'
const B = '/uploads/albums/b.jpg'
const A_THUMB = '/uploads/albums/a_thumb.jpg'
const A_MEDIUM = '/uploads/albums/a_medium.jpg'

interface Call {
  url: string
  paths: string[]
}

let calls: Call[] = []
let behavior: 'ok' | 'fail' = 'ok'
let ttlSec = 900
let tokenSeq = 0

/** 用最小 Response 替身（request.ts 只用 status / json / text） */
function installFetchMock() {
  const fn = vi.fn(async (url: string, init?: { body?: string }) => {
    const body = init && init.body ? JSON.parse(init.body) : {}
    calls.push({ url: String(url), paths: body.paths || [] })
    if (behavior === 'fail') throw new TypeError('Failed to fetch')
    const tokens: Record<string, string> = {}
    for (const p of body.paths || []) tokens[p] = 'tok' + ++tokenSeq
    return {
      status: 200,
      json: async () => ({ success: true, data: { tokens, ttlSec } }),
    } as unknown as Response
  })
  ;(globalThis as unknown as { fetch: unknown }).fetch = fn
  return fn
}

describe('媒体签名（P2-1 前端）', () => {
  let fetchMock: ReturnType<typeof installFetchMock>
  const realFetch = globalThis.fetch

  beforeEach(() => {
    resetMediaSignCache()
    calls = []
    behavior = 'ok'
    ttlSec = 900
    tokenSeq = 0
    fetchMock = installFetchMock()
    setToken('session-jwt')
  })

  afterEach(() => {
    vi.useRealTimers()
    resetMediaSignCache()
    setToken('')
    globalThis.fetch = realFetch
  })

  it('批量预取：同一 tick 的多批调用合并成一次请求', async () => {
    await Promise.all([ensureSigned([A]), ensureSigned([B])])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls[0].paths.sort()).toEqual([A, B].sort())
    expect(calls[0].url).toContain('/api/media/sign')
    expect(signedCacheSize()).toBe(2)
  })

  it('并发去重：同一路径多次调用只发一次请求，且都等到结果', async () => {
    await Promise.all([ensureSigned([A]), ensureSigned([A]), ensureSigned(A)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls[0].paths).toEqual([A])
    expect(signedMediaQuery(A)).toMatch(/^mt=tok\d+$/)
  })

  it('已在飞的路径复用请求（不再入队）', async () => {
    const first = ensureSigned([A])
    // 让 flush 先跑起来（请求在飞、尚未落缓存）
    await Promise.resolve()
    const second = ensureSigned([A])
    await Promise.all([first, second])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(signedMediaQuery(A)).toMatch(/^mt=tok\d+$/)
  })

  it('缓存命中：签名到位后不再重复请求，并自增版本号触发组件刷新', async () => {
    const before = readMediaSignVersion()
    await ensureSigned([A])
    const v1 = readMediaSignVersion()
    expect(v1).toBeGreaterThan(before)
    const first = signedMediaQuery(A)
    expect(first).toMatch(/^mt=tok\d+$/)

    await ensureSigned([A]) // 命中缓存
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(signedMediaQuery(A)).toBe(first)
    expect(readMediaSignVersion()).toBe(v1)
  })

  it('派生图共用原图签名（_thumb / _medium 只签一次）', async () => {
    await ensureSigned([A_THUMB, A_MEDIUM])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // 请求里签的是**原图**路径，派生图归一化到它
    expect(calls[0].paths).toEqual([A])
    expect(mediaSignKey(A_THUMB)).toBe(A)
    expect(mediaSignKey(A_MEDIUM)).toBe(A)
    expect(signedMediaQuery(A_THUMB)).toBe(signedMediaQuery(A))
    expect(signedMediaQuery(A_MEDIUM)).toBe(signedMediaQuery(A))
  })

  it('mediaUrl：命中签名时用 ?mt=（不再是 24h 会话 JWT）', async () => {
    await ensureSigned([A_THUMB])
    const url = mediaUrl(A_THUMB)
    expect(url.startsWith(A_THUMB + '?mt=')).toBe(true)
    expect(url).not.toContain('token=session-jwt')
  })

  it('过期前 2 分钟后台续签：续签前旧签名仍可用（不裂图），过期后置空', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t0 = Date.now()
    await ensureSigned([A])
    expect(needsSignRefresh(A)).toBe(false)
    expect(signedMediaQuery(A)).not.toBeNull()

    // 距过期 2 分钟内 → 需要续签，但仍返回可用签名
    vi.setSystemTime(t0 + (900 - 60) * 1000)
    expect(needsSignRefresh(A)).toBe(true)
    expect(signedMediaQuery(A)).not.toBeNull()

    await ensureSigned([A])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(needsSignRefresh(A)).toBe(false)

    // 续签后的新签名到期 → 不再返回签名（mediaUrl 回落到 ?token=，不会用过期签名）
    vi.setSystemTime(t0 + (900 + 840 + 60) * 1000)
    expect(signedMediaQuery(A)).toBeNull()
    expect(needsSignRefresh(A)).toBe(true)
  })

  it('失败回退：ensureSigned 不 reject，mediaUrl 继续用旧 ?token=，并在退避窗口内不再重试', async () => {
    behavior = 'fail'
    await expect(ensureSigned([A])).resolves.toBeUndefined()
    expect(signedMediaQuery(A)).toBeNull()
    expect(mediaUrl(A)).toBe(A + '?token=session-jwt')

    await ensureSigned([A])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('失败后恢复：退避窗口过了会重新尝试，成功后切到 ?mt=', async () => {
    behavior = 'fail'
    await ensureSigned([A])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 31 * 1000)
    behavior = 'ok'
    await ensureSigned([A])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mediaUrl(A).startsWith(A + '?mt=')).toBe(true)
  })

  it('未登录不请求（避免 401 触发全局登出）', async () => {
    setToken('')
    await ensureSigned([A])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mediaUrl(A)).toBe(A) // 没有会话令牌时不加参数（保持既有行为）
  })

  it('非 /uploads 路径（外链、接口地址）不参与签名', async () => {
    await ensureSigned(['https://cdn.example.com/a.jpg', '/api/album', '/uploads'])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('单批上限：超过 100 个路径自动分批', async () => {
    const many = Array.from({ length: MAX_SIGN_PATHS + 1 }, (_, i) => '/uploads/albums/p' + i + '.jpg')
    await ensureSigned(many)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(calls[0].paths).toHaveLength(MAX_SIGN_PATHS)
    expect(calls[1].paths).toHaveLength(1)
    expect(signedCacheSize()).toBe(MAX_SIGN_PATHS + 1)
  })
})
