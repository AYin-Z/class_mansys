/**
 * 统一分页参数解析（P1-3）
 *
 * 设计前提：**向后兼容是硬要求**。线上有旧 APK 在跑，因此：
 *  - 请求没带任何分页参数时 `paged === false`，调用方必须走原来的「全量」路径，
 *    响应结构与字段名保持与分页前完全一致；
 *  - 只有带了分页参数（`page` / `pageSize` / `limit` / `cursor`）才走分页 SQL，
 *    并在原字段之外**追加** `page/pageSize/total/hasMore/nextCursor`，
 *    不改动既有字段名与含义。
 *
 * 两种模式：
 *  - offset 分页 `parsePaging(query)`：`page` + `pageSize`，适合稳定倒序的普通列表；
 *  - 游标分页 `parseCursorPaging(query)`：`limit` + `cursor`，适合会持续追加、
 *    深翻页代价高的照片流（`ORDER BY created_at DESC, id DESC`）。
 */

/** 默认每页条数（offset 模式） */
const DEFAULT_PAGE_SIZE = 20;
/** 默认每页条数（游标模式；照片网格一屏 3–5 列，30 张约 6–10 行） */
const DEFAULT_CURSOR_LIMIT = 30;
/** 每页上限：超出即截断，避免 `?pageSize=100000` 把库和带宽打满 */
const MAX_PAGE_SIZE = 100;

/** 参数是否"存在"（空串按不存在处理，兼容 `?page=` 这类空参） */
function isPresent(v) {
  return v !== undefined && v !== null && v !== '';
}

/** 宽松取整：非数字返回 null（由调用方决定回落到默认值） */
function toInt(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * 解析 offset 分页参数。
 * @param {object} [query] Express 的 req.query
 * @param {{defaultPageSize?:number, maxPageSize?:number}} [opts]
 * @returns {{paged:boolean, page:number, pageSize:number, offset:number, limit:number}}
 *   paged=false 表示"调用方没要求分页"，此时 page/pageSize 只是占位值，不要用于 SQL。
 */
function parsePaging(query, opts) {
  const q = query || {};
  const defaultPageSize = (opts && opts.defaultPageSize) || DEFAULT_PAGE_SIZE;
  const maxPageSize = (opts && opts.maxPageSize) || MAX_PAGE_SIZE;

  const paged = isPresent(q.page) || isPresent(q.pageSize);

  // page 最小 1：0 / 负数 / 非数字一律回落到第 1 页（而不是报错，旧客户端可能瞎传）
  let page = toInt(q.page);
  if (page === null || page < 1) page = 1;

  let pageSize = toInt(q.pageSize);
  if (pageSize === null || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > maxPageSize) pageSize = maxPageSize;

  return { paged, page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

/**
 * 解析游标分页参数（照片流）。
 * @param {object} [query]
 * @param {{defaultLimit?:number, maxPageSize?:number}} [opts]
 * @returns {{paged:boolean, limit:number, cursor:string|null}}
 */
function parseCursorPaging(query, opts) {
  const q = query || {};
  const defaultLimit = (opts && opts.defaultLimit) || DEFAULT_CURSOR_LIMIT;
  const maxPageSize = (opts && opts.maxPageSize) || MAX_PAGE_SIZE;

  const paged = isPresent(q.limit) || isPresent(q.cursor);

  let limit = toInt(q.limit);
  if (limit === null || limit < 1) limit = defaultLimit;
  if (limit > maxPageSize) limit = maxPageSize;

  return { paged, limit, cursor: isPresent(q.cursor) ? String(q.cursor) : null };
}

/**
 * 把 (created_at, id) 编成不透明游标。
 * 用 base64url 而不是明文，是为了让前端把它当"令牌"传回来，别去解析、拼装。
 * dateStrings: true → created_at 是 'YYYY-MM-DD HH:mm:ss' 字符串，往返无损。
 */
function encodeCursor(payload) {
  if (!payload) return null;
  const createdAt = payload.created_at != null ? String(payload.created_at)
    : (payload.createdAt != null ? String(payload.createdAt) : null);
  const id = toInt(payload.id);
  if (!createdAt || id === null || id < 1) return null;
  return Buffer.from(JSON.stringify({ c: createdAt, i: id }), 'utf8').toString('base64url');
}

/**
 * 解码游标；任何非法输入（乱码 / 非 base64 / 字段缺失）都返回 null，
 * 调用方按"首页"处理 —— 宁可多返回一页，也不要 500。
 * @returns {{created_at:string, id:number}|null}
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const createdAt = obj.c != null ? String(obj.c) : '';
    const id = toInt(obj.i);
    if (!createdAt || id === null || id < 1) return null;
    return { created_at: createdAt, id };
  } catch (_) {
    return null;
  }
}

/**
 * offset 分页的响应元信息（作为附加字段返回，不影响老字段）。
 * @returns {{page:number, pageSize:number, total:number, hasMore:boolean}}
 */
function buildPageMeta({ page, pageSize, total }) {
  const totalNum = Number(total) || 0;
  return {
    page,
    pageSize,
    total: totalNum,
    hasMore: page * pageSize < totalNum
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  DEFAULT_CURSOR_LIMIT,
  MAX_PAGE_SIZE,
  parsePaging,
  parseCursorPaging,
  encodeCursor,
  decodeCursor,
  buildPageMeta
};
