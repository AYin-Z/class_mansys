/**
 * 全局 uni.* API 适配层
 * 在 App mount 之前加载，使全部 uni.* 调用在 H5 环境正常工作
 */
import './shims/uni-api'
// 全局注册 uni-app 生命周期 hooks，避免每个页面单独 import
import { onLoad, onShow as uniOnShow, onHide, onLaunch } from '@dcloudio/uni-app'
// ⚠️ uni-app 的 onShow 依赖原生页面生命周期，在纯 vue-router 下不触发。
// 用自定义 onShow + router.afterEach 替代，确保页面返回时数据刷新。
const _showCallbacks: Set<() => void> = new Set()
const customOnShow = (cb: () => void) => { _showCallbacks.add(cb) }
router.afterEach(() => { _showCallbacks.forEach(cb => { try { cb() } catch {} }) })
Object.assign(window, { onLoad, onShow: customOnShow, onHide, onLaunch })

import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import showCaptcha from './components/show-captcha.vue'
import CustomNavBar from './components/custom-nav-bar.vue'
import CustomTabBar from './components/custom-tab-bar.vue'
import UniPicker from './shims/uni-picker.vue'

// ====== 诊断日志 ======
import { createApp } from 'vue'
const d = (msg: string) => {
  console.log('[boot]', msg)
  if ((window as any).__debugLog) (window as any).__debugLog(msg)
}
d('main.ts loaded')

try {
  d('creating app...')
  const app = createApp(App)
  d('app created')

  d('installing pinia...')
  app.use(createPinia())
  d('pinia installed')

  d('installing router...')
  app.use(router)
  d('router installed')

  d('registering components...')
  app.component('show-captcha', showCaptcha)
  app.component('custom-nav-bar', CustomNavBar)
  app.component('custom-tab-bar', CustomTabBar)
  app.component('uni-picker', UniPicker)
  d('custom components registered')

  d('mounting...')
  app.mount('#app')
  d('MOUNT SUCCESS')
} catch (e: any) {
  d('ERROR: ' + (e.message || String(e)))
  console.error('[boot] Fatal error:', e)
}
