<script setup lang="ts">
/**
 * 底部导航
 *
 * 2026-09 修复（B4/B6）：
 *  - 图标由 emoji（🏠📊🏢🤖👤）换成内联 SVG：emoji 跨平台字形漂移、
 *    无法跟随主题着色，不同 Android 版本大小还不一致。
 *  - 高亮不再依赖父组件传入的 key（App.vue 之前返回的 notice/homework/leave
 *    在 tab 列表里并不存在，导致 15+ 页面永不高亮），改为按路径前缀判定。
 *  - 首页 tab 增加待办/未读角标（B5）：重要待办不再只藏在「我的」里。
 *  - 高度统一用 --tabbar-h，供页面避让（替代 39 处手写 80px）。
 */
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useBadgeStore } from '@/stores/badge'
import AppIcon from './AppIcon.vue'

import { TABS, type TabItem } from '@/router/tabs'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const badgeStore = useBadgeStore()

const visibleTabs = computed(() =>
  TABS.filter((t) => {
    if (t.perm) return userStore.hasPermission(t.perm as any)
    if (t.adminOnly) return userStore.isAdmin
    return true
  }),
)

/** 当前激活的 tab：按路径前缀判定，深层页面（详情/表单）归属其所属 tab */
const activeKey = computed(() => {
  const path = route.path
  const hit = TABS.find((t) => path === t.path || path.startsWith(t.path + '/'))
  return hit?.key || ''
})

function badgeOf(tab: TabItem): number {
  if (!tab.badge) return 0
  // 首页 = 未读通知 + 待办通知合计；待办中心 = 待办通知（避免两个 tab 显示同一个数字）
  if (tab.key === 'dashboard') return badgeStore.todoCount
  if (tab.key === 'home') return badgeStore.totalUrgent
  return 0
}

function goTo(tab: TabItem) {
  if (activeKey.value === tab.key) return
  // replace：tab 之间切换不写历史，避免「返回」在 tab 间来回跳
  router.replace(tab.path)
}

onMounted(() => {
  void badgeStore.refresh()
})

// 处理完待办/读完通知后回到列表页即可看到最新角标
watch(() => route.path, () => {
  void badgeStore.refresh()
})
</script>

<template>
  <nav class="tab-bar" role="tablist">
    <div
      v-for="tab in visibleTabs"
      :key="tab.key"
      class="tab-item"
      :class="{ active: activeKey === tab.key }"
      role="tab"
      :aria-selected="activeKey === tab.key"
      :aria-label="tab.label"
      @click="goTo(tab)"
    >
      <span class="tab-icon-wrap">
        <AppIcon :name="tab.icon" :size="22" :stroke="activeKey === tab.key ? 2.1 : 1.8" />
        <span v-if="badgeOf(tab) > 0" class="tab-badge">{{ badgeOf(tab) > 99 ? '99+' : badgeOf(tab) }}</span>
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  z-index: var(--z-tabbar, 20);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  padding-bottom: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
  transition: background var(--dur-base), border-color var(--dur-base);
}
@media (min-width: 768px) {
  .tab-bar { max-width: 900px; }
}
@media (min-width: 1200px) {
  .tab-bar { max-width: 1100px; }
}
.tab-item {
  flex: 1;
  height: var(--tabbar-h, 56px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--color-text-3);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--dur-fast), background var(--dur-fast);
}
.tab-item:active { background: var(--color-surface-hover); }
.tab-item.active { color: var(--color-accent); }
.tab-icon-wrap { position: relative; display: inline-flex; }
.tab-badge {
  position: absolute;
  top: -4px;
  left: 12px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--color-error);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  box-sizing: border-box;
}
.tab-label {
  font-size: var(--font-size-2xs);
  font-weight: 500;
  line-height: 1.2;
}
</style>
