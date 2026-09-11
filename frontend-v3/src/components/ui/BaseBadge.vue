<script setup lang="ts">
/**
 * 徽标 / 标签（B6）
 *
 * 2026-09 前 Badge/Tag 有 26 处各写各的（同一状态 2–3 套色值）。
 * 用法：<BaseBadge variant="warning">待审批</BaseBadge> / <BaseBadge dot variant="success" />
 */
withDefaults(defineProps<{
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  size?: 'sm' | 'md'
  dot?: boolean
  /** 纯色块（反白），用于深色背景上 */
  solid?: boolean
}>(), {
  variant: 'default',
  size: 'sm',
  dot: false,
  solid: false,
})
</script>

<template>
  <span class="badge" :class="[`badge-${variant}`, `badge-${size}`, { solid }]">
    <span v-if="dot" class="badge-dot" />
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  padding: 4px 8px;
  font-size: var(--font-size-2xs);
}
.badge-md { padding: 5px 10px; font-size: var(--font-size-xs); }
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.badge-default { background: var(--color-surface-2); color: var(--color-text-2); }
.badge-success { background: var(--color-success-bg); color: var(--color-success); }
.badge-warning { background: var(--color-warning-bg); color: var(--color-warning); }
.badge-danger { background: var(--color-error-bg); color: var(--color-error); }
.badge-info { background: var(--color-accent-bg); color: var(--color-accent); }
.badge-primary { background: var(--color-primary-container); color: var(--color-primary); }

.badge-success.solid { background: var(--color-success); color: #fff; }
.badge-warning.solid { background: var(--color-warning); color: #fff; }
.badge-danger.solid { background: var(--color-error); color: #fff; }
.badge-info.solid { background: var(--color-accent); color: #fff; }
.badge-primary.solid { background: var(--color-primary); color: #fff; }
.badge-default.solid { background: var(--color-text-2); color: var(--color-surface); }
</style>
