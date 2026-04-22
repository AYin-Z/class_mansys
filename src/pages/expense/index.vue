<template>
  <view class="expense-page">
    <custom-nav-bar title="经费管理" />

    <scroll-view scroll-y class="main-scroll">
      <view class="balance-card">
        <view class="balance-bg"></view>
        <view class="balance-content">
          <text class="balance-label">经费余额</text>
          <view class="balance-amount-row">
            <text class="currency">¥</text>
            <text class="amount">{{ balance }}</text>
          </view>
          <view class="balance-meta">
            <view class="meta-item">
              <text class="meta-label">已审批</text>
              <text class="meta-value approved">{{ approvedCount }}</text>
            </view>
            <view class="meta-divider"></view>
            <view class="meta-item">
              <text class="meta-label">待审批</text>
              <text class="meta-value pending">{{ pendingCount }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="action-grid">
        <navigator url="/pages/expense/apply" class="action-card">
          <view class="action-icon-wrap blue">
            <text class="action-emoji">📝</text>
          </view>
          <text class="action-label">经费申请</text>
        </navigator>
        <navigator url="/pages/expense/approve" class="action-card" v-if="isAdmin">
          <view class="action-icon-wrap green">
            <text class="action-emoji">✅</text>
          </view>
          <text class="action-label">经费审批</text>
        </navigator>
        <navigator url="/pages/expense/records" class="action-card">
          <view class="action-icon-wrap orange">
            <text class="action-emoji">📊</text>
          </view>
          <text class="action-label">经费记录</text>
        </navigator>
      </view>

      <view class="recent-section">
        <view class="section-header">
          <text class="section-title">最近申请</text>
          <navigator url="/pages/expense/records" class="more-link">全部 ›</navigator>
        </view>
        <view class="record-list">
          <view v-for="item in recentList" :key="item.id" class="record-item">
            <view :class="['status-dot', item.status]"></view>
            <view class="record-info">
              <text class="record-title">{{ item.title }}</text>
              <text class="record-time">{{ item.time }}</text>
            </view>
            <text class="record-amount">¥{{ item.amount }}</text>
          </view>
          <view v-if="recentList.length === 0" class="empty-state">
            <text class="empty-text">暂无申请记录</text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { isAdmin as checkAdmin } from '@/utils/auth.js'

const balance = ref('0.00')
const approvedCount = ref(0)
const pendingCount = ref(0)
const isAdmin = ref(false)

const recentList = ref([])

onMounted(() => {
  isAdmin.value = checkAdmin()
})
</script>

<style lang="scss" scoped>
.expense-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.balance-card {
  position: relative;
  margin: 24rpx 32rpx;
  border-radius: 24rpx;
  overflow: hidden;
}

.balance-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
}

.balance-content {
  position: relative;
  padding: 40rpx 32rpx;
}

.balance-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.65);
  display: block;
  margin-bottom: 12rpx;
}

.balance-amount-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 28rpx;
}

.currency {
  font-family: 'PingFang SC', sans-serif;
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
}

.amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 72rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -1rpx;
}

.balance-meta {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.meta-item {
  flex: 1;
  text-align: center;
}

.meta-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.55);
  display: block;
  margin-bottom: 4rpx;
}

.meta-value {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;

  &.approved { color: #a7c8ff; }
  &.pending { color: #ffb4ab; }
}

.meta-divider {
  width: 1rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.15);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding: 0 32rpx;
  margin-top: 32rpx;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 8rpx;
  background: #ffffff;
  border-radius: 18rpx;
}

.action-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.blue { background: rgba(0, 30, 64, 0.06); }
  &.green { background: rgba(70, 98, 112, 0.08); }
  &.orange { background: rgba(70, 0, 2, 0.05); }
}

.action-emoji {
  font-size: 36rpx;
}

.action-label {
  font-size: 22rpx;
  font-weight: 500;
  color: #43474f;
  text-align: center;
}

.recent-section {
  margin: 40rpx 32rpx 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.section-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 30rpx;
  font-weight: 600;
  color: #191c1e;
}

.more-link {
  font-size: 24rpx;
  color: #43474f;
  font-weight: 500;
}

.record-list {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 16rpx;
}

.status-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  flex-shrink: 0;

  &.approved { background: #003366; }
  &.pending { background: #466270; }
  &.rejected { background: #460002; }
}

.record-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.record-title {
  font-size: 27rpx;
  color: #191c1e;
  font-weight: 500;
}

.record-time {
  font-size: 22rpx;
  color: #c3c6d1;
}

.record-amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  color: #001e40;
  flex-shrink: 0;
}

.empty-state {
  padding: 80rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 26rpx;
  color: #c3c6d1;
}
</style>
