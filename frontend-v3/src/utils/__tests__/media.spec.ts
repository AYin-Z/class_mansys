import { describe, it, expect, beforeEach } from 'vitest'
import { thumbUrl, mediumUrl, mediaUrl, onThumbError } from '@/utils/media'
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
