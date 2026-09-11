<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'

const ITEMS = [
  { icon: 'calendar', label: '请假', path: '/pages/leave/apply' },
  { icon: 'file', label: '报销', path: '/pages/fee/expense-apply' },
  { icon: 'book', label: '作业', path: '/pages/homework/index' },
  { icon: 'image', label: '相册', path: '/pages/album/index' },
  { icon: 'check-circle', label: '投票', path: '/pages/vote/index' },
  { icon: 'grid', label: '更多', path: '/pages/features/index' },
]

const router = useRouter()
</script>

<template>
  <div class="section-title">常用功能</div>
  <div class="quick-grid">
    <button
      v-for="item in ITEMS"
      :key="item.label"
      class="quick-item"
      type="button"
      @click="router.push(item.path)"
    >
      <AppIcon :name="item.icon" :size="20" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

.quick-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  padding: 0 12px;
}
.quick-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 64px;
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border: none; font-family: inherit;
  border-radius: var(--radius-md); padding: 14px 8px; text-align: center;
  font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text); cursor: pointer;
}
.quick-item:active { background: var(--color-surface-hover); }
</style>
