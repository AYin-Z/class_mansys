import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isWriteCall } = require('../../services/agent/toolCatalog');

/**
 * 回归：AI 助手的"写操作必须二次确认"曾可被绕过——
 * 模块工具（action 形式）没有被判定为写操作，模型改用模块工具即可直接写库。
 */
describe('助手写操作判定（isWriteCall）', () => {
  it('模块工具按解析后的 HTTP 方法判定：非 GET 必须确认', () => {
    const moduleTool = { kind: 'module', name: 'points' };
    expect(isWriteCall(moduleTool, { action: 'POST /api/points' })).toBe(true);
    expect(isWriteCall(moduleTool, { action: 'PUT /api/leave/approve' })).toBe(true);
    expect(isWriteCall(moduleTool, { action: 'DELETE /api/admin/members/3' })).toBe(true);
    expect(isWriteCall(moduleTool, { action: 'GET /api/points/mine' })).toBe(false);
  });

  it('模块工具缺 action / 非法 action 一律按写处理（保守拒绝）', () => {
    const moduleTool = { kind: 'module', name: 'points' };
    expect(isWriteCall(moduleTool, {})).toBe(false); // 无 action 无法构造请求，execute 会报错
    expect(isWriteCall(moduleTool, { action: 'POST' })).toBe(false); // 方法后无路径，resolveRequest 会抛错
    expect(isWriteCall(moduleTool, { action: 'post /api/points' })).toBe(true); // 小写方法也要拦
  });

  it('curated 工具按 write 标记判定', () => {
    expect(isWriteCall({ kind: 'curated', write: true }, {})).toBe(true);
    expect(isWriteCall({ kind: 'curated', write: false }, {})).toBe(false);
  });

  it('本地工具（使用引导）不需要确认；空工具返回 false', () => {
    expect(isWriteCall({ kind: 'local' }, {})).toBe(false);
    expect(isWriteCall(null, {})).toBe(false);
  });
});
