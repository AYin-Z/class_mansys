<template>
  <view class="collection-page">
    <custom-nav-bar title="班费收缴" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="summary-card">
        <view class="accent-bar"></view>
        <view class="summary-content">
          <text class="summary-title">本期收缴</text>
          <view class="amount-row">
            <text class="currency">¥</text>
            <text class="amount">{{ currentAmount }}</text>
            <text class="per-person">/人</text>
          </view>
          <view class="progress-wrap">
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
            </view>
            <text class="progress-text">{{ paidCount }}/{{ totalCount }}人已缴纳</text>
          </view>
        </view>
      </view>

      <view class="section-header">
        <text class="section-title">缴纳状态</text>
        <button class="refresh-btn" @click="refreshList">刷新</button>
      </view>

      <view class="member-list">
        <view v-for="m in members" :key="m.id" class="member-card">
          <view class="avatar-box" :style="{ background: m.paid ? 'linear-gradient(135deg, #001e40, #003366)' : '#f2f4f7' }">
            <text class="avatar-text" :class="{ dim: !m.paid }">{{ m.name.charAt(0) }}</text>
          </view>
          <view class="member-info">
            <text class="member-name">{{ m.name }}</text>
            <text class="member-id">{{ m.studentId }}</text>
          </view>
          <view :class="['status-tag', m.paid ? 'paid' : 'unpaid']">
            {{ m.paid ? '已缴纳' : '未缴纳' }}
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const currentAmount = ref('50.00')
const paidCount = ref(28)
const totalCount = ref(32)
const progressPercent = ref(87.5)

const members = ref([
  { id: 1, name: '张三', studentId: '20230911001', paid: true },
  { id: 2, name: '李四', studentId: '20230911002', paid: true },
  { id: 3, name: '王五', studentId: '20230911003', paid: false },
  { id: 4, name: '赵六', studentId: '20230911004', paid: true },
  { id: 5, name: '孙七', studentId: '20230911005', paid: true },
  { id: 6, name: '周八', studentId: '20230911006', paid: false }
])

function refreshList() {
  uni.showToast({ title: '已刷新', icon: 'success' })
}
</script>

<style lang="scss" scoped>
.collection-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.summary-card {
  position: relative;
  margin: 24rpx 32rpx;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.accent-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10rpx;
  background: linear-gradient(180deg, #001e40, #003366);
}

.summary-content {
  padding: 32rpx 28rpx 28rpx 24rpx;
}

.summary-title {
  font-size: 24rpx;
  color: #c3c6d1;
  font-weight: 500;
  display: block;
  margin-bottom: 12rpx;
}

.amount-row {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  margin-bottom: 24rpx;
}

.currency {
  font-size: 32rpx;
  font-weight: 700;
  color: #191c1e;
}

.amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 56rpx;
  font-weight: 700;
  color: #191c1e;
}

.per-person {
  font-size: 26rpx;
  color: #c3c6d1;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.progress-bar {
  height: 12rpx;
  background: #f2f4f7;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #001e40, #003366);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #c3c6d1;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  margin-bottom: 20rpx;
  margin-top: 32rpx;
}

.section-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 30rpx;
  font-weight: 600;
  color: #191c1e;
}

.refresh-btn {
  font-size: 24rpx;
  color: #001e40;
  background: transparent;
  border: none;
  padding: 0;

  &::after {
    display: none;
  }
}

.member-list {
  padding: 0 32rpx;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid transparent;

  &:not(:last-child) {
    border-bottom-color: #f2f4f7;
  }
}

.avatar-box {
  width: 72rpx;
  height: 72rpx;
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

  &.dim {
    color: #c3c6d1;
  }
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.member-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #191c1e;
}

.member-id {
  font-size: 22rpx;
  color: #c3c6d1;
}

.status-tag {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;

  &.paid {
    background: rgba(0,30,64,0.06);
    color: #001e40;
  }

  &.unpaid {
    background: rgba(70,0,2,0.06);
    color: #460002;
  }
}
</style>