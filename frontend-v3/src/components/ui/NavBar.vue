<script setup lang="ts">
/**
 * 顶部导航条
 *
 * 2026-09 修复（B4）：
 *  - 返回此前只调 router.back()，没有"无历史可退"的判断：
 *    从通知/深链直接进入或刷新页面后点 ‹ 会直接退出 App（Capacitor 壳里就是关掉应用）。
 *  - 现在优先走浏览器历史，无历史时 router.replace 到 fallback（默认首页）。
 *  - 点击区域由 36px 提到 44px（移动端最小可点尺寸）。
 *  - 补 @back 事件：此前有 3 个页面监听 @back 但组件从未 emit，属死代码。
 */
import { computed, useAttrs } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{
  title?: string
  showBack?: boolean
  /** 无历史可退时的落地页 */
  fallback?: string
  /** 透明背景（叠在 hero 图上） */
  transparent?: boolean
}>(), {
  title: '',
  showBack: false,
  fallback: '/pages/index/index',
  transparent: false,
})

const emit = defineEmits<{ back: [] }>()

const router = useRouter()
const attrs = useAttrs()

const hasBackListener = computed(() => typeof attrs.onBack === 'function')

function goBack() {
  // 页面自己接管返回逻辑（例如"有未保存内容，确认离开"）
  if (hasBackListener.value) {
    emit('back')
    return
  }
  const historyState = window.history.state as { back?: string | null } | null
  if (historyState && historyState.back) {
    router.back()
    return
  }
  router.replace(props.fallback)
}
</script>

<template>
  <header class="nav-bar" :class="{ transparent }">
    <button
      v-if="showBack"
      class="nav-btn"
      type="button"
      aria-label="返回"
      @click="goBack"
    >
      <AppIcon name="chevron-left" :size="22" :stroke="2" />
    </button>
    <div v-else class="nav-btn-placeholder" aria-hidden="true" />
    <h1 class="nav-title">{{ title }}</h1>
    <div class="nav-right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.nav-bar {
  position: sticky;
  top: 0;
  z-index: var(--z-navbar, 10);
  min-height: var(--navbar-h, 48px);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  transition: background var(--dur-base), border-color var(--dur-base);
}
.nav-bar.transparent {
  background: transparent;
  border-bottom: none;
}
.nav-btn,
.nav-btn-placeholder {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nav-btn {
  border: none;
  background: transparent;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nav-btn:active { background: var(--color-surface-hover); }
.nav-title {
  flex: 1;
  text-align: center;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-right {
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
</style>
