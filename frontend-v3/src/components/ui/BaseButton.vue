<script setup lang="ts">
/**
 * 基础按钮（B6）
 *
 * 2026-09 前全站「主按钮」有 6 种实现（高度 42–48px、圆角 6–10px、
 * 字号 13–16px、深蓝/亮蓝两种主色）。这里收敛成一份，后续页面统一替换。
 *
 * 用法：
 *   <BaseButton variant="primary" :loading="saving" block @click="submit">提交</BaseButton>
 *   <BaseButton variant="danger" size="sm" @click="remove">删除</BaseButton>
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
  size?: 'lg' | 'md' | 'sm'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), {
  variant: 'primary',
  size: 'lg',
  block: false,
  loading: false,
  disabled: false,
  type: 'button',
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    class="btn"
    :class="[`btn-${variant}`, `btn-${size}`, { block, loading }]"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity var(--dur-fast), background var(--dur-fast), transform var(--dur-fast);
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}
.btn.block { display: flex; width: 100%; }

/* 尺寸：lg=44px 主操作、md=38px、sm=32px 次级 */
.btn-lg { min-height: 46px; padding: 10px 16px; font-size: var(--font-size-md); }
.btn-md { min-height: 42px; padding: 8px 14px; font-size: var(--font-size-body); }
.btn-sm { min-height: 38px; padding: 8px 12px; font-size: var(--font-size-sm); border-radius: var(--radius-sm); }

.btn-primary { background: var(--color-accent); color: #fff; }
.btn-secondary { background: var(--color-surface-2); color: var(--color-text); border-color: var(--color-border); }
.btn-ghost { background: transparent; color: var(--color-text-2); border-color: var(--color-border); }
.btn-danger { background: var(--color-error); color: #fff; }
.btn-text { background: transparent; color: var(--color-accent); border: none; padding-left: 6px; padding-right: 6px; }

.btn:active:not(:disabled) { transform: scale(0.985); opacity: 0.9; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}
@keyframes btn-spin { to { transform: rotate(360deg); } }
</style>
