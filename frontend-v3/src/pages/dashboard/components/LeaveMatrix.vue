<script setup lang="ts">
import { useRouter } from 'vue-router'

interface MatrixCell {
  name: string
  student_id: string
  start: string
  end: string
  reason: string
}

interface MatrixGroup {
  cells: MatrixCell[]
  reasons: string[]
}

defineProps<{
  matrix: Record<string, MatrixGroup>
  leaveTypes: string[]
  activeLeaveTotal: number
  title: string
  linkText: string
  linkPath: string
}>()

const router = useRouter()
</script>

<template>
  <div class="section-title">
    {{ title }}
    <span v-if="activeLeaveTotal > 0" class="matrix-badge">{{ activeLeaveTotal }} 人离队</span>
    <span v-else class="matrix-badge empty">全员在队</span>
    <span class="matrix-link" @click="router.push(linkPath)">{{ linkText }}</span>
  </div>
  <div v-if="activeLeaveTotal === 0" class="matrix-empty">🎉 当前没有请假外出人员，全员在队</div>
  <div v-else class="matrix-card">
    <div v-for="type in leaveTypes" :key="type" class="matrix-row">
      <div class="matrix-type">{{ type }}<span class="type-count">{{ matrix[type].cells.length }}</span><span class="type-reasons">{{ matrix[type].reasons.join(" ") }}</span></div>
      <div class="matrix-cells">
        <div v-for="cell in matrix[type].cells" :key="cell.student_id + cell.start" class="matrix-cell">
          <span class="cell-name">{{ cell.name }} <span class="cell-sid">{{ cell.student_id }}</span></span>
          <span class="cell-time">{{ cell.start }} ~ {{ cell.end }}</span>
          <span class="cell-reason">{{ cell.reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

.matrix-badge {
  font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 10px;
  background: var(--color-warning-bg); color: var(--color-warning);
  margin-left: 8px; vertical-align: middle;
}
.matrix-badge.empty { background: var(--color-success-bg); color: var(--color-success); }

.matrix-link {
  font-size: 12px; color: var(--color-accent); cursor: pointer;
  margin-left: auto; font-weight: 400; white-space: nowrap;
}

.matrix-empty {
  text-align: center; padding: 16px; margin: 0 12px;
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); font-size: 14px; color: var(--color-text-3);
}

.matrix-card {
  margin: 0 12px; background: var(--color-surface);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
  overflow: hidden;
}

.matrix-row {
  display: flex; border-bottom: 1px solid var(--color-border);
}
.matrix-row:last-child { border-bottom: none; }

.matrix-type {
  width: 72px; flex-shrink: 0;
  padding: 12px 10px; font-size: 13px; font-weight: 700;
  color: var(--color-accent); background: var(--color-accent-bg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; word-break: keep-all; gap: 4px;
}
.type-count {
  font-size: 16px; font-weight: 800; color: var(--color-accent);
  line-height: 1;
}
.type-reasons {
  font-size: 9px; color: var(--color-text-3); line-height: 1.3;
  text-align: center; word-break: keep-all; margin-top: 2px;
}

.matrix-cells {
  flex: 1; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 6px;
}

.matrix-cell {
  background: var(--color-bg); border-radius: var(--radius-sm);
  padding: 6px 10px; display: flex; flex-direction: column; gap: 2px;
  border-left: 2px solid var(--color-warning);
}

.cell-name {
  font-size: 13px; font-weight: 600; color: var(--color-text);
}
.cell-sid {
  font-size: 10px; font-weight: 400; color: var(--color-text-3); margin-left: 2px;
}
.cell-time {
  font-size: 11px; color: var(--color-text-3); white-space: nowrap;
}
.cell-reason {
  font-size: 10px; color: var(--color-warning); font-weight: 500;
}
</style>
