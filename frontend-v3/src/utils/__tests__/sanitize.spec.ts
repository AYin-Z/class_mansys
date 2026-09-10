import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/utils/sanitize'

describe('sanitizeHtml（XSS 白名单清洗）', () => {
  it('移除 script 标签及其内容', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>')
    expect(out).not.toContain('script')
    expect(out).toContain('hi')
  })

  it('移除事件属性（onerror 等）', () => {
    const out = sanitizeHtml('<img src="https://a.com/x.png" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
  })

  it('拦截 javascript: 协议链接', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('保留白名单标签与安全链接', () => {
    const out = sanitizeHtml('<p>hi <b>bold</b> <a href="https://example.com">link</a></p>')
    expect(out).toContain('<b>bold</b>')
    expect(out).toContain('https://example.com')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('非白名单标签被剥离但保留文本', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe>text')
    expect(out).not.toContain('iframe')
    expect(out).toContain('text')
  })

  it('空输入返回空串', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
