<template>
  <div class="leave-page">
    <custom-nav-bar title="请假销假" />

    <div scroll-y class="main-scroll">
      <div class="hero-strip">
        <span class="hero-kicker">区队事务</span>
        <span class="hero-title">请假与销假</span>
        <span class="hero-sub">记录与审批状态与后台实时同步</span>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-num">{{ stats.pending }}</span>
          <span class="stat-label">待审批</span>
        </div>
        <div class="stat-card accent">
          <span class="stat-num">{{ stats.approved }}</span>
          <span class="stat-label">已通过</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.rejected }}</span>
          <span class="stat-label">已驳回</span>
        </div>
      </div>

      <div class="action-bar">
        <router-link to="/pages/leave/apply" class="action-btn primary">
          <span class="action-icon">＋</span>
          <span class="action-text">申请请假</span>
        </router-link>
        <router-link to="/pages/leave/cancel" class="action-btn secondary" v-if="hasActiveLeave">
          <span class="action-icon">✓</span>
          <span class="action-text">销假</span>
        </router-link>
      </div>

      <div class="section-header">
        <span class="section-title">请假记录</span>
        <span class="count-badge">{{ leaveList.length }} 条</span>
      </div>

      <div class="leave-list">
        <div v-for="item in leaveList" :key="item.id" class="leave-card" @tap="goDetail(item)">
          <div class="card-accent" :class="statusClass(item)"></div>
          <div class="card-body">
            <div class="card-top">
              <span class="leave-type">{{ leaveTypeLabel(item) }}</span>
              <div :class="['status-badge', statusClass(item)]">
                {{ statusLabel(item) }}
              </div>
            </div>
            <span class="leave-reason">{{ item.reason || '—' }}</span>
            <div class="card-meta">
              <span class="meta-text">{{ formatLeaveDateTime(item.start_time) }} ~ {{ formatLeaveDateTime(item.end_time) }}</span>
            </div>
          </div>
        </div>

        <div v-if="leaveList.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <span class="empty-text">暂无请假记录</span>
          <span class="empty-hint">登录并提交申请后将在此展示</span>
        </div>
      </div>

      <div class="admin-entry" @tap="goOverview">
        <div class="admin-icon-wrap">
          <span class="admin-icon">📋</span>
        </div>
        <div class="admin-info">
          <span class="admin-title">今日请假一览</span>
          <span class="admin-desc">查看当天各类请假情况</span>
        </div>
        <span class="admin-arrow">›</span>
      </div>

      <div class="admin-entry" v-if="isAdmin" @tap="goApprove">
        <div class="admin-icon-wrap">
          <span class="admin-icon">◎</span>
        </div>
        <div class="admin-info">
          <span class="admin-title">审批管理</span>
          <span class="admin-desc">{{ pendingCount }} 条待处理</span>
        </div>
        <span class="admin-arrow">›</span>
      </div>

      <div class="page-spacer"></div>
    </div>
    <custom-tab-bar current="leave" />
  </div>
</template>

<script setup lang="ts">


import { onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isAdmin as checkAdmin, canApproveLeave } from '@/utils/auth'
import { getMyLeaves, getAllLeaves } from '@/api/leave'
import { hasBackendToken } from '@/utils/request'
import { formatLeaveDateTime } from '@/utils/index'
const isAdmin = ref(false)
const hasActiveLeave = ref(false)
const pendingCount = ref(0)
const loading = ref(false)

const stats = ref({
  pending: 0,
  approved: 0,
  rejected: 0
})

const leaveList = ref([])

function leaveTypeLabel(item) {
  return item.leave_type || item.type || '—'
}

function isLeaveCancelled(item) {
  return item.is_cancelled === 1 || item.is_cancelled === true
}

function statusClass(item) {
  if (isLeaveCancelled(item)) return 'cancelled'
  if (item.status === 0) return 'pending'
  if (item.status === 1) return 'approved'
  return 'rejected'
}

function statusLabel(item) {
  if (isLeaveCancelled(item)) return '已销假'
  if (item.status === 0) return '待审批'
  if (item.status === 1) return '已通过'
  return '已驳回'
}

function goDetail(item) {
  uni.navigateTo({ url: `/pages/leave/detail?id=${item.id}` })
}

function goApprove() {
  if (!canApproveLeave()) {
    showToast('无审批权限')
    return
  }
  router.push('/pages/leave/approve')
}

function goOverview() {
  router.push('/pages/leave/overview')
}

function recomputeStats(leaves) {
  stats.value.pending = leaves.filter((l) => l.status === 0).length
  stats.value.approved = leaves.filter((l) => l.status === 1).length
  stats.value.rejected = leaves.filter((l) => l.status === 2).length
  pendingCount.value = stats.value.pending
}

async function fetchLeaveData() {
  if (!hasBackendToken()) {
    leaveList.value = []
    recomputeStats([])
    return
  }

  loading.value = true
  try {
    if (isAdmin.value) {
      const res = await getAllLeaves()
      if (res.success) {
        leaveList.value = res.leaves || []
        recomputeStats(leaveList.value)
      }
    } else {
      const res = await getMyLeaves()
      if (res.success) {
        const leaves = res.leaves || []
        leaveList.value = leaves
        recomputeStats(leaves)
        hasActiveLeave.value = leaves.some((l) => l.status === 1 && !isLeaveCancelled(l))
      }
    }
  } catch (error) {
    console.error('获取请假数据失败:', error)
    showToast('获取数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  isAdmin.value = checkAdmin()
  fetchLeaveData()
})

onShow(() => {
  fetchLeaveData()
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.leave-page {
  min-height: 100vh;
  background: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.hero-strip {
  margin: 16rpx 32rpx 24rpx;
  padding: 32rpx 28rpx 28rpx;
  background: $gradient-primary;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(0, 30, 64, 0.22);
}

.hero-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 6rpx;
  text-transform: uppercase;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: $on-primary;
  letter-spacing: 2rpx;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.45;
}

.stats-row {
  display: flex;
  gap: 16rpx;
  padding: 0 32rpx 24rpx;
}

.stat-card {
  flex: 1;
  background: $surface-container-lowest;
  border-radius: 20rpx;
  padding: 26rpx 16rpx;
  text-align: center;

  &.accent {
    background: $gradient-primary;

    .stat-num,
    .stat-label {
      color: $on-primary;
    }
  }
}

.stat-num {
  font-size: 44rpx;
  font-weight: 700;
  color: $primary;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: $on-surface-variant;
  margin-top: 6rpx;
  display: block;
}

.action-bar {
  display: flex;
  gap: 16rpx;
  padding: 0 32rpx;
  margin-bottom: 28rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 88rpx;
  border-radius: 20rpx;

  &.primary {
    background: $gradient-primary;
    box-shadow: 0 10rpx 28rpx rgba(0, 30, 64, 0.22);

    .action-icon,
    .action-text {
      color: $on-primary;
    }
  }

  &.secondary {
    background: $surface-container-lowest;

    .action-icon,
    .action-text {
      color: $primary;
    }
  }
}

.action-icon {
  font-size: 30rpx;
  font-weight: 600;
}

.action-text {
  font-size: 28rpx;
  font-weight: 600;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $on-surface;
}

.count-badge {
  font-size: 22rpx;
  color: $outline-variant;
  font-weight: 500;
}

.leave-list {
  padding: 0 32rpx;
}

.leave-card {
  position: relative;
  display: flex;
  background: $surface-container-lowest;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 16rpx;

  &:active {
    opacity: 0.92;
  }
}

.card-accent {
  width: 10rpx;
  flex-shrink: 0;

  &.pending {
    background: $secondary;
  }
  &.approved {
    background: $primary;
  }
  &.rejected {
    background: #460002;
  }
  &.cancelled {
    background: $outline-variant;
  }
}

.card-body {
  flex: 1;
  padding: 24rpx;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.leave-type {
  font-size: 28rpx;
  font-weight: 700;
  color: $on-surface;
}

.status-badge {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;

  &.pending {
    background: rgba(70, 98, 112, 0.10);
    color: $secondary;
  }
  &.approved {
    background: rgba(0, 30, 64, 0.06);
    color: $primary;
  }
  &.rejected {
    background: rgba(70, 0, 2, 0.08);
    color: #460002;
  }
  &.cancelled {
    background: rgba(195, 198, 209, 0.20);
    color: $on-surface-variant;
  }
}

.leave-reason {
  font-size: 26rpx;
  color: $on-surface-variant;
  margin-bottom: 12rpx;
  display: block;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  gap: 16rpx;
}

.meta-text {
  font-size: 22rpx;
  color: $outline-variant;
}

.empty-state {
  padding: 80rpx 0;
  text-align: center;
}

.empty-icon {
  font-size: 64rpx;
  display: block;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 28rpx;
  color: $on-surface-variant;
  font-weight: 500;
}

.empty-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $outline-variant;
}

.admin-entry {
  margin: 32rpx 32rpx 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
  background: $surface-container-lowest;
  border-radius: 20rpx;

  &:active {
    opacity: 0.88;
  }
}

.admin-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  background: rgba(0, 30, 64, 0.06);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-icon {
  font-size: 32rpx;
  color: $primary;
}

.admin-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.admin-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $on-surface;
}

.admin-desc {
  font-size: 22rpx;
  color: $on-surface-variant;
}

.admin-arrow {
  font-size: 40rpx;
  color: $outline-variant;
}

.page-spacer {
  height: 48rpx;
}
</style>
