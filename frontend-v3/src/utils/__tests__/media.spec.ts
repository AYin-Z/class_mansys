import { describe, it, expect, beforeEach, vi } from 'vitest'
import { thumbUrl, mediumUrl, mediaUrl, onThumbError, preloadImage, neighborIndexes, downloadMedia } from '@/utils/media'
import { setToken } from '@/utils/request'

describe('媒体地址工具（派生图约定 + 回退）', () => {
  beforeEach(() => setToken('t'))
  it('按命名约定推导缩略图/中图地址', () => {
    expect(thumbUrl('/uploads/leaves/a.jpg')).toBe('/uploads/leaves/a_thumb.jpg')
    expect(mediumUrl('/uploads/leaves/a.jpg')).toBe('/uploads/leaves/a_medium.jpg')
    expect(thumbUrl('/uploads/albums/b.PNG')).toBe('/uploads/albums/b_thumb.PNG')
  })
  it('已经是派生图则原样返回（避免重复后缀）', () => {
    expect(thumbUrl('/uploads/a_thumb.jpg')).toBe('/uploads/a_thumb.jpg')
    expect(mediumUrl('/uploads/a_medium.jpg')).toBe('/uploads/a_medium.jpg')
  })
  it('非 /uploads 资源不动（外链图片/空值）', () => {
    expect(thumbUrl('https://cdn.x/a.jpg')).toBe('https://cdn.x/a.jpg')
    expect(thumbUrl('')).toBe('')
    expect(mediumUrl(null)).toBe('')
  })
  it('派生图带访问令牌（受保护资源）', () => {
    expect(mediaUrl(thumbUrl('/uploads/leaves/a.jpg'))).toContain('token=t')
  })
  it('缩略图加载失败时回退到原图', () => {
    const img = document.createElement('img')
    img.src = mediaUrl(thumbUrl('/uploads/leaves/a.jpg'))
    onThumbError({ target: img } as unknown as Event, '/uploads/leaves/a.jpg')
    expect(img.getAttribute('src')).toContain('/uploads/leaves/a.jpg')
    expect(img.getAttribute('src')).not.toContain('_thumb')
  })

  it('neighborIndexes：返回左右相邻下标并循环，单张时为空', () => {
    expect(neighborIndexes(0, 3)).toEqual([2, 1])
    expect(neighborIndexes(1, 3)).toEqual([0, 2])
    expect(neighborIndexes(2, 3)).toEqual([1, 0])
    expect(neighborIndexes(0, 1)).toEqual([])
    expect(neighborIndexes(0, 0)).toEqual([])
    // 只有两张时左右是同一张，去重
    expect(neighborIndexes(0, 2)).toEqual([1])
  })

  it('preloadImage：设置 src 触发预加载，空值/无 Image 环境安全跳过', () => {
    const seen: string[] = []
    const RealImage = globalThis.Image
    class Spy { decoding = ''; set src(v: string) { seen.push(v) } }
    ;(globalThis as any).Image = Spy
    try {
      preloadImage('/uploads/a_medium.jpg')
      expect(seen).toEqual(['/uploads/a_medium.jpg'])
      preloadImage('')
      preloadImage(null)
      expect(seen).toHaveLength(1)
    } finally {
      ;(globalThis as any).Image = RealImage
    }
    ;(globalThis as any).Image = undefined
    try {
      expect(() => preloadImage('/uploads/x.jpg')).not.toThrow()
    } finally {
      ;(globalThis as any).Image = RealImage
    }
  })

  it('downloadMedia：用带令牌的原图地址并保留文件名', () => {
    let href = ''
    let download = ''
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      href = this.getAttribute('href') || ''
      download = this.getAttribute('download') || ''
    })
    expect(downloadMedia('/uploads/albums/a.jpg')).toBe(true)
    expect(href).toContain('/uploads/albums/a.jpg')
    expect(href).toContain('token=t')
    expect(download).toBe('a.jpg')
    expect(downloadMedia('')).toBe(false)
    spy.mockRestore()
  })

  it('回退只发生一次：即使 src 已被浏览器规范化为绝对地址也不会反复重试', () => {
    const img = document.createElement('img')
    // 模拟浏览器把相对地址规范化成绝对地址后的状态（真实场景就是这样，且与相对 fallback 永不相等）
    img.setAttribute('src', 'http://localhost/uploads/leaves/a_thumb.jpg?token=t')
    onThumbError({ target: img } as unknown as Event, '/uploads/leaves/a.jpg')
    const afterFirst = img.getAttribute('src')
    expect(afterFirst).toBe('/uploads/leaves/a.jpg?token=t')
    // 原图也 404 时会再触发一次 error：必须被标记位挡住，不能改写 src
    onThumbError({ target: img } as unknown as Event, '/uploads/leaves/a.jpg')
    expect(img.getAttribute('src')).toBe(afterFirst)
    expect(img.dataset.thumbFallback).toBe('1')
  })
})
