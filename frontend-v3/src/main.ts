import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import { setRouteGuard, setRequestToastHandler, setAuthFailureHandler } from '@/utils/request'
import { showToast, clearToasts } from '@/utils/ui'
import { initTheme } from '@/utils/theme'
import { useUserStore } from '@/stores/user'

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
router.afterEach(() => {
  clearToasts()
})

app.mount('#app')

// 通知 index.html 的启动兜底面板：应用已挂载，撤掉"加载失败"提示
declare global {
  interface Window { __APP_BOOT_OK__?: () => void }
}
window.__APP_BOOT_OK__?.()

// 有 token 时拉一次服务端权限快照（后台改过权限矩阵也能生效）
if (userStore.isAuthenticated) {
  void userStore.refreshPermissionsOnce()
}
