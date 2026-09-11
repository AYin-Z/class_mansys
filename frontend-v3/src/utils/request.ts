/**
 * HTTP 请求封装 - 基于 fetch
 * 连接 CloudRun 后端 API
 *
 * 设计点：
 *  - 超时：默认 15s，用 AbortController 真正中断（2026-09 修复：此前没有 signal，
 *    断网/弱网时 Promise 永不 settle，页面永远卡在「加载中…」）
 *  - 401：仅当该请求需要鉴权（needAuth）时才判定为登录失效 → 清 token + 通知 store 重置 + 跳登录
 *    （此前登录接口本身 401 也会触发全局登出，把已登录会话清掉）
 *  - 403：抛 ApiError（业务侧可静默吞掉）
 *  - 网络/超时/5xx：默认 toast 提示，可通过 silent 关闭；错误对象带 notified 标记，
 *    页面 catch 里可据此避免用一句「操作失败」覆盖掉后端给的具体原因
 *
 * BASE_URL 完全由环境变量驱动：
 *   .env.development  → dev 启动
 *   .env.production   → 生产构建
 *   .env.local        → 个人本地覆盖（git 忽略）
 */

function resolveBaseUrl(): string {
  const url = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (!url) {
    const msg = '[request] 未配置 VITE_API_BASE_URL，请检查 .env.* 文件或打包参数'
    console.error(msg)
    console.warn(msg)
    return ''
  }
  return url.replace(/\/+$/, '')
}

const BASE_URL = resolveBaseUrl()

if (BASE_URL && import.meta.env.DEV) {
  console.info('[request] API BASE_URL =', BASE_URL)
}

const TOKEN_KEY = 'backend_token'

/** 默认超时（毫秒）——移动端弱网下 15s 已足够长，再久用户只会以为死机 */
export const DEFAULT_TIMEOUT = 15000

let _redirectingToLogin = false
let _routeGuard: (() => void) | null = null
let _authFailureHandler: (() => void) | null = null

export function setRouteGuard(fn: () => void) {
  _routeGuard = fn
}

/** 注册登录失效时的 store 重置回调（避免 request ↔ store 循环导入） */
export function setAuthFailureHandler(fn: (() => void) | null) {
  _authFailureHandler = fn
}

function _getStorage(key: string): string {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
function _setStorage(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch {}
}
/**
 * 统一错误提示
 *
 * 历史问题：这里原来调 `(window as any).uni?.showToast?.()`，但全仓从未定义 window.uni，
 * 导致所有 4xx/5xx/网络错误的提示都是死代码（失败=静默）。
 * 现在由 utils/ui.ts 注册一个回调，避免 request ↔ ui 循环导入。
 */
let _toastHandler: ((msg: string) => void) | null = null
export function setRequestToastHandler(fn: ((msg: string) => void) | null) {
  _toastHandler = fn
}
function _notifyError(msg: string) {
  try {
    if (_toastHandler) _toastHandler(msg)
    else if (typeof window !== 'undefined' && (window as any).__dshShowToast) (window as any).__dshShowToast(msg)
  } catch {}
}

function _removeStorage(key: string) {
  try { localStorage.removeItem(key) } catch {}
}

export function apiUrl(path: string): string {
  return (BASE_URL || '') + path
}

export function getToken(): string {
  return _getStorage(TOKEN_KEY)
}

export function setToken(token: string) {
  _setStorage(TOKEN_KEY, token)
}

export function clearToken() {
  _removeStorage(TOKEN_KEY)
}

export function hasBackendToken(): boolean {
  return !!getToken()
}

export function appendQueryParams(url: string, data: any): string {
  if (!data || typeof data !== 'object') return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== undefined && item !== null && item !== '') {
          params.append(key, String(item))
        }
      })
    } else {
      params.append(key, String(value))
    }
  }

  const query = params.toString()
  if (!query) return url
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

export class ApiError extends Error {
  status: number
  silent: boolean
  /** 是否已由请求层统一弹过提示（页面 catch 里据此避免重复/覆盖提示） */
  notified: boolean
  /** 机器可读的错误码：TIMEOUT / NETWORK / AUTH_EXPIRED / HTTP_xxx / BUSINESS */
  code: string
  constructor(message: string, status = 0, silent = false, code = '', notified = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.silent = silent
    this.code = code || (status ? `HTTP_${status}` : 'NETWORK')
    this.notified = notified
  }
}

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  needAuth?: boolean
  silent?: boolean
  timeout?: number
  signal?: AbortSignal
}

function handleAuthFailure(notify = true) {
  clearToken()
  // 登录态相关的本地缓存必须一起清，否则换用户后会沿用上一个用户的
  // profile / 权限快照，出现"学员看到干部入口"这类错乱
  _removeStorage('user_profile')
  _removeStorage('user_permissions')
  _removeStorage('userInfo')
  _removeStorage('isRegistered')
  // 同步清内存态：否则 isAuthenticated / hasPermission 仍按旧快照渲染，
  // 用户被踢回登录页的同时管理入口还挂着，点一下又是一次 401。
  try { _authFailureHandler?.() } catch {}
  if (notify) _notifyError('登录已过期，请重新登录')
  if (_redirectingToLogin) return
  _redirectingToLogin = true
  if (_routeGuard) {
    _routeGuard()
  } else {
    // 用 location 硬跳转：确保 Pinia store 一起重建（router.replace 不会刷新内存状态）
    try {
      window.location.hash = '#/pages/login/password-login'
      window.location.reload()
    } catch {}
  }
  setTimeout(() => { _redirectingToLogin = false }, 3000)
}

/** 把浏览器抛出的底层错误翻译成用户看得懂的话 */
function humanizeNetworkError(err: any): string {
  const name = err?.name || ''
  if (name === 'AbortError') return '请求已取消'
  const raw = String(err?.message || '')
  if (name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return '网络连接失败，请检查网络后重试'
  }
  if (raw) return raw
  return '网络请求失败，请稍后重试'
}

async function request<T = any>(options: RequestOptions): Promise<T> {
  const {
    url, method = 'GET', data, header = {},
    needAuth = true, silent = false,
    timeout = DEFAULT_TIMEOUT, signal: externalSignal,
  } = options

  // BASE_URL 为空则用同域相对路径（dev 模式 Vite proxy 场景）
  const effectiveBaseUrl = BASE_URL || ''
  const requestUrl = effectiveBaseUrl
    ? `${effectiveBaseUrl}${url}`
    : url.startsWith('http')
      ? url
      : url  // 同域请求
  const finalUrl = method === 'GET' ? appendQueryParams(requestUrl, data) : requestUrl

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
  }

  if (needAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  // 超时 + 外部取消（组件卸载/切换筛选时中止在途请求）
  const controller = new AbortController()
  let timedOut = false
  const timer = timeout > 0
    ? setTimeout(() => { timedOut = true; controller.abort() }, timeout)
    : null
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetch(finalUrl, {
      method,
      headers,
      body: method !== 'GET' && data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    })

    const statusCode = response.status
    let responseData: any = null
    try {
      responseData = await response.json()
    } catch {
      const text = await response.text().catch(() => '')
      responseData = { data: text, success: true }
    }

    const isAuthExpired = statusCode === 401
      || (statusCode === 403 && responseData?.error === '无效的认证令牌')

    if (isAuthExpired) {
      const msg = responseData?.error || '登录已过期，请重新登录'
      // 登录接口（needAuth=false）返回 401 属于「账号或密码错误」，不是会话过期：
      // 不能清 token、不能跳登录页，否则超管在 /admin/login 输错一次密码就被弹走
      if (needAuth) {
        handleAuthFailure(!silent)
        return Promise.reject(new ApiError(msg, statusCode, silent, 'AUTH_EXPIRED', !silent))
      }
      return Promise.reject(new ApiError(msg, statusCode, silent, 'HTTP_401', false))
    }
    if (statusCode === 403) {
      const msg = responseData?.error || '权限不足'
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, 403, silent, 'HTTP_403', !silent))
    }
    if (statusCode >= 400) {
      const msg = statusCode >= 500
        ? (responseData?.error || '服务暂时不可用，请稍后重试')
        : (responseData?.error || `请求失败 (${statusCode})`)
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, statusCode, silent, `HTTP_${statusCode}`, !silent))
    }
    if (responseData && responseData.success === false) {
      const msg = responseData.error || '操作失败，请稍后重试'
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, statusCode, silent, 'BUSINESS', !silent))
    }

    return responseData as T
  } catch (err: any) {
    if (err instanceof ApiError) {
      return Promise.reject(err)
    }
    if (timedOut) {
      const msg = '请求超时，请检查网络后重试'
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, 0, silent, 'TIMEOUT', !silent))
    }
    if (err?.name === 'AbortError') {
      return Promise.reject(new ApiError('请求已取消', 0, true, 'ABORTED', false))
    }
    const msg = humanizeNetworkError(err)
    if (!silent) _notifyError(msg)
    return Promise.reject(new ApiError(msg, 0, silent, 'NETWORK', !silent))
  } finally {
    if (timer) clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }
}

export interface RequestOpts {
  needAuth?: boolean
  silent?: boolean
  timeout?: number
  signal?: AbortSignal
}

function normalizeOpts(opts: RequestOpts | boolean): Required<Pick<RequestOpts, 'needAuth' | 'silent'>> & RequestOpts {
  if (typeof opts === 'boolean') return { needAuth: opts, silent: false }
  return {
    needAuth: opts.needAuth ?? true,
    silent: opts.silent ?? false,
    timeout: opts.timeout,
    signal: opts.signal,
  }
}

export function get<T = any>(url: string, data?: any, opts: RequestOpts | boolean = {}): Promise<T> {
  return request<T>({ url, method: 'GET', data, ...normalizeOpts(opts) })
}

export function post<T = any>(url: string, data?: any, opts: RequestOpts | boolean = {}): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...normalizeOpts(opts) })
}

export function put<T = any>(url: string, data?: any, opts: RequestOpts | boolean = {}): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...normalizeOpts(opts) })
}

export function del<T = any>(url: string, data?: any, opts: RequestOpts | boolean = {}): Promise<T> {
  return request<T>({ url, method: 'DELETE', data, ...normalizeOpts(opts) })
}

/**
 * 文件上传 — multipart/form-data
 *
 * 2026-09 修复：此前不走统一错误链（无 401 处理、无提示、无超时），
 * 上传中 token 过期时照片会静默全失败，用户完全不知道要重新登录。
 */
export async function uploadFile<T = { success: boolean; url: string; filename: string; size: number }>(
  urlPath: string,
  file: File,
  extraFields?: Record<string, string>,
  opts: { timeout?: number; signal?: AbortSignal; silent?: boolean } = {},
): Promise<T> {
  const { timeout = 60000, signal: externalSignal, silent = false } = opts
  const formData = new FormData()
  formData.append('file', file)
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      formData.append(k, v)
    }
  }

  const token = getToken()
  const effectiveBaseUrl = BASE_URL || ''
  const requestUrl = effectiveBaseUrl ? `${effectiveBaseUrl}${urlPath}` : urlPath

  const controller = new AbortController()
  let timedOut = false
  const timer = timeout > 0 ? setTimeout(() => { timedOut = true; controller.abort() }, timeout) : null
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({ success: false, error: '解析响应失败' }))

    if (response.status === 401 || (response.status === 403 && data?.error === '无效的认证令牌')) {
      handleAuthFailure(!silent)
      throw new ApiError('登录已过期，请重新登录', response.status, silent, 'AUTH_EXPIRED', !silent)
    }
    if (!response.ok || !data.success) {
      const msg = data.error || (response.status >= 500 ? '服务暂时不可用，请稍后重试' : `上传失败 (${response.status})`)
      if (!silent) _notifyError(msg)
      throw new ApiError(msg, response.status, silent, `HTTP_${response.status}`, !silent)
    }
    return data as T
  } catch (err: any) {
    if (err instanceof ApiError) throw err
    if (timedOut) {
      const msg = '上传超时，请检查网络后重试'
      if (!silent) _notifyError(msg)
      throw new ApiError(msg, 0, silent, 'TIMEOUT', !silent)
    }
    if (err?.name === 'AbortError') throw new ApiError('上传已取消', 0, true, 'ABORTED', false)
    const msg = humanizeNetworkError(err)
    if (!silent) _notifyError(msg)
    throw new ApiError(msg, 0, silent, 'NETWORK', !silent)
  } finally {
    if (timer) clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }
}

export default { get, post, put, del, getToken, setToken, clearToken, hasBackendToken, uploadFile, downloadFile }

/**
 * 带鉴权的文件下载（导出 CSV / Excel）
 *
 * 历史坑：导出按钮用 window.open(url) 打开，浏览器不会带 Authorization 头，
 * 结果超管后台的 3 个导出按钮必然 401，页面显示一段 JSON 错误。
 */
export async function downloadFile(urlPath: string, filename: string, params?: Record<string, unknown>): Promise<void> {
  const token = getToken()
  let url = (BASE_URL || '') + urlPath
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
    }
    if (qs.toString()) url += (url.includes('?') ? '&' : '?') + qs.toString()
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      signal: controller.signal,
    })
    if (res.status === 401) {
      handleAuthFailure()
      throw new ApiError('登录已过期，请重新登录', 401, true, 'AUTH_EXPIRED', true)
    }
    if (!res.ok) throw new ApiError('导出失败，请稍后重试', res.status, false, `HTTP_${res.status}`, false)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 页面 catch 统一入口：只有请求层没弹过提示时才补一句兜底文案，
 * 避免「操作失败」覆盖掉后端给出的具体原因（如「该时段已有请假」）。
 */
export function toastIfNotNotified(err: any, fallback = '操作失败，请稍后重试') {
  const notified = !!err?.notified
  if (!notified && err?.name !== 'AbortError') {
    _notifyError(err?.message || fallback)
  }
}
