import { useUserStore } from '@/stores/user'

/** 无需登录的白名单路由前缀 */
const PUBLIC_ROUTES = [
  '/pages/auth/register',
  '/pages/login/password-login',
  '/pages/login/phone-login',
  '/pages/login/email-login',
]

/** 登录兜底页面：有 token 但 profile 失效时跳到密码登录页 */
const DEFAULT_LOGIN = '/pages/login/password-login'
/** 注册入口：从未注册过的用户 */
const DEFAULT_REGISTER = '/pages/auth/register'

/**
 * 路由守卫 — 验证登录状态，未登录/过期时重定向。
 *
 * 在 onLaunch / onShow 中调用，也在 401 拦截后手动触发。
 *
 * @param forceRedirect 为 true 时始终执行重定向（用于 401 回调）
 */
export function routeGuard(forceRedirect = false) {
  const userStore = useUserStore()
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  const route = current?.route || current?.$page?.fullPath || ''

  // 白名单 → 不拦截
  for (const prefix of PUBLIC_ROUTES) {
    if (route.startsWith(prefix)) return
  }

  // 已认证 → 通行
  if (userStore.isAuthenticated) return

  // 未认证：判断是纯粹未注册，还是 token 已过期
  const hasToken = !!uni.getStorageSync('backend_token')

  if (forceRedirect || (hasToken && !userStore.isAuthenticated)) {
    // 有 token 但验证过期 → 尝试刷新，刷新失败跳登录
    userStore.refresh().then((profile) => {
      if (profile) return // 刷新成功
      // 刷新失败 → 登录页
      uni.reLaunch({ url: DEFAULT_LOGIN })
    })
  } else {
    // 无 token → 注册页
    uni.reLaunch({ url: DEFAULT_REGISTER })
  }
}
