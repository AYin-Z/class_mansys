/**
 * 全局 uni.* API 适配层
 * 在 App mount 之前加载，使全部 uni.* 调用在 H5 环境正常工作
 */
import './shims/uni-api'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import showCaptcha from './components/show-captcha.vue'
import CustomNavBar from './components/custom-nav-bar.vue'
import UniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue'
import UniLoadMore from '@dcloudio/uni-ui/lib/uni-load-more/uni-load-more.vue'
import UniTransition from '@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue'

// ====== 诊断日志 ======
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
  d('custom components registered')

  d('registering uni-ui components...')
  app.component('uni-popup', UniPopup)
  app.component('uni-load-more', UniLoadMore)
  app.component('uni-transition', UniTransition)
  d('uni-ui components registered')

  d('mounting...')
  app.mount('#app')
  d('MOUNT SUCCESS')
} catch (e: any) {
  d('ERROR: ' + (e.message || String(e)))
  console.error('[boot] Fatal error:', e)
}
