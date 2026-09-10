<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { CompanyClassStat } from '@/api/company'

interface CompanySummary {
  total: number
  on_leave: number
  present: number
  currently_leave: number
  not_returned: number
}

defineProps<{ summary: CompanySummary; classes: CompanyClassStat[] }>()

const router = useRouter()
</script>

<template>
  <template v-if="summary">
    <div class="section-title">
      中队概览
      <span class="matrix-badge">{{ summary.present }} 人在队</span>
      <span v-if="summary.on_leave > 0" class="matrix-badge warn">{{ summary.on_leave }} 人请假</span>
      <span class="matrix-link" @click="router.push('/pages/company/index')">查看详情 ›</span>
    </div>
    <div class="company-strip">
      <div v-for="c in classes" :key="c.class_id" class="company-item">
        <div class="company-name">{{ c.class_name }}</div>
        <div class="company-stat"><b>{{ c.present }}</b> / {{ c.member_count }} 出勤</div>
        <div class="company-sub">请假 {{ c.on_leave }}<span v-if="c.not_returned"> · 未销假 {{ c.not_returned }}</span></div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

.matrix-badge {
  font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 10px;
  background: var(--color-warning-bg); color: var(--color-warning);
  margin-left: 8px; vertical-align: middle;
}
.matrix-badge.warn { background: var(--color-warning-bg); color: var(--color-warning); }

.matrix-link {
  font-size: 12px; color: var(--color-accent); cursor: pointer;
  margin-left: auto; font-weight: 400; white-space: nowrap;
}

.company-strip { display: flex; gap: 8px; overflow-x: auto; padding: 0 12px 4px; }
.company-item {
  flex: 0 0 auto; min-width: 132px;
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 10px 12px;
}
.company-name { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; white-space: nowrap; }
.company-stat { font-size: 12px; color: var(--color-text-2); }
.company-stat b { font-size: 16px; color: var(--color-accent); }
.company-sub { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
</style>
