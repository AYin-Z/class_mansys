<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  title?: string
  showBack?: boolean
}>()

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <div class="nav-bar">
    <div v-if="showBack" class="nav-btn" @click="goBack">‹</div>
    <div v-else class="nav-btn-placeholder"></div>
    <div class="nav-title">{{ title || '' }}</div>
    <div class="nav-btn-placeholder"></div>
  </div>
</template>

<style scoped>
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.3s, border-color 0.3s;
}
.nav-btn, .nav-btn-placeholder {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--color-text-2);
  cursor: pointer;
  border-radius: 8px;
  flex-shrink: 0;
}
.nav-btn:active { background: var(--color-surface-hover); }
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
