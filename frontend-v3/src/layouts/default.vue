<script setup lang="ts">
import { useRoute } from 'vue-router'
import TabBar from '@/components/ui/TabBar.vue'

const route = useRoute()

function getCurrentTab(): string {
  const path = route.path
  if (path.startsWith('/pages/index')) return 'home'
  if (path.startsWith('/pages/dashboard')) return 'dashboard'
  if (path.startsWith('/pages/notice')) return 'notice'
  if (path.startsWith('/pages/homework')) return 'homework'
  if (path.startsWith('/pages/leave')) return 'leave'
  if (path.startsWith('/pages/profile')) return 'profile'
  return ''
}
</script>

<template>
  <div class="app-shell">
    <div class="app-content">
      <router-view />
    </div>
    <TabBar :current="getCurrentTab()" />
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--color-bg);
  padding-bottom: 64px;
  transition: background 0.3s;
}
</style>
