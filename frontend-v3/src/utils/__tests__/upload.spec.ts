import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressImage, uploadBatch, uploadWithProgress } from '@/utils/upload'

/** 造一个假图片文件 */
function fakeImage(name = 'a.jpg', size = 2 * 1024 * 1024, type = 'image/jpeg') {
  return new File([new Uint8Array(size)], name, { type })
}

describe('上传管线（压缩 / 进度 / 批量重试）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('小图不压缩（<400KB 直接原样上传）', async () => {
    const f = fakeImage('small.jpg', 100 * 1024)
    expect(await compressImage(f)).toBe(f)
  })

  it('非图片不压缩', async () => {
    const f = new File([new Uint8Array(1024)], 'a.pdf', { type: 'application/pdf' })
    expect(await compressImage(f)).toBe(f)
  })

  it('环境不支持 createImageBitmap 时安全降级为原图', async () => {
    const orig = (globalThis as any).createImageBitmap
    ;(globalThis as any).createImageBitmap = undefined
    const f = fakeImage('big.jpg', 2 * 1024 * 1024)
    expect(await compressImage(f)).toBe(f)
    ;(globalThis as any).createImageBitmap = orig
  })

  it('uploadBatch：非图片在 imagesOnly 下标记失败且不发起请求', async () => {
    const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const files = [new File([new Uint8Array(10)], 'x.txt', { type: 'text/plain' })]
    const states = await uploadBatch(files, { kind: 'album', imagesOnly: true, retries: 0 })
    expect(states[0].status).toBe('failed')
    expect(states[0].error).toContain('不是图片')
    expect(xhrSpy).not.toHaveBeenCalled()
  })

  it('uploadBatch：失败会按 retries 重试，并在耗尽后记为 failed', async () => {
    let calls = 0
    vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {})
    vi.spyOn(XMLHttpRequest.prototype, 'setRequestHeader').mockImplementation(() => {})
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      calls++
      setTimeout(() => {
        this.onerror?.(new ProgressEvent('error'))
      }, 0)
    })
    const files = [fakeImage('a.jpg', 10 * 1024)]
    const states = await uploadBatch(files, { kind: 'album', retries: 1, concurrency: 1 })
    expect(states[0].status).toBe('failed')
    expect(calls).toBe(2) // 首次 + 1 次重试
  })

  it('uploadWithProgress：成功解析 data 字段并回调 100%', async () => {
    vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {})
    vi.spyOn(XMLHttpRequest.prototype, 'setRequestHeader').mockImplementation(() => {})
    vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
      setTimeout(() => {
        Object.defineProperty(this, 'status', { value: 200 })
        Object.defineProperty(this, 'responseText', {
          value: JSON.stringify({ success: true, data: { url: '/uploads/albums/a.jpg', thumbUrl: '/uploads/albums/a_thumb.jpg', filename: 'a.jpg', size: 123 } }),
        })
        this.onload?.(new ProgressEvent('load'))
      }, 0)
    })
    const percents: number[] = []
    const res = await uploadWithProgress('/api/media/upload?kind=album', fakeImage('a.jpg', 1024), {}, {
      onProgress: (p) => percents.push(p),
    })
    expect(res.url).toBe('/uploads/albums/a.jpg')
    expect(res.thumbUrl).toContain('_thumb')
    expect(percents).toContain(100)
  })
})
