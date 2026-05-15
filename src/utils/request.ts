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
function _removeStorage(key: string) {
  try { localStorage.removeItem(key) } catch {}
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
  _removeStorage('user_profile')
  if (_redirectingToLogin) return
  _redirectingToLogin = true
  if (_routeGuard) {
    _routeGuard()
  } else {
    // Re-direct via router — but avoid import cycle; use the global uni shim
    try { (window as any).uni?.reLaunch?.({ url: '/pages/login/password-login' }) } catch {}
  }
  setTimeout(() => { _redirectingToLogin = false }, 1500)
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
  }

  if (needAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(requestUrl, {
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
    if (statusCode === 403) {
      return Promise.reject(new ApiError(responseData?.error || '权限不足', 403, true))
    }
    if (statusCode >= 400) {
      const msg = responseData?.error || `请求失败 (${statusCode})`
      if (!silent) try { (window as any).uni?.showToast?.({ title: msg, icon: 'none' }) } catch {}
      return Promise.reject(new ApiError(msg, statusCode, silent))
    }
    if (responseData && responseData.success === false) {
      const msg = responseData.error || '操作失败'
      if (!silent) try { (window as any).uni?.showToast?.({ title: msg, icon: 'none' }) } catch {}
      return Promise.reject(new ApiError(msg, statusCode, silent))
    }

    return responseData as T
  } catch (err: any) {
    const msg = err?.message || '网络请求失败'
    if (!silent) try { (window as any).uni?.showToast?.({ title: msg, icon: 'none' }) } catch {}
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

export default { get, post, put, del, getToken, setToken, clearToken, hasBackendToken }
