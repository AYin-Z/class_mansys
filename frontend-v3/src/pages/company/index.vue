<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import {
  getCompanyOverview,
  getCompanyLeaveRecords,
  type CompanyClassStat,
  type CompanyLeaveRecord,
} from '@/api/company'

function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
const date = ref<string>(todayLocal())
const loading = ref(true)
const classes = ref<CompanyClassStat[]>([])
const records = ref<CompanyLeaveRecord[]>([])
const summary = ref({ total: 0, on_leave: 0, present: 0, currently_leave: 0, not_returned: 0 })
const error = ref('')

const totalClasses = computed(() => classes.value.length)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ovRes, recRes] = await Promise.allSettled([
      getCompanyOverview(date.value),
      getCompanyLeaveRecords(date.value),
    ])
    if (ovRes.status === 'fulfilled' && ovRes.value?.success) {
      classes.value = ovRes.value.classes || []
      summary.value = ovRes.value.summary || summary.value
    } else {
      const reason = ovRes.status === 'rejected' ? (ovRes.reason?.message || '') : ''
      error.value = reason || '暂无中队数据或权限不足（请确认本区队已归属中队）'
    }
    if (recRes.status === 'fulfilled' && recRes.value?.success) {
      records.value = recRes.value.records || []
    } else {
      records.value = []
    }
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function onDateChange() {
  if (date.value) load()
}

function fmtTime(t: string) {
  if (!t) return ''
  return t.replace('T', ' ').split('.')[0].slice(0, 16)
}


onMounted(load)
</script>

<template>
  <div class="company-page">
    <NavBar title="中队总览" />

    <div class="toolbar">
      <input v-model="date" type="date" class="date-input" @change="onDateChange" />
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ summary.total }}</div>
        <div class="stat-label">在队人数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary.present }}</div>
        <div class="stat-label">出勤</div>
      </div>
      <div class="stat-card leave">
        <div class="stat-value">{{ summary.on_leave }}</div>
        <div class="stat-label">请假</div>
      </div>
      <div class="stat-card warn">
        <div class="stat-value">{{ summary.not_returned }}</div>
        <div class="stat-label">未销假</div>
      </div>
    </div>

    <div class="meta">共 {{ totalClasses }} 个区队</div>

    <div v-if="loading" class="state">加载中...</div>
    <div v-else-if="error" class="state error">{{ error }}</div>

    <template v-else>
      <!-- 各区队出勤 -->
      <div class="section-title">各区队出勤</div>
      <div class="class-list">
        <div v-for="c in classes" :key="c.class_id" class="class-card">
          <div class="class-head">
            <span class="class-name">{{ c.class_name }}</span>
            <span class="class-stat">{{ c.on_leave }} / {{ c.member_count }}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" :style="{ width: (c.member_count ? (c.present / c.member_count) * 100 : 0) + '%' }"></div>
          </div>
          <div class="class-foot">
            <span>出勤 {{ c.present }}</span>
            <span>请假 {{ c.on_leave }}</span>
            <span>当前在假 {{ c.currently_leave }}</span>
            <span v-if="c.not_returned">未销假 {{ c.not_returned }}</span>
          </div>
        </div>
      </div>

      <!-- 当天请假明细 -->
      <div class="section-title">当日请假明细</div>
      <div v-if="records.length === 0" class="state">今日无请假</div>
      <div v-else class="record-list">
        <div v-for="r in records" :key="r.id" class="record-card">
          <div class="record-main">
            <span class="record-name">{{ r.user_name }}</span>
            <span class="record-class">{{ r.class_name || r.class_id }}</span>
          </div>
          <div class="record-sub">
            <span>{{ r.leave_type }}</span>
            <span>{{ fmtTime(r.start_time) }} ~ {{ fmtTime(r.end_time) }}</span>
          </div>
          <div class="record-reason">{{ r.reason }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.company-page { padding-bottom: 80px; min-height: 100vh; background: var(--color-bg); }
.toolbar { padding: 12px 16px; }
.date-input {
  width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
}
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 16px; }
.stat-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 14px 12px;
  box-shadow: var(--shadow-card); text-align: center;
}
.stat-card .stat-value { font-size: 24px; font-weight: 700; color: var(--color-primary); }
.stat-card.leave .stat-value { color: var(--color-warn, #e65100); }
.stat-card.warn .stat-value { color: var(--color-error, #d32f2f); }
.stat-card .stat-label { font-size: 12px; color: var(--color-text-3); margin-top: 4px; }
.meta { padding: 12px 16px 4px; font-size: 12px; color: var(--color-text-3); }
.state { text-align: center; padding: 40px 16px; color: var(--color-text-3); font-size: 14px; }
.state.error { color: var(--color-error); }
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text-2); padding: 14px 16px 8px; }
.class-list { padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }
.class-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.class-head { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.class-stat { color: var(--color-text-2); font-weight: 500; }
.bar { height: 6px; background: var(--color-surface-hover, #e8e8e8); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--color-accent, #1a73e8); border-radius: 3px; }
.class-foot { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--color-text-3); margin-top: 8px; }
.record-list { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
.record-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 12px 14px;
  box-shadow: var(--shadow-card);
}
.record-main { display: flex; justify-content: space-between; font-size: 14px; color: var(--color-text); }
.record-class { font-size: 12px; color: var(--color-text-3); }
.record-sub { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-2); margin-top: 4px; }
.record-reason { font-size: 13px; color: var(--color-text-2); margin-top: 6px; word-break: break-word; }
</style>
