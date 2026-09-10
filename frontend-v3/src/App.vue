<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import TabBar from '@/components/ui/TabBar.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 初始化
userStore.hydrate()

// 判断是否显示 TabBar（非公开路由，且非超管后台）
const isAdminRoute = computed(() => route.path.startsWith('/admin/'))
const showTabBar = computed(() => {
  return !route.meta?.public && !isAdminRoute.value
})

// 当前 tab
const currentTab = computed(() => {
  const path = route.path
  if (path.startsWith('/pages/index')) return 'home'
  if (path.startsWith('/pages/dashboard')) return 'dashboard'
  if (path.startsWith('/pages/company')) return 'company'
  if (path.startsWith('/pages/notice')) return 'notice'
  if (path.startsWith('/pages/homework')) return 'homework'
  if (path.startsWith('/pages/leave')) return 'leave'
  if (path.startsWith('/pages/agent')) return 'agent'
  if (path.startsWith('/pages/profile')) return 'profile'
  return ''
})

// 登录状态变化监听
watch(() => userStore.isAuthenticated, (val) => {
  if (!val) {
    const publicRoutes = ['/pages/login/password-login', '/pages/login/phone-login', '/pages/login/email-login']
    const isPublic = publicRoutes.some(p => route.path.startsWith(p))
    if (!isPublic) {
      router.replace('/pages/login/password-login')
    }
  }
})
</script>

<template>
  <div class="app-shell" :class="{ 'admin-shell': isAdminRoute }">
    <div class="app-content">
      <router-view />
    </div>
    <TabBar v-if="showTabBar" :current="currentTab" />
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-bg);
  transition: background 0.3s;
}
.app-shell.admin-shell {
  max-width: none;
}
.app-content {
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom);
}
.app-shell.admin-shell .app-content {
  padding-bottom: 0;
}

@media (min-width: 768px) {
  .app-shell:not(.admin-shell) {
    max-width: 900px;
    border-left: 1px solid var(--color-border);
    border-right: 1px solid var(--color-border);
  }
}

@media (min-width: 1200px) {
  .app-shell:not(.admin-shell) {
    max-width: 1100px;
  }
}
</style>
