import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import { setRouteGuard, setRequestToastHandler, setAuthFailureHandler } from '@/utils/request'
import { showToast, clearToasts } from '@/utils/ui'
import { initTheme } from '@/utils/theme'
import { useUserStore } from '@/stores/user'
import { collectSnapshot, reportBootOk, reportClient } from '@/utils/diagnostics'

// 主题必须在挂载前应用：否则冷启动会先闪一下亮色
initTheme()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const userStore = useUserStore(pinia)
// 先从本地缓存恢复登录态（App.vue 也会调用，hydrate 是幂等的）
userStore.hydrate()

setRouteGuard(() => {
  router.replace('/pages/login/password-login')
})
// 接口失败统一提示（此前该逻辑是死代码：调的是从未定义的 window.uni）
setRequestToastHandler((msg: string) => showToast(msg, 'error'))
// 登录失效时同步清内存态：否则被踢回登录页后权限快照仍在，
// 管理入口继续可见，点一下又是一次 401
setAuthFailureHandler(() => {
  userStore.resetAuth()
})

// 切页时清掉残留提示，避免上一个页面的错误提示漂到新页面
router.afterEach((to) => {
  clearToasts()
  /**
   * 内容区自检（2026-09-11 手机端"内容全白但无报错"排查）
   *
   * 挂载成功 ≠ 页面渲染成功：路由已切换但 .app-content 里没有文本，
   * 说明是"渲染了但不可见"或"根本没匹配到内容"。
   * 这种情况没有异常可抓，只能把设备现场的样式/DOM 快照上报回来。
   */
  setTimeout(() => {
    const content = document.querySelector('.app-content') as HTMLElement | null
    const textLen = (content?.innerText || '').trim().length
    if (textLen === 0) {
      reportClient({
        kind: 'empty-content',
        message: `空内容：${to.fullPath}`,
        snapshot: collectSnapshot(to.fullPath),
      })
    } else if (!(window as unknown as { __contentOkReported__?: boolean }).__contentOkReported__) {
      ;(window as unknown as { __contentOkReported__?: boolean }).__contentOkReported__ = true
      reportClient({ kind: 'content-ok', message: to.fullPath, snapshot: collectSnapshot(to.fullPath) })
    }
  }, 1500)
})

/**
 * 全局错误兜底（2026-09 手机端白屏排查）
 *
 * 现象：手机上底部导航正常、内容区一片白，而服务端日志只有 200。
 * 只靠服务端看不出原因，因此：
 *  - 组件渲染/生命周期里抛的错 → app.config.errorHandler：上报 + 页面顶部给出可读提示
 *  - 路由懒加载 chunk 失败 → router.onError：上报 + 自动重载一次（版本更新/缓存错位场景）
 *  - 未捕获的脚本错误与 Promise 异常 → 上报（在 index.html 里也挂了同样的监听）
 */
app.config.errorHandler = (err, _instance, info) => {
  const e = err as Error
  reportClient({ kind: 'vue-error', message: `${info}: ${e?.message || e}`, stack: e?.stack })
  showToast('页面出错了，已记录问题。请下拉刷新或重进小程序', 'error')
}

router.onError((error) => {
  const msg = String((error as Error)?.message || error)
  reportClient({ kind: 'route-error', message: msg, stack: (error as Error)?.stack })
  // 动态 chunk 加载失败（版本更新后旧包被替换）→ 自动硬刷新一次
  const key = '__route_reload__'
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1')
    showToast('正在更新到最新版本…', 'none')
    setTimeout(() => location.reload(), 600)
  } else {
    showToast('页面加载失败，请检查网络后重试', 'error')
  }
})

app.mount('#app')

// 通知 index.html 的启动兜底面板撤掉，并留一条正常启动的记录
reportBootOk()

// 有 token 时拉一次服务端权限快照（后台改过权限矩阵也能生效）
if (userStore.isAuthenticated) {
  void userStore.refreshPermissionsOnce()
}
