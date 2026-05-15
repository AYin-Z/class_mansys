<template>
  <view class="approve-page">
    <custom-nav-bar title="审批请假" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="hero-strip">
        <text class="hero-title">待办审批</text>
        <text class="hero-sub">共 {{ pendingList.length }} 条待处理 · 已处理 {{ processedList.length }} 条</text>
      </view>

      <view class="pending-list">
        <view v-for="item in pendingList" :key="item.id" class="approve-card">
          <view class="card-accent pending"></view>
          <view class="card-body">
            <view class="user-row">
              <view class="avatar-box">
                <text class="avatar-text">{{ applicantInitial(item) }}</text>
              </view>
              <view class="user-info">
                <text class="user-name">{{ item.applicant_name || '未知' }}</text>
                <text class="user-id">{{ item.applicant_student_id || '—' }}</text>
              </view>
              <view class="type-badge">{{ item.leave_type || '—' }}</view>
            </view>

            <view class="detail-section">
              <view class="detail-item">
                <text class="detail-label">事由</text>
                <text class="detail-value">{{ item.reason || '—' }}</text>
              </view>
              <view class="detail-item">
                <text class="detail-label">时间</text>
                <text class="detail-value">{{ formatLeaveDateTime(item.start_time) }} ~ {{ formatLeaveDateTime(item.end_time) }}</text>
              </view>
            </view>

            <view class="action-row">
              <button class="action-btn reject" @click="handleReject(item)">驳回</button>
              <button class="action-btn approve" @click="handleApprove(item)">通过</button>
            </view>
          </view>
        </view>

        <view v-if="pendingList.length === 0" class="empty-state">
          <text class="empty-icon">✅</text>
          <text class="empty-text">暂无待审批的请假申请</text>
        </view>
      </view>

      <view class="section-title" v-if="processedList.length">已处理</view>

      <view class="pending-list processed">
        <view v-for="item in processedList" :key="'p-' + item.id" class="approve-card done">
          <view class="card-accent" :class="item.status === 1 ? 'ok' : 'bad'"></view>
          <view class="card-body">
            <view class="user-row">
              <view class="avatar-box muted">
                <text class="avatar-text">{{ applicantInitial(item) }}</text>
              </view>
              <view class="user-info">
                <text class="user-name">{{ item.applicant_name || '未知' }}</text>
                <text class="user-id">{{ item.applicant_student_id || '—' }}</text>
              </view>
              <view :class="['status-mini', item.status === 1 ? 'yes' : 'no']">
                {{ item.status === 1 ? '已通过' : '已驳回' }}
              </view>
            </view>
            <view class="detail-section compact">
              <text class="detail-value single">{{ item.reason || '—' }}</text>
              <text class="time-mini">{{ formatLeaveDateTime(item.start_time) }} ~ {{ formatLeaveDateTime(item.end_time) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { canApproveLeave } from '@/utils/auth.js'
import { getAllLeaves, approveLeave } from '@/api/leave'
import { hasBackendToken } from '@/utils/request'
import { formatLeaveDateTime } from '@/utils/index'

const allLeaves = ref([])

const pendingList = computed(() => (allLeaves.value || []).filter((l) => l.status === 0))
const processedList = computed(() =>
  (allLeaves.value || []).filter((l) => l.status === 1 || l.status === 2).slice(0, 50)
)

function applicantInitial(item) {
  const n = item.applicant_name
  return n && n.length ? n.charAt(0) : '?'
}

async function load() {
  if (!hasBackendToken() || !canApproveLeave()) {
    allLeaves.value = []
    return
  }
  try {
    const res = await getAllLeaves()
    if (res.success) {
      allLeaves.value = res.leaves || []
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handleApprove(item) {
  uni.showModal({
    title: '确认通过',
    content: `确定通过「${item.applicant_name || '同学'}」的请假申请？`,
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '处理中…' })
      try {
        const r = await approveLeave(item.id, 1)
        uni.hideLoading()
        if (r.success) {
          uni.showToast({ title: '已通过', icon: 'success' })
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

function handleReject(item) {
  uni.showModal({
    title: '确认驳回',
    content: `确定驳回「${item.applicant_name || '同学'}」的请假申请？`,
    success: async (res) => {
      if (!res.confirm) return
      uni.showLoading({ title: '处理中…' })
      try {
        const r = await approveLeave(item.id, 2)
        uni.hideLoading()
        if (r.success) {
          uni.showToast({ title: '已驳回', icon: 'none' })
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

onMounted(() => {
  if (!canApproveLeave()) {
    uni.showToast({ title: '无审批权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }
  load()
})

onShow(() => {
  if (canApproveLeave()) load()
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.approve-page {
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
  color: $on-primary;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.45;
}

.pending-list {
  padding: 0 32rpx;

  &.processed {
    padding-top: 8rpx;
  }
}

.section-title {
  padding: 16rpx 32rpx 12rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #5c6570;
}

.approve-card {
  position: relative;
  display: flex;
  background: $surface-container-lowest;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 28rpx rgba(16, 42, 67, 0.06);

  &.done {
    opacity: 0.96;
  }
}

.card-accent {
  width: 10rpx;
  flex-shrink: 0;

  &.pending {
    background: #b8860b;
  }
  &.ok {
    background: #1e4d7b;
  }
  &.bad {
    background: #8b2942;
  }
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
  background: linear-gradient(135deg, #102a43 0%, #1e4d7b 100%);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.muted {
    opacity: 0.85;
  }
}

.avatar-text {
  font-size: 28rpx;
  font-weight: 700;
  color: $on-primary;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.user-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #1a2332;
}

.user-id {
  font-size: 22rpx;
  color: $on-surface-tertiary;
}

.type-badge {
  padding: 8rpx 18rpx;
  background: rgba(16, 42, 67, 0.06);
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #1e4d7b;
}

.status-mini {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;

  &.yes {
    background: rgba(30, 77, 123, 0.1);
    color: #1e4d7b;
  }
  &.no {
    background: rgba(139, 41, 66, 0.1);
    color: #8b2942;
  }
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 24rpx;

  &.compact {
    margin-bottom: 0;
    gap: 8rpx;
  }
}

.detail-item {
  display: flex;
  gap: 16rpx;
}

.detail-label {
  font-size: 24rpx;
  color: $on-surface-tertiary;
  width: 72rpx;
  flex-shrink: 0;
}

.detail-value {
  font-size: 26rpx;
  color: #4a5562;
  flex: 1;
  line-height: 1.45;

  &.single {
    display: block;
  }
}

.time-mini {
  font-size: 22rpx;
  color: #a8b0ba;
}

.action-row {
  display: flex;
  gap: 16rpx;
}

.action-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 16rpx;
  border: none;
  font-size: 28rpx;
  font-weight: 600;

  &.reject {
    background: #f0f3f7;
    color: #8b2942;
  }

  &.approve {
    background: linear-gradient(135deg, #102a43 0%, #1e4d7b 100%);
    color: $on-primary;
  }
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
  color: $on-surface-tertiary;
}

.page-spacer {
  height: 48rpx;
}
</style>
