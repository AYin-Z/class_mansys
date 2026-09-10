const { BadRequestError } = require('./http');

/**
 * 请求体校验中间件（P1）
 * - schema 为 zod schema；校验失败返回 400 + VALIDATION_ERROR（含字段路径）
 * - 校验通过后用解析结果替换 req.body
 */
function validateBody(schema) {
  return function bodyValidator(req, res, next) {
    const result = schema.safeParse(req.body === undefined || req.body === null ? {} : req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      const message = field ? field + ': ' + issue.message : issue.message;
      return next(new BadRequestError(message, 'VALIDATION_ERROR'));
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validateBody };
