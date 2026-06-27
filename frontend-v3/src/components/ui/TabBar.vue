<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const TABS = [
  { key: 'home', label: '首页', icon: '🏠', path: '/pages/index/index' },
  { key: 'dashboard', label: '仪表盘', icon: '📊', path: '/pages/dashboard/index' },
  { key: 'profile', label: '我的', icon: '👤', path: '/pages/profile/index' },
]

const props = defineProps<{
  current?: string
}>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const visibleTabs = computed(() => {
  if (userStore.isAdmin) return TABS
  return TABS.filter(t => !t.adminOnly)
})

function goTo(tab: typeof TABS[0]) {
  router.replace(tab.path)
}
</script>

<template>
  <div class="tab-bar">
    <div
      v-for="tab in visibleTabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: current === tab.key || route.path.startsWith(tab.path) }"
      @click="goTo(tab)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom, 0);
  max-width: 100%;
  transition: background 0.3s, border-color 0.3s;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tab-icon { font-size: 20px; line-height: 1.2; }
.tab-label { font-size: 10px; font-weight: 500; margin-top: 2px; }
.tab-item.active { color: var(--color-accent); }
.tab-item:not(.active) { color: var(--color-text-3); transition: color 0.15s; }
</style>
