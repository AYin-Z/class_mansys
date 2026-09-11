<script setup lang="ts">
/**
 * 表单字段容器（B6）：统一 label / 必填星号 / 错误提示 / 帮助文案
 *
 * 用法：
 *   <FormField label="金额" required :error="errors.amount" hint="单位：元">
 *     <input v-model="amount" type="number" />
 *   </FormField>
 */
withDefaults(defineProps<{
  label?: string
  required?: boolean
  error?: string
  hint?: string
  /** 控件与标签是否同一行（开关类） */
  inline?: boolean
}>(), {
  label: '',
  required: false,
  error: '',
  hint: '',
  inline: false,
})
</script>

<template>
  <div class="field" :class="{ inline, 'has-error': !!error }">
    <label v-if="label" class="field-label">
      {{ label }}
      <span v-if="required" class="field-required">*</span>
    </label>
    <div class="field-control">
      <slot />
    </div>
    <div v-if="error" class="field-error">{{ error }}</div>
    <div v-else-if="hint" class="field-hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 6px; }
.field.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.field-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-2);
}
.field-required { color: var(--color-error); margin-left: 2px; }
.field-control { display: flex; flex-direction: column; }
.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  line-height: 1.4;
}
.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  line-height: 1.4;
}
/* 控件默认样式：页面里直接放 input/select/textarea 即可获得一致的观感 */
.field-control :deep(input:not([type='checkbox']):not([type='radio'])),
.field-control :deep(select),
.field-control :deep(textarea) {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-body);
  font-family: inherit;
  outline: none;
  transition: border-color var(--dur-fast);
}
.field-control :deep(textarea) { min-height: 88px; resize: vertical; }
.field-control :deep(input:not([type='checkbox']):not([type='radio']):focus),
.field-control :deep(select:focus),
.field-control :deep(textarea:focus) {
  border-color: var(--color-accent);
}
.field.has-error .field-control :deep(input:not([type='checkbox']):not([type='radio'])),
.field.has-error .field-control :deep(select),
.field.has-error .field-control :deep(textarea) {
  border-color: var(--color-error);
}
</style>
