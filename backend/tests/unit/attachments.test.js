import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize, toMarkdown, withAttachmentText, MAX_ATTACHMENTS } = require('../../services/agent/attachments');

describe('对话附件规范化', () => {
  it('保留 /uploads 与 http(s) 附件，丢弃非法/外站协议', () => {
    const out = normalize([
      { url: '/uploads/agent/a.png', name: '证明.png', mime: 'image/png', size: 123 },
      { url: 'https://cdn.example.com/b.jpg' },
      { url: 'javascript:alert(1)' },
      { url: '/etc/passwd' },
      { url: '' },
      null,
      'x'
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].isImage).toBe(true);
    expect(out[1].url).toBe('https://cdn.example.com/b.jpg');
  });

  it('按扩展名/mime 判定图片，缺名字时回退文件名', () => {
    const out = normalize([{ url: '/uploads/agent/1699999_ab12.pdf', mime: 'application/pdf' }]);
    expect(out[0].isImage).toBe(false);
    expect(out[0].name).toBe('1699999_ab12.pdf');
  });

  it('最多保留 6 个', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ url: '/uploads/agent/' + i + '.png' }));
    expect(normalize(many)).toHaveLength(MAX_ATTACHMENTS);
  });

  it('toMarkdown：图片用 ![]()、文件用 []()', () => {
    const md = toMarkdown([
      { url: '/uploads/agent/a.png', name: '图.png', isImage: true },
      { url: '/uploads/agent/b.pdf', name: '证明.pdf', isImage: false }
    ]);
    expect(md).toBe('![图.png](/uploads/agent/a.png)\n[证明.pdf](/uploads/agent/b.pdf)');
  });

  it('withAttachmentText 拼接在用户消息后，无附件时原样返回', () => {
    expect(withAttachmentText('这是我的证明', [])).toBe('这是我的证明');
    const out = withAttachmentText('这是我的证明', [{ url: '/uploads/agent/a.png', name: 'x', isImage: true }]);
    expect(out.startsWith('这是我的证明')).toBe(true);
    expect(out).toContain('![x](/uploads/agent/a.png)');
  });

  it('非数组输入返回空数组', () => {
    expect(normalize(undefined)).toEqual([]);
    expect(normalize('abc')).toEqual([]);
  });
});
