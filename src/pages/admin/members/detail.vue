<template>
  <div class="detail-page">
    <div class="header-section">
      <div class="brand-bar"></div>
      <div class="header-content">
        <span class="title">成员详情</span>
        <span class="subtitle" v-if="user">{{ user.name }} · 学号 {{ user.student_id }}</span>
      </div>
    </div>

    <div scroll-y class="content-scroll" v-if="user">
      <!-- 基础信息卡 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">基本信息</span>
          <span class="role-tag">{{ roleLabel(user.role) }}</span>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">班级</span>
            <span class="info-value">{{ user.class_name || user.class_id || '未分班' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">性别</span>
            <span class="info-value">{{ user.gender === 2 ? '女' : (user.gender === 1 ? '男' : '未填') }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">手机</span>
            <span class="info-value">{{ user.phone || '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">邮箱</span>
            <span class="info-value">{{ user.email || '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">注册时间</span>
            <span class="info-value">{{ formatDate(user.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- 当前请假状态 -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">请假状态</span>
          <span
            :class="['status-chip', activeLeave ? 'chip-warn' : 'chip-ok']"
          >{{ activeLeave ? '请假中' : '在岗' }}</span>
        </div>
        <div v-if="activeLeave" class="active-leave">
          <div class="leave-row">
            <span class="muted">类型</span><span class="strong">{{ activeLeave.leave_type }}</span>
          </div>
          <div class="leave-row">
            <span class="muted">起止</span>
            <span>{{ formatDateTime(activeLeave.start_time) }} → {{ formatDateTime(activeLeave.end_time) }}</span>
          </div>
          <div class="leave-row">
            <span class="muted">事由</span><span class="multi">{{ activeLeave.reason }}</span>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-item"><span class="stat-num">{{ stats?.leave_count ?? 0 }}</span><span class="stat-label">请假总数</span></div>
          <div class="stat-item"><span class="stat-num">{{ stats?.approved_leave_count ?? 0 }}</span><span class="stat-label">已通过</span></div>
          <div class="stat-item"><span class="stat-num">{{ stats?.pending_leave_count ?? 0 }}</span><span class="stat-label">待审批</span></div>
          <div class="stat-item"><span class="stat-num">{{ stats?.total_points ?? 0 }}</span><span class="stat-label">积分</span></div>
        </div>
      </div>

      <!-- 最近请假 -->
      <div class="card">
        <span class="card-title">最近请假</span>
        <div v-if="!leaves.length" class="empty-inline"><span>暂无请假记录</span></div>
        <div v-for="l in leaves" :key="l.id" class="leave-card">
          <div class="leave-top">
            <span class="leave-type">{{ l.leave_type }}</span>
            <span :class="['leave-status', statusClass(l)]">{{ leaveStatusText(l) }}</span>
          </div>
          <span class="leave-range">{{ formatDateTime(l.start_time) }} → {{ formatDateTime(l.end_time) }}</span>
          <span class="leave-reason">{{ l.reason }}</span>
          <span v-if="l.approval_notes" class="leave-notes">审批意见：{{ l.approval_notes }}</span>
        </div>
      </div>

      <!-- 近期操作 -->
      <div class="card">
        <span class="card-title">近期系统内操作</span>
        <div v-if="!operations.length" class="empty-inline"><span>暂无操作记录</span></div>
        <div v-for="op in operations" :key="op.id" class="op-row">
          <div class="op-time">{{ formatDateTime(op.created_at) }}</div>
          <div class="op-body">
            <div class="op-action-row">
              <span class="op-method">{{ op.method || '-' }}</span>
              <span class="op-action">{{ op.action }}</span>
              <span :class="['op-status', (op.status_code || 0) >= 400 ? 'bad' : 'good']">{{ op.status_code || '—' }}</span>
            </div>
            <span class="op-path">{{ op.path }}</span>
            <span v-if="opDetail(op)" class="op-detail">{{ opDetail(op) }}</span>
          </div>
        </div>
      </div>

      <div style="height:40rpx"></div>
    </div>

    <div v-else class="loading-state">
      <span>{{ loading ? '加载中…' : '成员不存在' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getMemberDetail } from '@/api/admin'
import { getRoleLabel } from '@/constants/roles'
const memberId = ref(null)
const user = ref(null)
const activeLeave = ref(null)
const leaves = ref([])
const operations = ref([])
const stats = ref(null)
const loading = ref(true)

function roleLabel(r) { return getRoleLabel(r) }

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso); if (isNaN(d.getTime())) return String(iso).slice(0, 10)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso); if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T',' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function leaveStatusText(l) {
  if (l.is_cancelled) return '已销假'
  switch (Number(l.status)) {
    case 1: return '已通过'
    case 2: return '已驳回'
    default: return '待审批'
  }
}
function statusClass(l) {
  if (l.is_cancelled) return 'neutral'
  const s = Number(l.status)
  if (s === 1) return 'ok'
  if (s === 2) return 'bad'
  return 'pending'
}

function opDetail(op) {
  if (!op.detail) return ''
  try {
    const obj = typeof op.detail === 'string' ? JSON.parse(op.detail) : op.detail
    if (obj?.error) return `失败：${obj.error}`
    if (obj?.body) {
      // 简短展示请求体若干关键字段
      const keys = Object.keys(obj.body).slice(0, 4)
      return keys.map(k => `${k}=${stringifyShort(obj.body[k])}`).join(' · ')
    }
    return ''
  } catch {
    return String(op.detail).slice(0, 120)
  }
}
function stringifyShort(v) {
  if (v == null) return 'null'
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

async function load() {
  loading.value = true
  try {
    const res = await getMemberDetail(memberId.value)
    if (res?.success) {
      user.value = res.user
      activeLeave.value = res.active_leave || null
      leaves.value = res.leaves || []
      operations.value = res.operations || []
      stats.value = res.stats || null
    }
  } catch (e) {
    console.error('成员详情加载失败:', e)
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  memberId.value = options?.id
})
onMounted(() => { if (memberId.value) load() })

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.detail-page {
  min-height: 100vh;
  background: $surface;
  display: flex;
  flex-direction: column;
}

.header-section {
  position: relative;
  padding: 48rpx 32rpx 32rpx;
  background: linear-gradient(135deg, $primary 0%, $primary-container 100%);
}
.brand-bar {
  position: absolute; left:0; top:0; bottom:0; width:12rpx;
  background: rgba(255,255,255,0.15);
}
.header-content { display:flex; flex-direction:column; gap:8rpx; }
.title { font-size: 44rpx; font-weight: 700; color: #fff; }
.subtitle { font-size: 24rpx; color: rgba(255,255,255,0.7); }

.content-scroll { flex:1; padding: 24rpx 32rpx; }

.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #191c1e;
}

.role-tag {
  padding: 4rpx 16rpx;
  background: rgba(0, 30, 64, 0.06);
  color: #001e40;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx 24rpx;
}
.info-item { min-width: 40%; display: flex; flex-direction: column; gap: 4rpx; }
.info-label { font-size: 22rpx; color: #8c909a; }
.info-value { font-size: 26rpx; color: #191c1e; font-weight: 500; }

.status-chip {
  padding: 4rpx 18rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}
.chip-ok { background: rgba(52,168,83,0.1); color: #1f7a3b; }
.chip-warn { background: rgba(231,147,23,0.15); color: #b05e00; }

.active-leave {
  background: rgba(231,147,23,0.06);
  border-left: 6rpx solid #b05e00;
  border-radius: 12rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.leave-row { display: flex; gap: 14rpx; font-size: 24rpx; }
.leave-row .muted { min-width: 72rpx; color: #8c909a; }
.leave-row .strong { font-weight: 600; color: $on-surface; }
.leave-row .multi { flex:1; }

.stats-row {
  display: flex;
  gap: 16rpx;
  padding-top: 8rpx;
}
.stat-item {
  flex: 1;
  background: $surface;
  border-radius: 16rpx;
  padding: 16rpx 8rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.stat-num { font-size: 34rpx; font-weight: 700; color: $primary; }
.stat-label { font-size: 22rpx; color: #8c909a; }

.leave-card {
  background: $surface;
  border-radius: 16rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.leave-top { display: flex; justify-content: space-between; align-items: center; }
.leave-type { font-size: 26rpx; font-weight: 600; color: $on-surface; }
.leave-status {
  padding: 2rpx 14rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}
.leave-status.ok { background: rgba(52,168,83,0.1); color: #1f7a3b; }
.leave-status.bad { background: rgba(220, 53, 69, 0.1); color: #b42318; }
.leave-status.pending { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; }
.leave-status.neutral { background: #e8ebf3; color: #5c6270; }

.leave-range { font-size: 22rpx; color: #8c909a; }
.leave-reason { font-size: 24rpx; color: $on-surface; }
.leave-notes { font-size: 22rpx; color: #5c6270; font-style: italic; }

.op-row {
  display: flex;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(195, 198, 209, 0.3);

  &:last-child { border-bottom: none; }
}
.op-time {
  min-width: 180rpx;
  font-size: 22rpx;
  color: #8c909a;
}
.op-body { flex:1; display:flex; flex-direction:column; gap: 6rpx; min-width:0; }
.op-action-row { display:flex; align-items:center; gap: 12rpx; }
.op-method {
  font-size: 20rpx;
  font-weight: 700;
  padding: 2rpx 10rpx;
  background: rgba($primary, 0.08);
  color: $primary;
  border-radius: 10rpx;
}
.op-action { font-size: 26rpx; font-weight: 600; color: $on-surface; }
.op-status {
  margin-left: auto;
  font-size: 22rpx;
  padding: 2rpx 10rpx;
  border-radius: 10rpx;
}
.op-status.good { color: #1f7a3b; background: rgba(52,168,83,0.08); }
.op-status.bad  { color: #b42318; background: rgba(220, 53, 69, 0.08); }

.op-path { font-size: 22rpx; color: #5c6270; word-break: break-all; }
.op-detail { font-size: 22rpx; color: #8c909a; word-break: break-all; }

.empty-inline { text-align:center; padding: 24rpx 0; color: #8c909a; font-size: 24rpx; }

.loading-state { flex:1; display:flex; align-items:center; justify-content:center; color: #8c909a; }
</style>
