import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 契约测试：后端统一返回 { success, data } / { success, xxx }，
 * 这里锁死「API 层负责拆包」——页面只拿扁平字段。
 * 背景：曾经页面直接读 res.code / res.token，导致按钮点了没反应、令牌不显示。
 */
const get = vi.fn()
const post = vi.fn()
const del = vi.fn()
const uploadFile = vi.fn()

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => get(...args),
  post: (...args: unknown[]) => post(...args),
  del: (...args: unknown[]) => del(...args),
  uploadFile: (...args: unknown[]) => uploadFile(...args),
  apiUrl: (p: string) => 'http://test.local' + p,
}))

import {
  issueBindCode,
  listBindings,
  unbindWechat,
  listApiTokens,
  createApiToken,
  revokeApiToken,
  getBotLogin,
  startBotLogin,
  pollBotLogin,
  mcpSelfCheck,
} from '@/api/agent'

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  del.mockReset()
})

describe('agent API 拆包契约', () => {
  it('issueBindCode 返回扁平的 { code, expiresInSec }', async () => {
    post.mockResolvedValue({ success: true, data: { code: 'AB12CD', expiresInSec: 900 } })
    const res = await issueBindCode()
    expect(post).toHaveBeenCalledWith('/api/agent/channel/bind-code', {})
    expect(res.code).toBe('AB12CD')
    expect(res.expiresInSec).toBe(900)
  })

  it('createApiToken 返回扁平的 { token, prefix, allowWrite }', async () => {
    post.mockResolvedValue({ success: true, message: '请立即保存', data: { token: 'cm_abc', prefix: 'cm_abc', allowWrite: true } })
    const res = await createApiToken('我的电脑', true)
    expect(post).toHaveBeenCalledWith('/api/agent/tokens', { name: '我的电脑', allowWrite: true })
    expect(res.token).toBe('cm_abc')
    expect(res.allowWrite).toBe(true)
  })

  it('列表接口直接返回数组（绑定 / 令牌）', async () => {
    get.mockResolvedValueOnce({ success: true, bindings: [{ id: 1, channel: 'weixin', external_id: 'x', created_at: '' }] })
    expect(await listBindings()).toHaveLength(1)
    get.mockResolvedValueOnce({ success: true, tokens: [{ id: 2, name: 't', prefix: 'cm_x', created_at: '' }] })
    expect((await listApiTokens())[0].prefix).toBe('cm_x')
  })

  it('机器人登录三个接口都拆 data', async () => {
    get.mockResolvedValueOnce({ success: true, data: { connected: true, accountId: 'bot…', baseUrl: null } })
    expect((await getBotLogin()).connected).toBe(true)
    post.mockResolvedValueOnce({ success: true, data: { status: 'wait', qrDataUrl: 'data:image/png;base64,xx', expiresInSec: 300 } })
    expect((await startBotLogin()).qrDataUrl).toContain('data:image/png')
    get.mockResolvedValueOnce({ success: true, data: { status: 'confirmed', worker: 'active' } })
    expect((await pollBotLogin()).status).toBe('confirmed')
  })

  it('吊销接口不带返回值也不报错', async () => {
    del.mockResolvedValue({ success: true })
    await expect(revokeApiToken(1)).resolves.toBeUndefined()
    await expect(unbindWechat(2)).resolves.toBeUndefined()
  })

  it('mcpSelfCheck：成功拆 data，失败抛错', async () => {
    const okFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { toolCount: 38, allowWrite: false } }) })
    vi.stubGlobal('fetch', okFetch)
    const data = await mcpSelfCheck('cm_abc')
    expect(data.toolCount).toBe(38)
    expect(okFetch.mock.calls[0][0]).toBe('http://test.local/api/mcp/info')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false, error: '令牌无效或已吊销' }) }))
    await expect(mcpSelfCheck('cm_bad')).rejects.toThrow('令牌无效或已吊销')
    vi.unstubAllGlobals()
  })
})
