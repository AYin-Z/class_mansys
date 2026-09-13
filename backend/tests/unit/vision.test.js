import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'class_manage_sys_test';
process.env.JWT_SECRET = 'test_secret_1234567';

const vision = require('../../services/agent/vision');
const llm = require('../../services/agent/llm');
const { env } = require('../../config/env');

describe('视觉：图片内容块', () => {
  it('非图片附件不产生图片块', async () => {
    const parts = await vision.buildImageParts([{ url: '/uploads/x/a.pdf', name: 'a.pdf', mime: 'application/pdf' }]);
    expect(parts).toEqual([]);
  });

  it('不存在的文件不会让整条消息失败', async () => {
    const parts = await vision.buildImageParts([{ url: '/uploads/agent/does-not-exist.png', mime: 'image/png', isImage: true }]);
    expect(parts).toEqual([]);
  });

  it('最多只发 MAX_IMAGES 张（图片 token 很贵，且要过视觉编码器）', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ url: '/uploads/agent/nope' + i + '.png', mime: 'image/png', isImage: true }));
    const parts = await vision.buildImageParts(many);
    expect(parts.length).toBeLessThanOrEqual(vision.MAX_IMAGES);
  });

  it('剥掉图片块只留文本（回落纯文本上游时用）', () => {
    const content = [{ type: 'text', text: '你好' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }];
    expect(vision.stripImageParts(content)).toBe('你好');
    expect(vision.stripImageParts('纯文本')).toBe('纯文本');
  });
});

describe('视觉：按上游能力降级', () => {
  const saved = {};
  const setEnv = (patch) => {
    for (const [k, v] of Object.entries(patch)) { if (!(k in saved)) saved[k] = env[k]; env[k] = v; }
  };
  it('本地默认支持视觉、远端默认不支持', () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8090/v1', LLM_API_KEY: 'k', LLM_PREFER: 'local' });
    const targets = llm.resolveTargets();
    expect(targets.find((t) => t.name === 'local').vision).toBe(true);
    expect(targets.find((t) => t.name === 'remote').vision).toBe(false);
  });
  it('可以显式关掉本地视觉（排障用）', () => {
    setEnv({ AGENT_LLM_MODE: 'hybrid', LLM_LOCAL_BASE_URL: 'http://127.0.0.1:8090/v1', LLM_LOCAL_VISION: 'false', LLM_API_KEY: 'k' });
    expect(llm.resolveTargets().find((t) => t.name === 'local').vision).toBe(false);
    env.LLM_LOCAL_VISION = 'true';
  });
});
