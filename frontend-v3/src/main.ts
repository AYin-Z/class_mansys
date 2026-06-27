import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import { setRouteGuard } from '@/utils/request'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setRouteGuard(() => {
  router.replace('/pages/login/password-login')
})
app.mount('#app')
