<template>
  <view class="leave-page">
    <custom-nav-bar title="请假销假" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Stats Overview -->
      <view class="stats-row">
        <view class="stat-card">
          <text class="stat-num">{{ stats.pending }}</text>
          <text class="stat-label">待审批</text>
        </view>
        <view class="stat-card active">
          <text class="stat-num">{{ stats.approved }}</text>
          <text class="stat-label">已通过</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{ stats.rejected }}</text>
          <text class="stat-label">已驳回</text>
        </view>
      </view>

      <!-- Action Buttons -->
      <view class="action-bar">
        <navigator url="/pages/leave/apply" class="action-btn primary">
          <text class="action-icon">+</text>
          <text class="action-text">申请请假</text>
        </navigator>
        <navigator url="/pages/leave/cancel" class="action-btn secondary" v-if="hasActiveLeave">
          <text class="action-icon">✓</text>
          <text class="action-text">销假</text>
        </navigator>
      </view>

      <!-- Leave List -->
      <view class="section-header">
        <text class="section-title">请假记录</text>
        <text class="count-badge">{{ leaveList.length }}条</text>
      </view>

      <view class="leave-list">
        <view v-for="item in leaveList" :key="item.id" class="leave-card" @tap="goDetail(item)">
          <view class="card-accent" :class="statusClass(item.status)"></view>
          <view class="card-body">
            <view class="card-top">
              <text class="leave-type">{{ item.type }}</text>
              <view :class="['status-badge', statusClass(item.status)]">
                {{ statusLabel(item.status) }}
              </view>
            </view>
            <text class="leave-reason">{{ item.reason }}</text>
            <view class="card-meta">
              <text class="meta-text">{{ item.startDate }} ~ {{ item.endDate }}</text>
            </view>
          </view>
        </view>

        <view v-if="leaveList.length === 0" class="empty-state">
          <text class="empty-icon">📋</text>
          <text class="empty-text">暂无请假记录</text>
        </view>
      </view>

      <!-- Admin Approve Entry -->
      <view class="admin-entry" v-if="isAdmin" @tap="goApprove">
        <view class="admin-icon-wrap">
          <text class="admin-icon">⚡</text>
        </view>
        <view class="admin-info">
          <text class="admin-title">审批管理</text>
          <text class="admin-desc">{{ pendingCount }}条待处理</text>
        </view>
        <text class="admin-arrow">›</text>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { isAdmin as checkAdmin, canApproveLeave } from '@/utils/auth.js'

const isAdmin = ref(false)
const hasActiveLeave = ref(true)
const pendingCount = ref(3)

const stats = ref({
  pending: 2,
  approved: 8,
  rejected: 1
})

const leaveList = ref([
  { id: 1, type: '早操', reason: '身体不适', startDate: '2026-04-10', endDate: '2026-04-10', status: 0 },
  { id: 2, type: '晚自习', reason: '参加学术讲座', startDate: '2026-04-11', endDate: '2026-04-11', status: 1 },
  { id: 3, type: '午集合', reason: '病假', startDate: '2026-04-09', endDate: '2026-04-09', status: 2 },
  { id: 4, type: '其他', reason: '家中有事', startDate: '2026-04-12', endDate: '2026-04-13', status: 0 }
])

function statusClass(status) {
  if (status === 0) return 'pending'
  if (status === 1) return 'approved'
  return 'rejected'
}

function statusLabel(status) {
  if (status === 0) return '待审批'
  if (status === 1) return '已通过'
  return '已驳回'
}

function goDetail(item) {
  console.log('查看详情', item)
}

function goApprove() {
  uni.navigateTo({ url: '/pages/leave/approve' })
}

onMounted(() => {
  isAdmin.value = checkAdmin()
})
</script>

<style lang="scss" scoped>
.leave-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.stats-row {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;
}

.stat-card {
  flex: 1;
  background: #ffffff;
  border-radius: 18rpx;
  padding: 28rpx 20rpx;
  text-align: center;

  &.active {
    background: linear-gradient(135deg, #001e40 0%, #003366 100%);

    .stat-num, .stat-label {
      color: #ffffff;
    }
  }
}

.stat-num {
  font-family: 'PingFang SC', sans-serif;
  font-size: 44rpx;
  font-weight: 700;
  color: #001e40;
  display: block;
}

.stat-label {
  font-size: 22rpx;
  color: #43474f;
  margin-top: 6rpx;
  display: block;
}

.action-bar {
  display: flex;
  gap: 16rpx;
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 88rpx;
  border-radius: 18rpx;

  &.primary {
    background: linear-gradient(135deg, #001e40 0%, #003366 100%);

    .action-icon, .action-text {
      color: #ffffff;
    }
  }

  &.secondary {
    background: #f2f4f7;

    .action-icon, .action-text {
      color: #001e40;
    }
  }
}

.action-icon {
  font-size: 32rpx;
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
  font-family: 'PingFang SC', sans-serif;
  font-size: 30rpx;
  font-weight: 600;
  color: #191c1e;
}

.count-badge {
  font-size: 22rpx;
  color: #c3c6d1;
  font-weight: 500;
}

.leave-list {
  padding: 0 32rpx;
}

.leave-card {
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 18rpx;
  overflow: hidden;
  margin-bottom: 16rpx;

  &:active {
    opacity: 0.85;
  }
}

.card-accent {
  width: 10rpx;
  flex-shrink: 0;

  &.pending { background: #466270; }
  &.approved { background: #003366; }
  &.rejected { background: #460002; }
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
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #191c1e;
}

.status-badge {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;

  &.pending { background: rgba(70,98,112,0.1); color: #466270; }
  &.approved { background: rgba(0,30,64,0.08); color: #001e40; }
  &.rejected { background: rgba(70,0,2,0.08); color: #460002; }
}

.leave-reason {
  font-size: 26rpx;
  color: #43474f;
  margin-bottom: 12rpx;
  display: block;
}

.card-meta {
  display: flex;
  gap: 16rpx;
}

.meta-text {
  font-size: 22rpx;
  color: #c3c6d1;
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
  font-size: 26rpx;
  color: #c3c6d1;
}

.admin-entry {
  margin: 32rpx 32rpx 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
  background: linear-gradient(135deg, rgba(0,30,64,0.03) 0%, rgba(0,51,102,0.02) 100%);
  border-left: 10rpx solid #001e40;
  border-radius: 18rpx;

  &:active {
    opacity: 0.8;
  }
}

.admin-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  background: rgba(0,30,64,0.06);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-icon {
  font-size: 32rpx;
}

.admin-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.admin-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #191c1e;
}

.admin-desc {
  font-size: 22rpx;
  color: #43474f;
}

.admin-arrow {
  font-size: 40rpx;
  color: #c3c6d1;
}
</style>