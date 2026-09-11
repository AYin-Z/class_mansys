<script setup lang="ts">
/**
 * 中队总览（区队视角）
 *
 * 2026-09（体验修复）：
 *  - 错误态此前是内部语言「暂无中队数据或权限不足（请确认本区队已归属中队）」且没有重试，
 *    改为「没有查到本区队的中队归属 / 请联系管理员配置」+ StateView 重试。
 *  - 请假明细加载失败此前被渲染成「今日无请假」（把失败当业务事实）→ 独立错误态 + 重试。
 *  - 底部避让交给 App.vue；var(--color-warn/--color-*) 兜底色值收敛到令牌。
 */
import { ref, onMounted, computed } from 'vue'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import {
  getCompanyOverview,
  getCompanyLeaveRecords,
  type CompanyClassStat,
  type CompanyLeaveRecord,
} from '@/api/company'

/** 业务上最常见的原因：本区队未归属中队（或权限矩阵未配置 VIEW_COMPANY） */
const NO_COMPANY_MSG = '没有查到本区队的中队归属，请联系管理员配置'

function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
const date = ref<string>(todayLocal())
const loading = ref(true)
const error = ref<unknown>(null)
const classes = ref<CompanyClassStat[]>([])
const records = ref<CompanyLeaveRecord[]>([])
const recordsLoading = ref(false)
const recordsError = ref<unknown>(null)
const summary = ref({ total: 0, on_leave: 0, present: 0, currently_leave: 0, not_returned: 0 })

const totalClasses = computed(() => classes.value.length)
/** 是否仍停留在「今天」（用于区分「当日无请假」与「换日期筛选后无结果」） */
const isToday = computed(() => date.value === todayLocal())

async function load() {
  loading.value = true
  error.value = null
  recordsLoading.value = true
  recordsError.value = null
  const [ovRes, recRes] = await Promise.allSettled([
    getCompanyOverview(date.value),
    getCompanyLeaveRecords(date.value),
  ])

  if (ovRes.status === 'fulfilled' && ovRes.value?.success) {
    classes.value = ovRes.value.classes || []
    summary.value = ovRes.value.summary || summary.value
  } else {
    // 失败就是失败：不能渲染成「数据为 0」或空态
    classes.value = []
    error.value = ovRes.status === 'rejected'
      ? (ovRes.reason || new Error(NO_COMPANY_MSG))
      : new Error(NO_COMPANY_MSG)
  }

  if (recRes.status === 'fulfilled' && recRes.value?.success) {
    records.value = recRes.value.records || []
  } else {
    records.value = []
    recordsError.value = recRes.status === 'rejected'
      ? (recRes.reason || new Error('加载当日请假明细失败，请稍后重试'))
      : new Error('加载当日请假明细失败，请稍后重试')
  }

  loading.value = false
  recordsLoading.value = false
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

    <StateView :loading="loading" :error="error" loading-text="正在加载中队数据…" @retry="load">
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

      <!-- 各区队出勤 -->
      <div class="section-title">各区队出勤</div>
      <EmptyState
        v-if="classes.length === 0"
        icon="users"
        title="还没有区队数据"
        description="本区队下暂无成员或尚未配置区队"
      />
      <div v-else class="class-list">
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
      <StateView
        slim
        :loading="recordsLoading"
        :error="recordsError"
        :empty="records.length === 0"
        empty-icon="clipboard"
        :empty-variant="isToday ? 'default' : 'filtered'"
        :empty-title="isToday ? '当日没有请假记录' : '该日期没有请假记录'"
        empty-description="可以换一个日期查看"
        @retry="load"
      >
        <div class="record-list">
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
      </StateView>
    </StateView>
  </div>
</template>

<style scoped>
.company-page { min-height: 100vh; background: var(--color-bg); }
.toolbar { padding: 12px 16px; }
.date-input {
  width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text);
  font-family: inherit; outline: none; box-sizing: border-box;
}
.date-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 16px; }
.stat-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 14px 8px;
  box-shadow: var(--shadow-card); text-align: center;
}
.stat-card .stat-value { font-size: 24px; font-weight: 700; color: var(--color-primary); }
.stat-card.leave .stat-value { color: var(--color-warning); }
.stat-card.warn .stat-value { color: var(--color-error); }
.stat-card .stat-label { font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 4px; }
.meta { padding: 12px 16px 4px; font-size: var(--font-size-xs); color: var(--color-text-3); }
.section-title {
  font-size: var(--font-size-body); font-weight: 600; color: var(--color-text-2);
  padding: 14px 16px 8px;
}
.class-list { padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }
.class-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.class-head { display: flex; justify-content: space-between; font-size: var(--font-size-body); font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.class-stat { color: var(--color-text-2); font-weight: 500; }
.bar { height: 6px; background: var(--color-surface-hover); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--color-accent); border-radius: 3px; }
.class-foot { display: flex; flex-wrap: wrap; gap: 12px; font-size: var(--font-size-xs); color: var(--color-text-3); margin-top: 8px; }
.record-list { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
.record-card {
  background: var(--color-surface); border-radius: var(--radius-md); padding: 12px 14px;
  box-shadow: var(--shadow-card);
}
.record-main { display: flex; justify-content: space-between; font-size: var(--font-size-body); color: var(--color-text); }
.record-class { font-size: var(--font-size-xs); color: var(--color-text-3); }
.record-sub { display: flex; gap: 12px; font-size: var(--font-size-xs); color: var(--color-text-2); margin-top: 4px; }
.record-reason { font-size: var(--font-size-sm); color: var(--color-text-2); margin-top: 6px; word-break: break-word; }
</style>
