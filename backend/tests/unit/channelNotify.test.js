import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const notify = require('../../services/channel/notify');
const db = require('../../config/database');

describe('微信推送：纪律由数据层保证', () => {
  it('必填参数缺失直接拒绝（不发起任何发送）', async () => {
    expect((await notify.pushToUser(0, { type: 'x', text: 'y' })).reason).toBe('bad-args');
    expect((await notify.pushToUser(1, { type: '', text: 'y' })).reason).toBe('bad-args');
    expect((await notify.pushToUser(1, { type: 'x', text: '' })).reason).toBe('bad-args');
  });

  it('没绑定微信的用户不推（不做无用的发送尝试）', async () => {
    const r = await notify.pushToUser(999999, { type: notify.TYPES.LEAVE_RESULT, text: '测试' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-bound');
  });

  it('推送日志表有 (user_id, dedupe_key) 唯一键——这是"同一件事只说一次"的保证', async () => {
    const [rows] = await db.query("SHOW INDEX FROM channel_push_log WHERE Key_name = 'uk_push_dedupe'");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].Non_unique).toBe(0);
  });

  it('重复的 dedupe_key 会被唯一键挡住（幂等）', async () => {
    const uid = 999998;
    const key = 'test-dedupe-' + Date.now();
    await db.query("INSERT INTO channel_push_log (user_id, channel, type, dedupe_key, status) VALUES (?, 'weixin', ?, ?, 'pending')", [uid, notify.TYPES.HOMEWORK_DUE, key]);
    let dup = false;
    try {
      await db.query("INSERT INTO channel_push_log (user_id, channel, type, dedupe_key, status) VALUES (?, 'weixin', ?, ?, 'pending')", [uid, notify.TYPES.HOMEWORK_DUE, key]);
    } catch (e) {
      dup = e.code === 'ER_DUP_ENTRY';
    }
    expect(dup).toBe(true);
    await db.query('DELETE FROM channel_push_log WHERE user_id = ?', [uid]);
  });

  it('推送类型集合稳定（用户可按这些名字关闭）', () => {
    expect(Object.values(notify.TYPES).sort()).toEqual(['announcement', 'fee_due', 'homework_due', 'leave_pending', 'leave_result']);
  });
});
