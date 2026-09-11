<script setup lang="ts">
/**
 * 三态容器（B2）
 *
 * 2026-09 的问题：23 个列表/详情页里错误重试入口是 0 个，
 * 30 处 `catch (_) {}` 把失败吞成了「暂无数据」，用户把加载失败当成业务事实。
 *
 * 统一用法：
 *   <StateView
 *     :loading="loading"
 *     :error="error"
 *     :empty="list.length === 0"
 *     empty-title="还没有请假记录"
 *     empty-description="点右上角「+ 请假」发起申请"
 *     @retry="load"
 *   >
 *     <div v-for="item in list" :key="item.id">…</div>
 *   </StateView>
 */
import EmptyState from './EmptyState.vue'
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  loading?: boolean
  /** 错误对象或错误文案；有值即展示错误态 + 重试 */
  error?: unknown
  empty?: boolean
  loadingText?: string
  emptyIcon?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyActionText?: string
  emptyActionIcon?: string
  /** 错误态标题（默认「加载失败」），业务可写更具体的原因 */
  errorTitle?: string
  /** 筛选/搜索无结果时用 filtered，文案与图标不同 */
  emptyVariant?: 'default' | 'filtered' | 'error'
  /** 紧凑模式（卡片内嵌小列表） */
  slim?: boolean
}>(), {
  loading: false,
  error: null,
  empty: false,
  loadingText: '加载中…',
  emptyIcon: 'inbox',
  emptyTitle: '暂无数据',
  emptyDescription: '',
  emptyActionText: '',
  emptyActionIcon: 'plus',
  errorTitle: '加载失败',
  emptyVariant: 'default',
  slim: false,
})

defineEmits<{ retry: []; 'empty-action': [] }>()

function errorText(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  const e = err as { message?: string; code?: string; status?: number }
  if (e.code === 'TIMEOUT') return '请求超时，请检查网络后重试'
  if (e.code === 'NETWORK' || e.status === 0) return '网络连接失败，请检查网络后重试'
  return e.message || '加载失败，请稍后重试'
}
</script>

<template>
  <!-- 1. 加载 -->
  <div v-if="loading" class="state-loading" :class="{ slim }">
    <template v-if="slim">
      <span class="dot" /><span class="dot" /><span class="dot" />
    </template>
    <template v-else>
      <div class="skeleton">
        <div v-for="i in 3" :key="i" class="skeleton-row">
          <div class="skeleton-avatar" />
          <div class="skeleton-lines">
            <div class="skeleton-line w70" />
            <div class="skeleton-line w40" />
          </div>
        </div>
      </div>
      <div class="loading-text">{{ loadingText }}</div>
    </template>
  </div>

  <!-- 2. 错误（带重试） -->
  <EmptyState
    v-else-if="error"
    variant="error"
    icon="alert-circle"
    :title="errorTitle"
    :description="errorText(error)"
  >
    <button class="retry-btn" type="button" @click="$emit('retry')">
      <AppIcon name="refresh" :size="15" />
      <span>重试</span>
    </button>
  </EmptyState>

  <!-- 3. 空 -->
  <slot v-else-if="empty" name="empty">
    <EmptyState
      :icon="emptyIcon"
      :variant="emptyVariant"
      :title="emptyTitle"
      :description="emptyDescription"
      :action-text="emptyActionText"
      :action-icon="emptyActionIcon"
      @action="$emit('empty-action')"
    />
  </slot>

  <!-- 4. 正常内容 -->
  <slot v-else />
</template>

<style scoped>
.state-loading { padding: 16px; }
.state-loading.slim {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-3);
  animation: dot-pulse 1s ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes dot-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1); }
}

.skeleton { display: flex; flex-direction: column; gap: 12px; }
.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
.skeleton-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--color-surface-2);
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: var(--color-surface-2);
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-line.w70 { width: 70%; }
.skeleton-line.w40 { width: 40%; }
@keyframes shimmer {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
.loading-text {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  padding: 10px 0 4px;
}

.retry-btn {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 10px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.retry-btn:active { background: var(--color-surface-hover); }
</style>
