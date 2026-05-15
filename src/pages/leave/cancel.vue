<template>
  <view class="cancel-page">
    <custom-nav-bar title="销假" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="hero-strip">
        <text class="hero-title">销假登记</text>
        <text class="hero-sub">仅「已通过且未销假」的申请可在此确认销假</text>
      </view>

      <view class="active-leave-list" v-if="activeLeaves.length > 0">
        <view v-for="item in activeLeaves" :key="item.id" class="leave-card">
          <view class="card-accent"></view>
          <view class="card-body">
            <view class="card-header">
              <text class="leave-type">{{ item.leave_type || '—' }}</text>
              <text class="leave-status">进行中</text>
            </view>
            <text class="leave-reason">{{ item.reason || '—' }}</text>
            <view class="time-row">
              <text class="time-text">{{ formatLeaveDateTime(item.start_time) }} ~ {{ formatLeaveDateTime(item.end_time) }}</text>
            </view>
            <button class="cancel-btn" @click="handleCancel(item)">确认销假</button>
          </view>
        </view>
      </view>

      <view class="empty-state" v-else>
        <text class="empty-icon">✓</text>
        <text class="empty-title">暂无需要销假的记录</text>
        <text class="empty-desc">当前没有已通过且未销假的请假，或请稍后再试</text>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMyLeaves, cancelLeave } from '@/api/leave'
import { hasBackendToken } from '@/utils/request'
import { formatLeaveDateTime } from '@/utils/index'

const allLeaves = ref([])

const activeLeaves = computed(() =>
  (allLeaves.value || []).filter((l) => l.status === 1 && !(l.is_cancelled === 1 || l.is_cancelled === true))
)

async function load() {
  if (!hasBackendToken()) {
    allLeaves.value = []
    return
  }
  try {
    const res = await getMyLeaves()
    if (res.success) {
      allLeaves.value = res.leaves || []
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handleCancel(item) {
  uni.showModal({
    title: '确认销假',
    content: `确定要销假「${item.leave_type || '请假'}」吗？`,
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '提交中…' })
      try {
        const r = await cancelLeave(item.id)
        uni.hideLoading()
        if (r.success) {
          uni.showToast({ title: '销假成功', icon: 'success' })
          await load()
        } else {
          uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        }
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '网络错误', icon: 'none' })
      }
    }
  })
}

onShow(() => {
  load()
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.cancel-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #e8eef5 0%, #f4f6f9 100%);
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.hero-strip {
  margin: 16rpx 32rpx 24rpx;
  padding: 28rpx 28rpx 26rpx;
  background: linear-gradient(135deg, #102a43 0%, #1e4d7b 100%);
  border-radius: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(16, 42, 67, 0.2);
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.45;
}

.active-leave-list {
  padding: 0 32rpx;
}

.leave-card {
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 28rpx rgba(16, 42, 67, 0.06);
}

.card-accent {
  width: 10rpx;
  background: #1e4d7b;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  padding: 24rpx;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.leave-type {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2332;
}

.leave-status {
  font-size: 22rpx;
  font-weight: 600;
  color: #1e4d7b;
  background: rgba(30, 77, 123, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.leave-reason {
  font-size: 26rpx;
  color: #4a5562;
  margin-bottom: 12rpx;
  display: block;
  line-height: 1.4;
}

.time-row {
  margin-bottom: 20rpx;
}

.time-text {
  font-size: 22rpx;
  color: #8b95a1;
}

.cancel-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #102a43 0%, #1e4d7b 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
}

.empty-state {
  padding: 100rpx 48rpx;
  text-align: center;
}

.empty-icon {
  font-size: 64rpx;
  display: block;
  margin-bottom: 16rpx;
  color: #1e4d7b;
}

.empty-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #5c6570;
  display: block;
}

.empty-desc {
  font-size: 24rpx;
  color: #a8b0ba;
  margin-top: 12rpx;
  display: block;
  line-height: 1.5;
}

.page-spacer {
  height: 48rpx;
}
</style>
