<template>
  <view class="leave-page">
    <custom-nav-bar title="请假销假" />

    <scroll-view scroll-y class="main-scroll">
      <view class="hero-strip">
        <text class="hero-kicker">区队事务</text>
        <text class="hero-title">请假与销假</text>
        <text class="hero-sub">记录与审批状态与后台实时同步</text>
      </view>

      <view class="stats-row">
        <view class="stat-card">
          <text class="stat-num">{{ stats.pending }}</text>
          <text class="stat-label">待审批</text>
        </view>
        <view class="stat-card accent">
          <text class="stat-num">{{ stats.approved }}</text>
          <text class="stat-label">已通过</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ stats.rejected }}</text>
          <text class="stat-label">已驳回</text>
        </view>
      </view>

      <view class="action-bar">
        <navigator url="/pages/leave/apply" class="action-btn primary">
          <text class="action-icon">＋</text>
          <text class="action-text">申请请假</text>
        </navigator>
        <navigator url="/pages/leave/cancel" class="action-btn secondary" v-if="hasActiveLeave">
          <text class="action-icon">✓</text>
          <text class="action-text">销假</text>
        </navigator>
      </view>

      <view class="section-header">
        <text class="section-title">请假记录</text>
        <text class="count-badge">{{ leaveList.length }} 条</text>
      </view>

      <view class="leave-list">
        <view v-for="item in leaveList" :key="item.id" class="leave-card" @tap="goDetail(item)">
          <view class="card-accent" :class="statusClass(item)"></view>
          <view class="card-body">
            <view class="card-top">
              <text class="leave-type">{{ leaveTypeLabel(item) }}</text>
              <view :class="['status-badge', statusClass(item)]">
                {{ statusLabel(item) }}
              </view>
            </view>
            <text class="leave-reason">{{ item.reason || '—' }}</text>
            <view class="card-meta">
              <text class="meta-text">{{ formatLeaveDateTime(item.start_time) }} ~ {{ formatLeaveDateTime(item.end_time) }}</text>
            </view>
          </view>
        </view>

        <view v-if="leaveList.length === 0" class="empty-state">
          <text class="empty-icon">📋</text>
          <text class="empty-text">暂无请假记录</text>
          <text class="empty-hint">登录并提交申请后将在此展示</text>
        </view>
      </view>

      <view class="admin-entry" @tap="goOverview">
        <view class="admin-icon-wrap">
          <text class="admin-icon">📋</text>
        </view>
        <view class="admin-info">
          <text class="admin-title">今日请假一览</text>
          <text class="admin-desc">查看当天各类请假情况</text>
        </view>
        <text class="admin-arrow">›</text>
      </view>

      <view class="admin-entry" v-if="isAdmin" @tap="goApprove">
        <view class="admin-icon-wrap">
          <text class="admin-icon">◎</text>
        </view>
        <view class="admin-info">
          <text class="admin-title">审批管理</text>
          <text class="admin-desc">{{ pendingCount }} 条待处理</text>
        </view>
        <text class="admin-arrow">›</text>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>
    <custom-tab-bar current="leave" />
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isAdmin as checkAdmin, canApproveLeave } from '@/utils/auth.js'
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
    uni.showToast({ title: '无审批权限', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/leave/approve' })
}

function goOverview() {
  uni.navigateTo({ url: '/pages/leave/overview' })
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
    uni.showToast({ title: '获取数据失败', icon: 'none' })
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
@import "@/uni.scss";
.leave-page {
  min-height: 100vh;
  background: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
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
