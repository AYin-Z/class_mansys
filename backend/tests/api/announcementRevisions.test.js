import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const require = createRequire(import.meta.url);
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { dbSuite } = require('../lib/dbProbe');

/**
 * 公告修订历史（P3-4）：编辑留痕 + 可回退
 *
 * 背景：公告此前只能 create/delete，改一条只能删了重发（换 ID、已读状态重置）。
 * 现在每次改动（发布/编辑/回退）都写一条不可变快照，回退本身也生成新版本。
 *
 * 该用例需要真实数据库（用测试库），无库环境自动跳过。
 */
const withDb = await dbSuite();
const SUPER_TOKEN = jwt.sign({ id: 1, role: 8 }, process.env.JWT_SECRET, { expiresIn: '1h' });

withDb('公告修订历史（编辑 / 查看 / 回退）', () => {
  let id = 0;

  it('发布即写入 v1 快照', async () => {
    const res = await request(app)
      .post('/api/announcement/create')
      .set('Authorization', `Bearer ${SUPER_TOKEN}`)
      .send({ title: '修订历史用例', content: '<p>v1 内容</p>', is_pinned: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    id = res.body.id;

    const rev = await request(app)
      .get(`/api/announcement/${id}/revisions`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(rev.status).toBe(200);
    expect(rev.body.currentVersion).toBe(1);
    expect(rev.body.revisions).toHaveLength(1);
    expect(rev.body.revisions[0].source).toBe('publish');
    // 列表接口不返回正文，避免一次传回所有历史 HTML
    expect(rev.body.revisions[0].content).toBeUndefined();
  });

  it('编辑生成 v2，且当前值是最新的', async () => {
    const res = await request(app)
      .put(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`)
      .send({ title: '修订历史用例（v2）', content: '<p>v2 内容</p>' });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);

    const detail = await request(app)
      .get(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(detail.body.announcement.title).toBe('修订历史用例（v2）');
    expect(detail.body.announcement.content).toContain('v2 内容');
  });

  it('只改标题时正文保持不变（部分更新）', async () => {
    const res = await request(app)
      .put(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`)
      .send({ title: '只改标题' });
    expect(res.status).toBe(200);

    const detail = await request(app)
      .get(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(detail.body.announcement.title).toBe('只改标题');
    expect(detail.body.announcement.content).toContain('v2 内容');
  });

  it('可以取到任一历史版本的完整内容', async () => {
    const res = await request(app)
      .get(`/api/announcement/${id}/revisions/1`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.revision.title).toBe('修订历史用例');
    expect(res.body.revision.content).toContain('v1 内容');
  });

  it('回退 = 新版本，历史不丢（可再回退）', async () => {
    const res = await request(app)
      .post(`/api/announcement/${id}/revert/1`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.revertedFrom).toBe(1);
    expect(res.body.version).toBeGreaterThan(1);

    const detail = await request(app)
      .get(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(detail.body.announcement.title).toBe('修订历史用例');
    expect(detail.body.announcement.content).toContain('v1 内容');

    const rev = await request(app)
      .get(`/api/announcement/${id}/revisions`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    // 发布 + 两次编辑 + 回退 = 4 个版本，且最新一条 source 是 revert
    expect(rev.body.revisions.length).toBe(4);
    expect(rev.body.revisions[0].source).toBe('revert');
    expect(rev.body.revisions.at(-1).version).toBe(1);
  });

  it('不存在的版本回退返回 404，非法版本号返回 400', async () => {
    const notFound = await request(app)
      .post(`/api/announcement/${id}/revert/999`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(notFound.status).toBe(404);

    const bad = await request(app)
      .post(`/api/announcement/${id}/revert/0`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(bad.status).toBe(400);
  });

  it('未登录不能编辑 / 查看历史 / 回退', async () => {
    const put = await request(app).put(`/api/announcement/${id}`).send({ title: 'x' });
    expect(put.status).toBe(401);
    const rev = await request(app).get(`/api/announcement/${id}/revisions`);
    expect(rev.status).toBe(401);
    const revert = await request(app).post(`/api/announcement/${id}/revert/1`);
    expect(revert.status).toBe(401);
  });

  it('清理：删除公告会连带删除修订历史', async () => {
    const del = await request(app)
      .delete(`/api/announcement/${id}`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(del.status).toBe(200);

    const after = await request(app)
      .get(`/api/announcement/${id}/revisions`)
      .set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(after.status).toBe(404);
  });
});
