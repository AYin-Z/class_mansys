import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get, post, setAuthFailureHandler, setRequestToastHandler, ApiError } from '@/utils/request'

/**
 * 请求层 P0 回归（2026-09）：
 *  - 此前 fetch 没有 signal，断网/弱网时 Promise 永不 settle，页面永久卡「加载中…」
 *  - 401 未区分 needAuth：登录接口密码错误也会触发全局登出，把已登录会话清掉
 *  - 网络错误的英文原文（TypeError: Failed to fetch）会直接弹给用户
 */
describe('request 请求层：超时 / 401 语义 / 网络错误文案', () => {
  const toasts: string[] = []
  let authFailures = 0

  beforeEach(() => {
    toasts.length = 0
    authFailures = 0
    setRequestToastHandler((m) => toasts.push(m))
    setAuthFailureHandler(() => { authFailures++ })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setRequestToastHandler(null)
    setAuthFailureHandler(null)
  })

  it('超时会真正中断请求并抛出 TIMEOUT 错误（不再永久挂起）', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      const signal = (init as RequestInit)?.signal as AbortSignal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }) as Promise<Response>
    })

    await expect(get('/api/slow', undefined, { timeout: 30 })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'TIMEOUT',
    })
    expect(toasts.join('|')).toContain('请求超时')
  })

  it('网络失败给出中文提示，而不是 Failed to fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(get('/api/x')).rejects.toMatchObject({ code: 'NETWORK', status: 0 })
    expect(toasts.join('|')).toContain('网络连接失败')
    expect(toasts.join('|')).not.toContain('Failed to fetch')
  })

  it('needAuth=false 的 401 不触发全局登出（登录密码错误不能清掉已有会话）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: '学号或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(post('/api/auth/login-with-password', {}, false)).rejects.toMatchObject({
      status: 401,
      code: 'HTTP_401',
    })
    expect(authFailures).toBe(0)
  })

  it('needAuth=true 的 401 会同步清登录态并提示一次', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: '登录已过期' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(get('/api/leave/my')).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
    expect(authFailures).toBe(1)
    expect(toasts.join('|')).toContain('登录已过期')
  })

  it('错误对象带 notified 标记，页面据此避免用兜底文案覆盖后端具体原因', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: '该时段已有请假' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const err = await get('/api/leave/my').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.notified).toBe(true)
    expect(err.code).toBe('HTTP_400')
    expect(toasts.join('|')).toContain('该时段已有请假')
  })

  it('silent=true 时不弹提示，交给页面自己处理', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: '参数错误' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(get('/api/x', undefined, { silent: true })).rejects.toMatchObject({ status: 422 })
    expect(toasts.length).toBe(0)
  })
})
