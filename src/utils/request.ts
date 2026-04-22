/**
 * HTTP 请求封装 - 基于 uni.request
 * 连接 CloudRun 后端 API
 *
 * 设计点：
 *  - 401: 清 token + 跳注册页（仅一次，避免循环）
 *  - 403: 抛 PermissionError（业务侧可静默吞掉）
 *  - 网络/5xx: 默认 toast 提示，可通过 silent 关闭
 *
 * BASE_URL 完全由环境变量驱动（便于切换自定义域名 / 多环境）：
 *   .env.development  → dev 启动
 *   .env.production   → 生产构建
 *   .env.local        → 个人本地覆盖（git 忽略）
 *   优先级: .env.{mode}.local > .env.{mode} > .env.local > .env
 *
 * 若 VITE_API_BASE_URL 缺失，这里不再悄悄兜底到某个测试域名，
 * 直接报错，强制运维把配置补上，避免线上误指向测试集群。
 */

function resolveBaseUrl(): string {
  const url = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (!url) {
    // 小程序真机上 console.error 可能不直观，再补一次 console.warn
    const msg = '[request] 未配置 VITE_API_BASE_URL，请检查 .env.* 文件或打包参数'
    console.error(msg)
    console.warn(msg)
    return ''
  }
  return url.replace(/\/+$/, '')   // 去掉尾部斜杠，避免拼出 //api/...
}

const BASE_URL = resolveBaseUrl()

if (BASE_URL && import.meta.env.DEV) {
  console.info('[request] API BASE_URL =', BASE_URL)
}

const TOKEN_KEY = 'backend_token'

let _redirectingToLogin = false

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_KEY)
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
  silent?: boolean   // 关闭网络/服务端错误的 toast
}

function handleAuthFailure() {
  clearToken()
  uni.removeStorageSync('user_profile')
  if (_redirectingToLogin) return
  _redirectingToLogin = true
  uni.reLaunch({
    url: '/pages/auth/register',
    complete: () => { setTimeout(() => { _redirectingToLogin = false }, 1500) }
  })
}

function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, needAuth = true, silent = false } = options

  if (!BASE_URL) {
    const msg = '未配置后端地址 (VITE_API_BASE_URL)'
    if (!silent) uni.showToast({ title: msg, icon: 'none' })
    return Promise.reject(new ApiError(msg, 0, silent))
  }

  if (needAuth) {
    const token = getToken()
    if (token) header['Authorization'] = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      success: (res) => {
        const statusCode = res.statusCode
        const responseData = res.data as any

        if (statusCode === 401) {
          handleAuthFailure()
          reject(new ApiError(responseData?.error || '登录已过期，请重新登录', 401, true))
          return
        }
        if (statusCode === 403) {
          reject(new ApiError(responseData?.error || '权限不足', 403, true))
          return
        }
        if (statusCode >= 400) {
          const msg = responseData?.error || `请求失败 (${statusCode})`
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new ApiError(msg, statusCode, silent))
          return
        }
        if (responseData && responseData.success === false) {
          const msg = responseData.error || '操作失败'
          if (!silent) uni.showToast({ title: msg, icon: 'none' })
          reject(new ApiError(msg, statusCode, silent))
          return
        }

        resolve(responseData as T)
      },
      fail: (err) => {
        const msg = err.errMsg || '网络请求失败'
        if (!silent) uni.showToast({ title: msg, icon: 'none' })
        reject(new ApiError(msg, 0, silent))
      }
    })
  })
}

export function get<T = any>(url: string, data?: any, opts: { needAuth?: boolean; silent?: boolean } = {}): Promise<T> {
  // 支持旧调用 get(url, data, false) —— 第三个参数当作 needAuth
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
