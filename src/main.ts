/**
 * 全局 uni.* API 适配层
 * 在 App mount 之前加载，使全部 uni.* 调用在 H5 环境正常工作
 */
import './shims/uni-api'

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
  d('custom components registered')

  d('mounting...')
  app.mount('#app')
  d('MOUNT SUCCESS')
} catch (e: any) {
  d('ERROR: ' + (e.message || String(e)))
  console.error('[boot] Fatal error:', e)
}
