<script setup lang="ts">
import { useRouter } from 'vue-router'

interface PendingItem {
  count: string | number
  label: string
  path: string
}

defineProps<{ items: PendingItem[] }>()

const router = useRouter()
</script>

<template>
  <div class="pending-row">
    <div v-for="item in items" :key="item.label" class="pending-item" @click="router.push(item.path)">
      <span class="count">{{ item.count }}</span>
      <span class="label">{{ item.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.pending-row {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  padding: 0 12px; margin-bottom: 4px;
}
@media (min-width: 480px) { .pending-row { grid-template-columns: repeat(4, 1fr); } }
.pending-item {
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 16px 6px; text-align: center;
  cursor: pointer;
}
.pending-item .count { font-size: 24px; font-weight: 700; color: var(--color-accent); display: block; }
.pending-item .label { font-size: 11px; color: var(--color-text-2); margin-top: 4px; display: block; }
</style>
