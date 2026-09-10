import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({ getToken: () => 'tok-123' }))

import { renderMarkdown, plainText } from '@/utils/markdown'

describe('renderMarkdown（助手回复渲染）', () => {
  beforeEach(() => vi.clearAllMocks())

  it('渲染标题/列表/加粗', () => {
    const html = renderMarkdown('## 今日待办\n- **张三** 请假\n- 李四 报销')
    expect(html).toContain('<h2')
    expect(html).toContain('<li>')
    expect(html).toContain('<strong>张三</strong>')
  })

  it('给 /uploads 图片补访问令牌并渲染成 img', () => {
    const html = renderMarkdown('![证明](/uploads/leaves/a.jpg)')
    expect(html).toContain('<img')
    expect(html).toContain('/uploads/leaves/a.jpg?token=tok-123')
  })

  it('裸露的图片 URL 自动升级为图片', () => {
    const html = renderMarkdown('这是照片 /uploads/albums/p1.png 请查收')
    expect(html).toContain('<img')
    expect(html).toContain('token=tok-123')
  })

  it('裸露的普通链接变成可点击链接（新窗口）', () => {
    const html = renderMarkdown('见 https://example.com/a')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('href="https://example.com/a"')
  })

  it('清洗脚本与事件属性（XSS）', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('空内容返回空串，plainText 取纯文本', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
    expect(plainText('**加粗** ![图](/uploads/a.png) 尾巴')).toContain('尾巴')
    expect(plainText('![图](/uploads/a.png)')).toContain('[图片]')
  })

  it('中文标点不会被吞进链接', () => {
    const html = renderMarkdown('地址是 /uploads/agent/x.png，请查收')
    expect(html).toContain('/uploads/agent/x.png?token=tok-123')
  })
})
