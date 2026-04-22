const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'data', 'app-version.json');

/**
 * GET /api/app/latest
 * 查询最新客户端版本信息，供 App 内自动更新使用。
 *
 * Query:
 *   platform = android | ios（默认 android）
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     versionName: "1.0.1",
 *     versionCode: 101,
 *     minVersionCode: 100,        // 低于此版本强制更新
 *     downloadUrl: "https://...",
 *     apkSize: 15728640,           // 字节
 *     releasedAt: "2026-05-01",
 *     forceUpdate: false,
 *     changelog: "..."
 *   }
 * }
 */
router.get('/latest', (req, res) => {
  const platform = (req.query.platform || 'android').toString().toLowerCase();
  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({ success: false, error: '不支持的平台' });
  }

  try {
    const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
    const config = JSON.parse(raw);
    const data = config[platform];

    if (!data || !data.versionName) {
      return res.status(404).json({ success: false, error: '该平台暂无发布版本' });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('[app/latest] 读取版本配置失败:', err);
    res.status(500).json({ success: false, error: '版本配置读取失败' });
  }
});

module.exports = router;
