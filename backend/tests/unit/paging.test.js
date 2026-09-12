import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const {
  parsePaging,
  parseCursorPaging,
  encodeCursor,
  decodeCursor,
  buildPageMeta,
  DEFAULT_PAGE_SIZE,
  DEFAULT_CURSOR_LIMIT,
  MAX_PAGE_SIZE
} = require('../../shared/paging');

describe('parsePaging —— offset 分页参数', () => {
  it('缺省：paged=false，且给出可直接用的默认 page/pageSize', () => {
    for (const q of [undefined, null, {}, { foo: 'bar' }, { page: '', pageSize: '' }]) {
      const r = parsePaging(q);
      expect(r.paged).toBe(false);
      expect(r.page).toBe(1);
      expect(r.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(r.limit).toBe(DEFAULT_PAGE_SIZE);
      expect(r.offset).toBe(0);
    }
  });

  it('只带 page 或只带 pageSize 也算"要分页"', () => {
    expect(parsePaging({ page: '3' }).paged).toBe(true);
    expect(parsePaging({ pageSize: '10' }).paged).toBe(true);
  });

  it('正常解析 page/pageSize，并算出 offset', () => {
    expect(parsePaging({ page: '3', pageSize: '20' })).toEqual({
      paged: true, page: 3, pageSize: 20, offset: 40, limit: 20
    });
    expect(parsePaging({ page: 2, pageSize: 30 }).offset).toBe(30);
  });

  it('越界保护：page 最小 1，非法/负数/小数一律回落到第 1 页', () => {
    for (const page of ['0', '-5', 'abc', '1.9', '', null, undefined, 'NaN', ' ']) {
      expect(parsePaging({ page, pageSize: '10' }).page).toBe(1);
    }
    expect(parsePaging({ page: '0', pageSize: '10' }).offset).toBe(0);
  });

  it('越界保护：pageSize 非法回落到默认值', () => {
    for (const pageSize of ['0', '-1', 'abc', '2.5', null]) {
      expect(parsePaging({ page: '2', pageSize }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    }
  });

  it('上限截断：pageSize 超过 100 一律按 100', () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(parsePaging({ pageSize: '999' }).pageSize).toBe(100);
    expect(parsePaging({ pageSize: '100000' }).pageSize).toBe(100);
    expect(parsePaging({ pageSize: '100' }).pageSize).toBe(100);
    expect(parsePaging({ pageSize: '101' }).pageSize).toBe(100);
    // 截断后 offset 也按截断后的 pageSize 计算，否则会整段漏数据
    expect(parsePaging({ page: '2', pageSize: '999' }).offset).toBe(100);
  });

  it('支持自定义默认值与上限', () => {
    const r = parsePaging({ page: '2' }, { defaultPageSize: 10, maxPageSize: 10 });
    expect(r.pageSize).toBe(10);
    expect(r.offset).toBe(10);
    expect(parsePaging({ pageSize: '50' }, { maxPageSize: 10 }).pageSize).toBe(10);
  });

  it('纯数字字符串与前后空格都能解析（旧客户端可能手拼 URL）', () => {
    expect(parsePaging({ page: ' 2 ', pageSize: ' 15 ' })).toMatchObject({ page: 2, pageSize: 15 });
  });
});

describe('parseCursorPaging —— 游标分页参数（照片流）', () => {
  it('缺省：paged=false，limit 为默认值，cursor 为 null', () => {
    for (const q of [undefined, {}, { foo: 1 }, { limit: '', cursor: '' }]) {
      const r = parseCursorPaging(q);
      expect(r.paged).toBe(false);
      expect(r.limit).toBe(DEFAULT_CURSOR_LIMIT);
      expect(r.cursor).toBeNull();
    }
  });

  it('只带 limit 或只带 cursor 都算"要分页"', () => {
    expect(parseCursorPaging({ limit: '10' }).paged).toBe(true);
    expect(parseCursorPaging({ cursor: 'abc' }).paged).toBe(true);
  });

  it('limit 越界与上限截断', () => {
    expect(parseCursorPaging({ limit: '0' }).limit).toBe(DEFAULT_CURSOR_LIMIT);
    expect(parseCursorPaging({ limit: '-3' }).limit).toBe(DEFAULT_CURSOR_LIMIT);
    expect(parseCursorPaging({ limit: 'abc' }).limit).toBe(DEFAULT_CURSOR_LIMIT);
    expect(parseCursorPaging({ limit: '9999' }).limit).toBe(MAX_PAGE_SIZE);
    expect(parseCursorPaging({ limit: '12' }).limit).toBe(12);
  });

  it('cursor 原样带出（不在这里解码，解码交给 decodeCursor）', () => {
    expect(parseCursorPaging({ cursor: 'xx_yy' }).cursor).toBe('xx_yy');
  });
});

describe('游标编码 / 解码', () => {
  it('往返一致（dateStrings 下的 created_at 字符串 + id）', () => {
    const cursor = encodeCursor({ created_at: '2026-09-12 10:30:00', id: 4321 });
    expect(typeof cursor).toBe('string');
    expect(cursor).not.toContain('2026-09-12'); // 不透明，前端只当令牌传回来
    expect(decodeCursor(cursor)).toEqual({ created_at: '2026-09-12 10:30:00', id: 4321 });
  });

  it('分页键不变时游标稳定（同样的输入 → 同样的串）', () => {
    const a = encodeCursor({ created_at: '2026-01-01 00:00:01', id: 7 });
    const b = encodeCursor({ created_at: '2026-01-01 00:00:01', id: 7 });
    expect(a).toBe(b);
  });

  it('字段缺失或非法 → 返回 null（调用方按第一页处理，不 500）', () => {
    expect(encodeCursor(null)).toBeNull();
    expect(encodeCursor({})).toBeNull();
    expect(encodeCursor({ created_at: '2026-01-01 00:00:00' })).toBeNull();
    expect(encodeCursor({ id: 5 })).toBeNull();
    expect(encodeCursor({ created_at: '2026-01-01 00:00:00', id: 0 })).toBeNull();
    expect(encodeCursor({ created_at: '2026-01-01 00:00:00', id: -1 })).toBeNull();
  });

  it('非法游标（乱码 / 非 base64 / JSON 结构不对）一律 null', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('not json', 'utf8').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"c":"2026-01-01 00:00:00"}', 'utf8').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[1,2,3]', 'utf8').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('"str"', 'utf8').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('123', 'utf8').toString('base64url'))).toBeNull();
  });

  it('id 可以是数字字符串（从 query 里捡回来的值）', () => {
    const cursor = encodeCursor({ created_at: '2026-02-03 04:05:06', id: '88' });
    expect(decodeCursor(cursor)).toEqual({ created_at: '2026-02-03 04:05:06', id: 88 });
  });
});

describe('buildPageMeta —— offset 分页的响应元信息', () => {
  it('算出 hasMore', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, total: 45 })).toEqual({
      page: 1, pageSize: 20, total: 45, hasMore: true
    });
    expect(buildPageMeta({ page: 3, pageSize: 20, total: 45 })).toEqual({
      page: 3, pageSize: 20, total: 45, hasMore: false
    });
  });

  it('边界：正好整除时最后一页 hasMore=false', () => {
    expect(buildPageMeta({ page: 2, pageSize: 20, total: 40 }).hasMore).toBe(false);
  });

  it('total 缺失/非法按 0 处理', () => {
    expect(buildPageMeta({ page: 1, pageSize: 20, total: undefined })).toEqual({
      page: 1, pageSize: 20, total: 0, hasMore: false
    });
    expect(buildPageMeta({ page: 1, pageSize: 20, total: 'abc' }).total).toBe(0);
  });
});
