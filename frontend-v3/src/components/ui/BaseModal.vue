<script setup lang="ts">
/**
 * 基础弹窗（B6）
 *
 * 2026-09 前全站有 11 个页面各写各的遮罩/弹窗（遮罩透明度 .4/.45、
 * z-index 60/100 混用、无 ESC、点击遮罩行为不一致）。统一到这里。
 *
 * 用法：
 *   <BaseModal v-model="show" title="标记免缴">
 *     <div>…</div>
 *     <template #footer>
 *       <BaseButton variant="secondary" @click="show=false">取消</BaseButton>
 *       <BaseButton :loading="saving" @click="confirm">确定</BaseButton>
 *     </template>
 *   </BaseModal>
 */
import { onBeforeUnmount, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  /** 危险操作：标题栏与确认按钮语义偏红 */
  danger?: boolean
  /** 点击遮罩是否关闭（表单类弹窗建议 false，避免误触丢输入） */
  closeOnOverlay?: boolean
  maxWidth?: string
  /** 底部按钮区由 #footer 提供；无 footer 时不显示操作条 */
  hideClose?: boolean
}>(), {
  title: '',
  danger: false,
  closeOnOverlay: true,
  maxWidth: '340px',
  hideClose: false,
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function lockBody(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(() => props.modelValue, (open) => {
  lockBody(open)
  if (open) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
}, { immediate: true })

onBeforeUnmount(() => {
  lockBody(false)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      @click.self="closeOnOverlay && close()"
    >
      <div class="modal-card" :style="{ maxWidth }">
        <div class="modal-header">
          <h3 class="modal-title" :class="{ danger }">{{ title }}</h3>
          <button v-if="!hideClose" class="modal-close" type="button" aria-label="关闭" @click="close">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay, rgba(0,0,0,.45));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: var(--z-modal, 100);
  animation: fade-in var(--dur-fast) var(--ease-out);
}
.modal-card {
  width: 100%;
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  animation: pop-in var(--dur-base) var(--ease-out);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 16px 8px;
}
.modal-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}
.modal-title.danger { color: var(--color-error); }
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-3);
  cursor: pointer;
}
.modal-close:active { background: var(--color-surface-hover); }
.modal-body {
  padding: 4px 16px 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.modal-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(16px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)));
  border-top: 1px solid var(--color-border);
}
.modal-footer > :deep(*) { flex: 1; }

@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
</style>
