/**
 * Multer 文件上传配置
 */
const multer = require('multer');
const path = require('path');

// 资源文件存储（公告附件）
const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'resources'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

// 相册图片存储
const albumStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'albums'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

// 导出 multer 实例
exports.uploadResource = multer({
  storage: resourceStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

exports.uploadPhoto = multer({
  storage: albumStorage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});
