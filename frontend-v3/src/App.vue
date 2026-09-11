<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import TabBar from '@/components/ui/TabBar.vue'
import { reportClient } from '@/utils/diagnostics'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 初始化
userStore.hydrate()

// 判断是否显示 TabBar（非公开路由，且非超管后台）
const isAdminRoute = computed(() => route.path.startsWith('/admin/'))
const isPublicRoute = computed(() => !!route.meta?.public)
const showTabBar = computed(() => {
  return !isPublicRoute.value && !isAdminRoute.value
})

/** 页面级渲染错误：至少让用户看到"出错了"，而不是内容区一片空白 */
const pageError = ref<string>('')
onErrorCaptured((err) => {
  const e = err as Error
  pageError.value = e?.message || '页面渲染失败'
  reportClient({ kind: 'vue-error', message: 'page: ' + pageError.value, stack: e?.stack })
  return false // 阻止继续向上抛，保证外壳（导航/底部栏）仍然可用
})

// 登录状态变化监听（isAuthenticated 现在是响应式的：token 存于 store 的 ref）
watch(() => userStore.isAuthenticated, (val) => {
  if (!val) {
    const publicRoutes = ['/pages/login/password-login', '/pages/login/phone-login', '/pages/login/email-login', '/admin/login']
    const isPublic = publicRoutes.some(p => route.path.startsWith(p))
    if (!isPublic) {
      router.replace('/pages/login/password-login')
    }
  }
})
</script>

<template>
  <div class="app-shell" :class="{ 'admin-shell': isAdminRoute, 'with-tabbar': showTabBar }">
    <div class="app-content">
      <div v-if="pageError" class="page-error" role="alert">
        <p class="page-error-title">这个页面没能正常显示</p>
        <p class="page-error-msg">{{ pageError }}</p>
        <button type="button" @click="pageError = ''; $router.go(0)">重新加载</button>
      </div>
      <router-view v-else />
    </div>
    <TabBar v-if="showTabBar" />
  </div>
</template>

<style scoped>
.page-error {
  margin: 24px 16px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
}
.page-error-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: 8px; }
.page-error-msg {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  word-break: break-all;
  margin-bottom: 14px;
}
.page-error button {
  min-height: 44px;
  padding: 10px 18px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-md);
  font-family: inherit;
}
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-bg);
  transition: background var(--dur-base);
}
.app-shell.admin-shell {
  max-width: none;
}
.app-content {
  min-height: 100vh;
  padding-bottom: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
}
/* 有 TabBar 时统一预留高度，页面无需自己写 padding-bottom: 80px */
.app-shell.with-tabbar .app-content {
  padding-bottom: calc(var(--tabbar-h, 56px) + var(--safe-bottom, env(safe-area-inset-bottom, 0px)));
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
