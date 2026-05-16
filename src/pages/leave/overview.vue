<template>
  <div class="overview-page">
    <custom-nav-bar title="今日请假一览" :showBack="true" />

    <div class="date-banner">
      <span class="date-text">{{ todayLabel }}</span>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-text">加载中…</span>
    </div>

    <div v-else-if="groupedTypes.length === 0" class="empty-state">
      <span class="empty-icon">✅</span>
      <span class="empty-text">今日没有请假记录</span>
    </div>

    <div v-else class="main-scroll">
      <div v-for="group in groupedTypes" :key="group.type" class="type-section">
        <div class="type-header">
          <span class="type-name">{{ group.type }}</span>
          <span class="type-count">{{ group.list.length }} 人</span>
        </div>
        <div class="member-list">
          <div v-for="item in group.list" :key="item.id" class="member-item" @click="goDetail(item)">
            <span class="member-avatar">{{ (item.applicant_name || '?').slice(0, 1) }}</span>
            <div class="member-info">
              <span class="member-name">{{ item.applicant_name }}<span class="member-id"> · {{ item.applicant_student_id }}</span></span>
              <span class="member-reason">{{ item.reason || '—' }}</span>
            </div>
            <span :class="['status-tag', statusClass(item)]">{{ statusLabel(item) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { getAllLeaves } from '@/api/leave'
const loading = ref(true)
const leaves = ref([])

const todayLabel = computed(() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${y}年${m}月${day}日 周${w}`
})

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function coversToday(start, end) {
  // 请假跨度覆盖今天
  const s = new Date(start).setHours(0, 0, 0, 0)
  const e = new Date(end).setHours(23, 59, 59, 999)
  const today = new Date().setHours(0, 0, 0, 0)
  return s <= today && e >= today
}

function isActive(item) {
  if (item.is_cancelled === 1 || item.is_cancelled === true) return false
  return item.status === 1 // 已通过
}

function statusClass(item) {
  switch (item.status) {
    case 0: return 'pending'
    case 1: return 'approved'
    case 2: return 'rejected'
    default: return ''
  }
}

function statusLabel(item) {
  switch (item.status) {
    case 0: return '待审批'
    case 1: return '已通过'
    case 2: return '已驳回'
    default: return '—'
  }
}

const groupedTypes = computed(() => {
  const todayActive = leaves.value.filter(isActive).filter(l => coversToday(l.start_time, l.end_time))
  const groups = {}
  for (const item of todayActive) {
    const type = item.leave_type || '其他'
    if (!groups[type]) groups[type] = []
    groups[type].push(item)
  }
  // 排序：每种请假类型内按创建时间升序
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }
  // 按请假类型自定义排序（早操→早集合→午集合→晚自习→其他）
  const typeOrder = ['早操', '早集合', '午集合', '晚自习', '上课', '事假', '病假', '公假', '其他']
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = typeOrder.indexOf(a); const bi = typeOrder.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(([type, list]) => ({ type, list }))
})

function goDetail(item) {
  router.push(`/pages/leave/detail?id=${item.id}`)
}

onMounted(async () => {
  try {
    const res = await getAllLeaves()
    if (res?.success) leaves.value = res.leaves || []
  } catch (_) {}
  loading.value = false
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.overview-page {
  min-height: 100vh;
  background: $surface;
}
.date-banner {
  padding: 24px 32px 12px;
  text-align: center;
}
.date-text {
  font-size: 26px;
  color: #8c909a;
}
.loading-state, .empty-state {
  padding: 160px 0;
  text-align: center;
}
.empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.empty-text { font-size: 28px; color: #8c909a; }
.loading-text { font-size: 28px; color: #8c909a; }

.main-scroll {
  padding: 0 32px 40px;
}

.type-section {
  background: #ffffff;
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 24px;
}
.type-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: $primary;
}
.type-name {
  font-size: 28px;
  font-weight: 700;
  color: $on-primary;
}
.type-count {
  font-size: 22px;
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.12);
  padding: 4px 14px;
  border-radius: 20px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid $surface-container-low;
  cursor: pointer;
  &:active { background: $surface; }
  &:last-child { border-bottom: none; }
}
.member-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary, $primary-container);
  color: $on-primary;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.member-name {
  font-size: 26px;
  font-weight: 600;
  color: $on-surface;
}
.member-id {
  font-size: 22px;
  font-weight: 400;
  color: #8c909a;
}
.member-reason {
  font-size: 22px;
  color: $on-surface-variant;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-tag {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 22px;
  font-weight: 500;
  flex-shrink: 0;
}
.status-tag.approved {
  background: rgba(52,168,83,0.1);
  color: #1f7a3b;
}
.status-tag.pending {
  background: rgba(231,147,23,0.15);
  color: #b05e00;
}
.status-tag.rejected {
  background: rgba(215,58,73,0.1);
  color: #a11c2c;
}
</style>
