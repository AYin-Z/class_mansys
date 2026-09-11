import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import { setRouteGuard, setRequestToastHandler } from '@/utils/request'
import { showToast } from '@/utils/ui'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setRouteGuard(() => {
  router.replace('/pages/login/password-login')
})
// 接口失败统一提示（此前该逻辑是死代码：调的是从未定义的 window.uni）
setRequestToastHandler((msg: string) => showToast(msg, 'error'))
app.mount('#app')
