/**
 * HTTP 请求封装 - 基于 fetch
 * 连接 CloudRun 后端 API
 *
 * 设计点：
 *  - 401: 清 token + 跳注册页（仅一次，避免循环）
 *  - 403: 抛 PermissionError（业务侧可静默吞掉）
 *  - 网络/5xx: 默认 toast 提示，可通过 silent 关闭
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

let _redirectingToLogin = false
let _routeGuard: (() => void) | null = null

export function setRouteGuard(fn: () => void) {
  _routeGuard = fn
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
  constructor(message: string, status = 0, silent = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.silent = silent
  }
}

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  needAuth?: boolean
  silent?: boolean
}

function handleAuthFailure() {
  clearToken()
  // 登录态相关的本地缓存必须一起清，否则换用户后会沿用上一个用户的
  // profile / 权限快照，出现"学员看到干部入口"这类错乱
  _removeStorage('user_profile')
  _removeStorage('user_permissions')
  _removeStorage('userInfo')
  _removeStorage('isRegistered')
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

async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, needAuth = true, silent = false } = options

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

  try {
    const response = await fetch(finalUrl, {
      method,
      headers,
      body: method !== 'GET' && data ? JSON.stringify(data) : undefined,
    })

    const statusCode = response.status
    let responseData: any = null
    try {
      responseData = await response.json()
    } catch {
      const text = await response.text().catch(() => '')
      responseData = { data: text, success: true }
    }

    if (statusCode === 401) {
      handleAuthFailure()
      return Promise.reject(new ApiError(responseData?.error || '登录已过期，请重新登录', 401, true))
    }
    if (statusCode === 403 && responseData?.error === '无效的认证令牌') {
      handleAuthFailure()
      return Promise.reject(new ApiError('登录已过期，请重新登录', 403, true))
    }
    if (statusCode === 403) {
      return Promise.reject(new ApiError(responseData?.error || '权限不足', 403, true))
    }
    if (statusCode >= 400) {
      const msg = responseData?.error || `请求失败 (${statusCode})`
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, statusCode, silent))
    }
    if (responseData && responseData.success === false) {
      const msg = responseData.error || '操作失败'
      if (!silent) _notifyError(msg)
      return Promise.reject(new ApiError(msg, statusCode, silent))
    }

    return responseData as T
  } catch (err: any) {
    if (err instanceof ApiError) {
      return Promise.reject(err)
    }
    const msg = err?.message || '网络请求失败'
    if (!silent) _notifyError(msg)
    return Promise.reject(new ApiError(msg, 0, silent))
  }
}

export function get<T = any>(url: string, data?: any, opts: { needAuth?: boolean; silent?: boolean } | boolean = {}): Promise<T> {
  const needAuth = typeof opts === 'boolean' ? opts : (opts.needAuth ?? true)
  const silent = typeof opts === 'boolean' ? false : (opts.silent ?? false)
  return request<T>({ url, method: 'GET', data, needAuth, silent })
}

export function post<T = any>(url: string, data?: any, opts: { needAuth?: boolean; silent?: boolean } | boolean = {}): Promise<T> {
  const needAuth = typeof opts === 'boolean' ? opts : (opts.needAuth ?? true)
  const silent = typeof opts === 'boolean' ? false : (opts.silent ?? false)
  return request<T>({ url, method: 'POST', data, needAuth, silent })
}

export function put<T = any>(url: string, data?: any, opts: { needAuth?: boolean; silent?: boolean } | boolean = {}): Promise<T> {
  const needAuth = typeof opts === 'boolean' ? opts : (opts.needAuth ?? true)
  const silent = typeof opts === 'boolean' ? false : (opts.silent ?? false)
  return request<T>({ url, method: 'PUT', data, needAuth, silent })
}

export function del<T = any>(url: string, data?: any, opts: { needAuth?: boolean; silent?: boolean } | boolean = {}): Promise<T> {
  const needAuth = typeof opts === 'boolean' ? opts : (opts.needAuth ?? true)
  const silent = typeof opts === 'boolean' ? false : (opts.silent ?? false)
  return request<T>({ url, method: 'DELETE', data, needAuth, silent })
}

/**
 * 文件上传 — multipart/form-data
 */
export async function uploadFile<T = { success: boolean; url: string; filename: string; size: number }>(
  urlPath: string,
  file: File,
  extraFields?: Record<string, string>,
): Promise<T> {
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

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data = await response.json().catch(() => ({ success: false, error: '解析响应失败' }))
  if (!response.ok || !data.success) {
    throw new ApiError(data.error || `上传失败 (${response.status})`, response.status)
  }
  return data as T
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
  const res = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  if (res.status === 401) {
    handleAuthFailure()
    throw new ApiError('登录已过期，请重新登录', 401, true)
  }
  if (!res.ok) throw new ApiError('导出失败 (' + res.status + ')', res.status)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
}
