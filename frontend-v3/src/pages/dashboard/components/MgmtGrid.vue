<script setup lang="ts">
import { useRouter } from 'vue-router'

interface MgmtItem {
  icon: string
  label: string
  path: string
  badge?: boolean | (() => number)
  desc?: string
}

interface MgmtGroup {
  name: string
  items: MgmtItem[]
}

defineProps<{ groups: MgmtGroup[] }>()

const router = useRouter()
</script>

<template>
  <div class="section-title">管理功能</div>
  <div class="mgmt-section">
    <div v-for="group in groups" :key="group.name" class="mgmt-group">
      <div class="mgmt-group-title">{{ group.name }}</div>
      <div class="mgmt-grid">
        <div v-for="item in group.items" :key="item.label" class="mgmt-card" @click="router.push(item.path)">
          <div class="mgmt-icon">{{ item.icon }}</div>
          <div class="mgmt-info">
            <div class="mgmt-label">{{ item.label }}</div>
            <div class="mgmt-desc">{{ item.desc }}</div>
          </div>
          <div class="mgmt-arrow">›</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

.mgmt-section { padding: 0 12px; }
.mgmt-group { margin-bottom: 8px; }
.mgmt-group-title {
  font-size: 11px; font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 4px 4px 6px;
}
.mgmt-grid { display: grid; grid-template-columns: 1fr; gap: 6px; }
@media (min-width: 768px) { .mgmt-grid { grid-template-columns: 1fr 1fr; } }
.mgmt-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 14px 16px;
  cursor: pointer; transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.mgmt-card:active { background: var(--color-surface-hover); }
.mgmt-icon { font-size: 22px; flex-shrink: 0; width: 36px; text-align: center; }
.mgmt-info { flex: 1; min-width: 0; }
.mgmt-label { font-size: 14px; font-weight: 600; color: var(--color-text); }
.mgmt-desc { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
.mgmt-arrow { font-size: 18px; color: var(--color-text-3); flex-shrink: 0; }
</style>
