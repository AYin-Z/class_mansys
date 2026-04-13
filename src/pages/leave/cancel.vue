<template>
  <view class="cancel-page">
    <custom-nav-bar title="销假" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="active-leave-list" v-if="activeLeaves.length > 0">
        <view v-for="item in activeLeaves" :key="item.id" class="leave-card">
          <view class="card-accent"></view>
          <view class="card-body">
            <view class="card-header">
              <text class="leave-type">{{ item.type }}</text>
              <text class="leave-status">进行中</text>
            </view>
            <text class="leave-reason">{{ item.reason }}</text>
            <view class="time-row">
              <text class="time-text">{{ item.startDate }} ~ {{ item.endDate }}</text>
            </view>
            <button class="cancel-btn" @click="handleCancel(item)">确认销假</button>
          </view>
        </view>
      </view>

      <view class="empty-state" v-else>
        <text class="empty-icon">✓</text>
        <text class="empty-title">暂无需要销假的记录</text>
        <text class="empty-desc">您当前没有进行中的请假申请</text>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const activeLeaves = ref([
  {
    id: 1,
    type: '早操',
    reason: '身体不适',
    startDate: '2026-04-10',
    endDate: '2026-04-10'
  },
  {
    id: 2,
    type: '其他',
    reason: '家中有事',
    startDate: '2026-04-12',
    endDate: '2026-04-13'
  }
])

function handleCancel(item) {
  uni.showModal({
    title: '确认销假',
    content: `确定要销假「${item.type}」的请假吗？`,
    success: (res) => {
      if (res.confirm) {
        const index = activeLeaves.value.findIndex(l => l.id === item.id)
        if (index > -1) {
          activeLeaves.value.splice(index, 1)
        }
        uni.showToast({ title: '销假成功', icon: 'success' })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.cancel-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.active-leave-list {
  padding: 24rpx 32rpx;
}

.leave-card {
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.card-accent {
  width: 10rpx;
  background: #003366;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  padding: 28rpx 24rpx;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.leave-type {
  font-family: 'PingFang SC', sans-serif;
  font-size: 30rpx;
  font-weight: 600;
  color: #191c1e;
}

.leave-status {
  font-size: 22rpx;
  color: #466270;
  font-weight: 500;
}

.leave-reason {
  font-size: 26rpx;
  color: #43474f;
  margin-bottom: 12rpx;
  display: block;
}

.time-row {
  margin-bottom: 20rpx;
}

.time-text {
  font-size: 24rpx;
  color: #c3c6d1;
}

.cancel-btn {
  width: 100%;
  height: 80rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
  border-radius: 14rpx;
  border: none;
  font-size: 28rpx;
  font-weight: 600;
  color: #ffffff;

  &:active {
    opacity: 0.9;
  }
}

.empty-state {
  padding: 120rpx 48rpx;
  text-align: center;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  line-height: 120rpx;
  font-size: 56rpx;
  background: rgba(0,30,64,0.05);
  border-radius: 50%;
  display: inline-block;
  margin-bottom: 24rpx;
  color: #001e40;
}

.empty-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 600;
  color: #191c1e;
  display: block;
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: #c3c6d1;
  display: block;
}
</style>