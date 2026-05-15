import { useUserStore } from '@/stores/user'
import type { Router } from 'vue-router'

/** 无需登录的白名单路由前缀 */
const PUBLIC_ROUTES = [
  '/pages/auth/register',
  '/pages/login/password-login',
  '/pages/login/phone-login',
  '/pages/login/email-login',
]

/** 登录兜底页面 */
const DEFAULT_LOGIN = '/pages/login/password-login'
/** 注册入口 */
const DEFAULT_REGISTER = '/pages/auth/register'

/**
 * 路由守卫 — 验证登录状态，未登录/过期时重定向。
 *
 * 在 App.vue 的 onMounted / onActivated 中调用，在 401 拦截后手动触发。
 *
 * @param router - vue-router 实例（setup 上下文内调用无需传参，使用 useRouter()）
 * @param forceRedirect - 为 true 时始终执行重定向（用于 401 回调）
 */
export function routeGuard(router?: Router, forceRedirect = false) {
  const userStore = useUserStore()

  // 当前路由路径
  let currentPath = ''
  if (router) {
    currentPath = router.currentRoute.value?.path || ''
  } else {
    // 没有 router 参数时尝试从全局 uni shim 的 getCurrentPages 获取
    try {
      currentPath = window.location.hash.replace(/^#/, '')
    } catch {}
  }

  // 白名单 → 不拦截
  for (const prefix of PUBLIC_ROUTES) {
    if (currentPath.startsWith(prefix)) return
  }

  // 已认证 → 通行
  if (userStore.isAuthenticated) return

  // 未认证
  const hasToken = !!localStorage.getItem('backend_token')

  if (forceRedirect || (hasToken && !userStore.isAuthenticated)) {
    userStore.refresh().then((profile) => {
      if (profile) return
      if (router) {
        router.replace(DEFAULT_LOGIN)
      } else {
        try { (window as any).uni?.reLaunch?.({ url: DEFAULT_LOGIN }) } catch {}
      }
    })
  } else {
    if (router) {
      router.replace(DEFAULT_REGISTER)
    } else {
      try { (window as any).uni?.reLaunch?.({ url: DEFAULT_REGISTER }) } catch {}
    }
  }
}
