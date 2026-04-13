<template>
  <view class="approve-page">
    <custom-nav-bar title="审批请假" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="pending-list">
        <view v-for="item in pendingList" :key="item.id" class="approve-card">
          <view class="card-accent"></view>
          <view class="card-body">
            <view class="user-row">
              <view class="avatar-box">
                <text class="avatar-text">{{ item.name.charAt(0) }}</text>
              </view>
              <view class="user-info">
                <text class="user-name">{{ item.name }}</text>
                <text class="user-id">{{ item.studentId }}</text>
              </view>
              <view class="type-badge">{{ item.type }}</view>
            </view>

            <view class="detail-section">
              <view class="detail-item">
                <text class="detail-label">事由</text>
                <text class="detail-value">{{ item.reasonType }} - {{ item.reason }}</text>
              </view>
              <view class="detail-item">
                <text class="detail-label">时间</text>
                <text class="detail-value">{{ item.startDate }} ~ {{ item.endDate }}</text>
              </view>
            </view>

            <view class="action-row" v-if="!item.processed">
              <button class="action-btn reject" @click="handleReject(item)">驳回</button>
              <button class="action-btn approve" @click="handleApprove(item)">通过</button>
            </view>

            <view class="processed-tag" v-else>
              <text :class="['processed-text', item.approved ? 'yes' : 'no']">
                {{ item.approved ? '已通过' : '已驳回' }}
              </text>
            </view>
          </view>
        </view>

        <view v-if="pendingList.length === 0" class="empty-state">
          <text class="empty-icon">✅</text>
          <text class="empty-text">暂无待审批的请假申请</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { canApproveLeave, isAdmin } from '@/utils/auth.js'

const pendingList = ref([
  {
    id: 1,
    name: '张三',
    studentId: '20230911001',
    type: '早操',
    reasonType: '病假',
    reason: '身体不适',
    startDate: '2026-04-10',
    endDate: '2026-04-10',
    processed: false,
    approved: false
  },
  {
    id: 2,
    name: '李四',
    studentId: '20230911002',
    type: '晚自习',
    reasonType: '公假',
    reason: '参加学术讲座',
    startDate: '2026-04-11',
    endDate: '2026-04-11',
    processed: false,
    approved: false
  },
  {
    id: 3,
    name: '王五',
    studentId: '20230911003',
    type: '午集合',
    reasonType: '事假',
    reason: '家中有事',
    startDate: '2026-04-12',
    endDate: '2026-04-12',
    processed: true,
    approved: true
  }
])

function handleApprove(item) {
  uni.showModal({
    title: '确认通过',
    content: `确定通过 ${item.name} 的请假申请？`,
    success: (res) => {
      if (res.confirm) {
        item.processed = true
        item.approved = true
        uni.showToast({ title: '已通过', icon: 'success' })
      }
    }
  })
}

function handleReject(item) {
  uni.showModal({
    title: '确认驳回',
    content: `确定驳回 ${item.name} 的请假申请？`,
    success: (res) => {
      if (res.confirm) {
        item.processed = true
        item.approved = false
        uni.showToast({ title: '已驳回', icon: 'none' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.approve-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.pending-list {
  padding: 24rpx 32rpx;
}

.approve-card {
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.card-accent {
  width: 10rpx;
  background: #466270;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  padding: 24rpx;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.avatar-box {
  width: 72rpx;
  height: 72rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.user-name {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #191c1e;
}

.user-id {
  font-size: 22rpx;
  color: #c3c6d1;
}

.type-badge {
  padding: 8rpx 18rpx;
  background: rgba(70,98,112,0.08);
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #466270;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.detail-item {
  display: flex;
  gap: 16rpx;
}

.detail-label {
  font-size: 24rpx;
  color: #c3c6d1;
  width: 80rpx;
  flex-shrink: 0;
}

.detail-value {
  font-size: 26rpx;
  color: #43474f;
  flex: 1;
}

.action-row {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 14rpx;
  border: none;
  font-size: 28rpx;
  font-weight: 600;

  &.reject {
    background: #f2f4f7;
    color: #460002;
  }

  &.approve {
    background: linear-gradient(135deg, #001e40 0%, #003366 100%);
    color: #ffffff;
  }
}

.processed-tag {
  text-align: center;
  padding-top: 8rpx;
}

.processed-text {
  font-size: 26rpx;
  font-weight: 600;

  &.yes { color: #003366; }
  &.no { color: #460002; }
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
</style>