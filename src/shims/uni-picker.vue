<template>
  <div class="uni-picker-wrapper">
    <!-- 透明原生控件叠在样式层上方，点击触发选择器 -->
    <select
      v-if="mode === 'selector'"
      ref="nativeEl"
      class="uni-picker-native"
      :value="resolvedIndex"
      @change="onSelectChange"
    >
      <option v-for="(opt, i) in normalizedRange" :key="i" :value="i">
        {{ resolveLabel(opt) }}
      </option>
    </select>
    <input
      v-else
      ref="nativeEl"
      class="uni-picker-native"
      :type="mode === 'date' ? 'date' : 'time'"
      :value="value"
      @input="onInputChange"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  mode?: string
  range?: any[]
  value?: any
  rangeKey?: string
}>()

const emit = defineEmits<{
  (e: 'change', detail: { detail: { value: any } }): void
}>()

const nativeEl = ref<HTMLSelectElement | HTMLInputElement | null>(null)

const normalizedRange = computed(() => props.range || [])
const resolvedIndex = computed(() => props.value ?? 0)

function resolveLabel(opt: any): string {
  if (props.rangeKey && opt && typeof opt === 'object') return opt[props.rangeKey]
  return String(opt ?? '')
}

function onSelectChange() {
  const el = nativeEl.value as HTMLSelectElement | null
  if (!el) return
  emit('change', { detail: { value: parseInt(el.value, 10) } })
}

function onInputChange() {
  const el = nativeEl.value as HTMLInputElement | null
  if (!el) return
  emit('change', { detail: { value: el.value } })
}
</script>

<style scoped>
.uni-picker-wrapper {
  position: relative;
  cursor: pointer;
}
.uni-picker-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}
</style>
