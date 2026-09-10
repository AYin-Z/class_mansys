<script setup lang="ts">
import PendingRow from './PendingRow.vue'

interface PendingItem {
  count: string | number
  label: string
  path: string
}

defineProps<{ items: PendingItem[] }>()
</script>

<template>
  <div class="section-title">我的概况</div>
  <PendingRow :items="items" />
</template>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }
</style>
