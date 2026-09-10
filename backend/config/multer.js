/**
 * Multer 文件上传配置
 */
const multer = require('multer');
const path = require('path');

const ALLOWED_RESOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip']);
const ALLOWED_RESOURCE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed'
]);
const ALLOWED_PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function fileFilter(allowedExts, allowedMimes) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExts.has(ext) || !allowedMimes.has(file.mimetype)) {
      return cb(new Error('不支持的文件类型'));
    }
    cb(null, true);
  };
}

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
  fileFilter: fileFilter(ALLOWED_RESOURCE_EXTS, ALLOWED_RESOURCE_MIMES),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 对话附件存储（办事助手：图片/文件）
const agentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'agent'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

exports.uploadAgentFile = multer({
  storage: agentStorage,
  fileFilter: fileFilter(ALLOWED_PHOTO_EXTS, ALLOWED_PHOTO_MIMES),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// 请假证明材料存储
const leaveStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'leaves'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

exports.uploadLeaveProof = multer({
  storage: leaveStorage,
  fileFilter: fileFilter(ALLOWED_PHOTO_EXTS, ALLOWED_PHOTO_MIMES),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

exports.uploadPhoto = multer({
  storage: albumStorage,
  fileFilter: fileFilter(ALLOWED_PHOTO_EXTS, ALLOWED_PHOTO_MIMES),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});
