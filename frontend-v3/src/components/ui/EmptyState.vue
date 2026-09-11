<script setup lang="ts">
/**
 * 空状态（B5/B6）
 *
 * 2026-09 前全站有 20 种各写各的空态、53 处「暂无X」文案，普遍没有 CTA，
 * 也分不清「本来没有」和「筛选后为空」。
 *
 * 用法：
 *   <EmptyState
 *     icon="clipboard"
 *     title="还没有请假记录"
 *     description="请假需要干部审批，建议提前 1 天申请"
 *     action-text="发起请假"
 *     @action="goApply"
 *   />
 *   <EmptyState variant="filtered" title="当前筛选条件下没有记录" />
 */
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  /** filtered = 筛选/搜索无结果；error = 加载失败；default = 真的没有数据 */
  variant?: 'default' | 'filtered' | 'error'
  actionText?: string
  /** CTA 图标（默认 plus），例如「返回上一页」用 chevron-left */
  actionIcon?: string
}>(), {
  icon: 'inbox',
  title: '暂无数据',
  description: '',
  variant: 'default',
  actionText: '',
  actionIcon: 'plus',
})

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty" :class="`empty-${variant}`">
    <div class="empty-icon">
      <AppIcon
        :name="variant === 'error' ? 'alert-circle' : variant === 'filtered' ? 'search' : icon"
        :size="30"
        :stroke="1.5"
      />
    </div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-desc">{{ description }}</div>
    <slot />
    <button v-if="actionText" class="empty-action" type="button" @click="$emit('action')">
      <AppIcon :name="actionIcon" :size="15" />
      <span>{{ actionText }}</span>
    </button>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 40px 24px;
  text-align: center;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-2);
  color: var(--color-text-3);
  margin-bottom: 6px;
}
.empty-error .empty-icon { background: var(--color-error-bg); color: var(--color-error); }
.empty-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
}
.empty-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-3);
  line-height: 1.5;
  max-width: 260px;
}
.empty-action {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 10px 18px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.empty-action:active { opacity: 0.9; }
</style>
