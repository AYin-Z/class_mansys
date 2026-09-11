/**
 * 认证相关 API
 */
import { get, post, setToken } from '../utils/request'
import type { RequestOpts } from '../utils/request'

/**
 * 登录/验证码类接口统一选项：
 *  - needAuth 恒为 false（登录接口不该带旧令牌，也不该触发全局登出）
 *  - 默认 silent: true —— 登录失败由页面在表单里就地展示，
 *    不需要请求层再弹一遍 toast（此前会出现 toast + 行内错误双重提示）
 */
function authOpts(opts: RequestOpts = {}): RequestOpts {
  return { needAuth: false, silent: true, ...opts }
}

export interface LoginParams {
  code: string
  userInfo?: {
    nickName?: string
    avatarUrl?: string
    gender?: number
    student_id?: string
    name?: string
    class_id?: string
    role?: number
    phone?: string
    email?: string
  }
}

export interface CloudBaseLoginParams {
  uid: string
  cloudbaseToken: string
  phone?: string
  email?: string
  nickName?: string
}

export interface LoginResult {
  success: boolean
  token: string
  user: {
    id: number
    name: string
    nickName?: string
    student_id?: string
    role: number
    class_id: string
    avatarUrl: string
    phone?: string
    email?: string
  }
}

export interface UserInfoResult {
  success: boolean
  /** 服务端权限快照（权限矩阵可在超管后台配置） */
  permissions?: Record<string, boolean>
  user: {
    id: number
    name: string
    student_id: string
    class_id: string
    role: number
    phone: string
    email: string
    avatarUrl: string
    nickName: string
  }
}

// --- 新增认证方式 ---

/**
 * 学号+密码登录
 */
export function loginWithPassword(params: { student_id: string; password: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login-with-password', params, authOpts(opts))
}

/**
 * 手机号+密码登录
 */
export function loginWithPhone(params: { phone: string; password: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login-with-phone', params, authOpts(opts))
}

/**
 * 邮箱+密码登录
 */
export function loginWithEmail(params: { email: string; password: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login-with-email', params, authOpts(opts))
}

/**
 * 发送验证码（手机号/邮箱）
 */
export function sendCode(params: { phone?: string; email?: string }, opts: RequestOpts = {}): Promise<{ success: boolean; code?: string; message: string }> {
  return post('/api/auth/send-code', params, authOpts({ silent: false, ...opts }))
}

/**
 * 手机号+验证码登录/注册
 */
export function phoneCodeLogin(params: { phone: string; code: string; name?: string; student_id?: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/phone-code-login', params, authOpts(opts))
}

/**
 * 邮箱+验证码登录
 */
export function emailCodeLogin(params: { email: string; code: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/email-code-login', params, authOpts(opts))
}

/**
 * 设置/重置密码
 */
export function setPassword(params: { phone?: string; email?: string; code: string; password: string }, opts: RequestOpts = {}): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/set-password', params, authOpts(opts))
}

// --- 原有认证方式 ---

/**
 * 微信小程序登录 - 用 code 换取后端 JWT
 */
export function loginWithCode(params: LoginParams): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login', params, false)
}

/**
 * CloudBase UID 登录 - H5/Web 端使用
 */
export function loginWithCloudBase(params: CloudBaseLoginParams): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/cloudbase-login', params, false)
}

export interface RegisterParams {
  openid?: string
  student_id: string
  name: string
  phone?: string
  email?: string
  gender?: number
  class_id?: string
  /** 角色：可以是 INT(0-8) 或中文角色名 */
  role?: number | string
  /** 兼容老 register 字段：管理员中文角色名 */
  adminRole?: string
  nickName?: string
  avatarUrl?: string
}

export interface RegisterResult extends LoginResult {
  reused?: boolean
}

/**
 * 注册并直接拿到 JWT
 */
export function register(params: RegisterParams): Promise<RegisterResult> {
  return post<RegisterResult>('/api/auth/register', params, false)
}

/**
 * 注册并存储 token
 */
export async function registerAndStoreToken(params: RegisterParams): Promise<RegisterResult> {
  const result = await register(params)
  if (result?.success && result.token) {
    setToken(result.token)
  }
  return result
}

/**
 * 刷新 token
 */
export function refreshToken(token: string): Promise<any> {
  return post('/api/auth/refresh', { refreshToken: token }, false)
}

/**
 * 登出
 */
export function logout(): Promise<any> {
  return post('/api/auth/logout')
}

/**
 * 获取当前用户信息
 */
export function getUserInfo(): Promise<UserInfoResult> {
  return get<UserInfoResult>('/api/auth/userinfo')
}

/**
 * 后端登录并存储 token (微信小程序)
 */
export async function loginAndStoreToken(params: LoginParams): Promise<LoginResult> {
  const result = await loginWithCode(params)
  if (result.success && result.token) {
    setToken(result.token)
  }
  return result
}

/**
 * CloudBase 登录并存储 token (H5/Web)
 */
export async function cloudBaseLoginAndStoreToken(params: CloudBaseLoginParams): Promise<LoginResult> {
  const result = await loginWithCloudBase(params)
  if (result.success && result.token) {
    setToken(result.token)
  }
  return result
}

/**
 * 修改密码
 */
export function changePassword(
  params: { old_password: string; new_password: string },
  opts: RequestOpts = { silent: true },
): Promise<{ success: boolean; message: string }> {
  // 默认 silent：设置页在表单里就地展示「原密码错误」等原因
  return post('/api/auth/change-password', params, opts)
}
