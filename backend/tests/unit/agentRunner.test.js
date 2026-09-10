import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { resolveRequest, preview } = require('../../services/agent/toolRunner');
const { BadRequestError } = require('../../shared/http');

const moduleTool = { kind: 'module', name: 'leave', actions: ['GET /api/leave/my', 'POST /api/leave/apply'] };
const curatedGet = { kind: 'curated', name: 'notice_detail', label: '通知详情', method: 'GET', path: '/api/notice/{id}', pathParams: ['id'] };
const curatedPost = { kind: 'curated', name: 'apply_leave', label: '提交请假申请', method: 'POST', path: '/api/leave/apply', write: true, body: ['type', 'start_time', 'end_time'] };

describe('工具调用参数解析', () => {
  it('模块工具：GET 走 query，写操作走 body', () => {
    const g = resolveRequest(moduleTool, { action: 'GET /api/leave/my', query: { limit: 5 } });
    expect(g.method).toBe('GET');
    expect(g.path).toBe('/api/leave/my');
    expect(g.query).toEqual({ limit: 5 });
    expect(g.body).toBeUndefined();

    const p = resolveRequest(moduleTool, { action: 'POST /api/leave/apply', params: { type: '早操' } });
    expect(p.method).toBe('POST');
    expect(p.body).toEqual({ type: '早操' });
  });

  it('模块工具：非法 action 直接拒绝（防路径注入）', () => {
    expect(() => resolveRequest(moduleTool, { action: 'GET /api/admin/members' })).toThrow(BadRequestError);
    expect(() => resolveRequest(moduleTool, { action: '../../etc/passwd' })).toThrow(BadRequestError);
  });

  it('快捷工具：路径参数填充与缺失校验', () => {
    expect(resolveRequest(curatedGet, { id: 12 }).path).toBe('/api/notice/12');
    expect(() => resolveRequest(curatedGet, {})).toThrow(BadRequestError);
  });

  it('快捷工具：只透传白名单字段（防越权字段注入）', () => {
    const r = resolveRequest(curatedPost, { type: '早操', start_time: 'a', end_time: 'b', user_id: 999 });
    expect(r.body).toEqual({ type: '早操', start_time: 'a', end_time: 'b' });
    expect(r.body.user_id).toBeUndefined();
  });

  it('动作预览可读且截断', () => {
    const text = preview(curatedPost, { type: '早操', start_time: 'a', end_time: 'b' });
    expect(text).toContain('提交请假申请');
    expect(text).toContain('早操');
    expect(text.length).toBeLessThanOrEqual(480);
  });
});
