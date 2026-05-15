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

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.component('show-captcha', showCaptcha)
app.component('custom-nav-bar', CustomNavBar)
app.component('uni-popup', UniPopup)
app.component('uni-load-more', UniLoadMore)
app.component('uni-transition', UniTransition)

app.mount('#app')
