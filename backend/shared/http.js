/**
 * 统一 HTTP 响应 / 错误处理（P0）
 * 目标：新代码用 ok/fail + 领域错误；同时保持既有响应结构兼容（success/error/data）。
 */
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
class BadRequestError extends HttpError { constructor(message, code) { super(400, message, code || 'BAD_REQUEST'); } }
class UnauthorizedError extends HttpError { constructor(message, code) { super(401, message, code || 'UNAUTHORIZED'); } }
class ForbiddenError extends HttpError { constructor(message, code) { super(403, message, code || 'FORBIDDEN'); } }
class NotFoundError extends HttpError { constructor(message, code) { super(404, message, code || 'NOT_FOUND'); } }

function ok(res, data, extra) {
  const body = Object.assign({ success: true }, extra || {});
  if (data !== undefined) body.data = data;
  return res.json(body);
}

function fail(res, status, error, code) {
  const body = { success: false, error };
  if (code) body.code = code;
  return res.status(status).json(body);
}

/** 包装 async 控制器，异常统一交给 errorHandler */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  return fail(res, 404, '接口不存在', 'NOT_FOUND');
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const log = req.log || console;
  const isKnown = err instanceof HttpError;
  const status = isKnown ? err.status : (err && err.message === '不支持的文件类型' ? 400 : 500);
  const code = isKnown ? err.code : (status === 400 ? 'UNSUPPORTED_FILE_TYPE' : 'INTERNAL_ERROR');
  const message = status >= 500 ? '服务器内部错误' : err.message;
  if (status >= 500) log.error({ err }, 'unhandled error');
  else log.warn({ err: err.message, path: req.originalUrl }, 'request error');
  if (res.headersSent) return;
  return fail(res, status, message, code);
}

module.exports = {
  HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
  ok, fail, asyncHandler, notFoundHandler, errorHandler
};
