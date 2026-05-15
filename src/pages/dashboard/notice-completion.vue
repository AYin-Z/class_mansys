<template>
  <view class="page">
    <custom-nav-bar title="待办完成情况" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="hero-strip">
        <view class="hero-text">
          <text class="hero-title">{{ notice?.title || '通知' }}</text>
          <text class="hero-sub">已完成 {{ data.completed.length }} / {{ data.total }} 人</text>
        </view>
        <view class="hero-stat">
          <text class="stat-num">{{ data.total }}</text>
          <text class="stat-label">全班</text>
        </view>
      </view>

      <!-- 完成率进度条 -->
      <view class="progress-wrap">
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: percent + '%' }"></view>
        </view>
        <text class="progress-text">{{ percent }}%</text>
      </view>

      <!-- 筛选 tab -->
      <scroll-view scroll-x class="filter-scroll" show-scrollbar="false">
        <view
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="['filter-tab', { active: activeTab === tab.key }]"
          @tap="activeTab = tab.key"
        >
          <text class="ft-text">{{ tab.label }}</text>
          <text class="ft-count">{{ tab.count }}</text>
        </view>
      </scroll-view>

      <!-- 名单 -->
      <view class="list">
        <view
          v-for="item in displayList"
          :key="item.id"
          :class="['list-row', item._done ? 'done' : 'pending']"
        >
          <text class="lr-name">{{ item.name }}</text>
          <text class="lr-id">{{ item.student_id }}</text>
          <view class="lr-status">
            <text v-if="item._done" class="badge-done">✅ 已完成</text>
            <text v-else class="badge-pending">⏳ 未完成</text>
          </view>
        </view>

        <view v-if="displayList.length === 0" class="empty-state">
          <text class="empty-text">暂无数据</text>
        </view>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getTodoCompletion } from '@/api/notice'

const notice = ref<any>(null)
const data = ref<{ completed: any[]; pending: any[]; total: number }>({
  completed: [], pending: [], total: 0
})
const activeTab = ref('all')

const percent = computed(() => {
  if (data.value.total === 0) return 0
  return Math.round((data.value.completed.length / data.value.total) * 100)
})

const filterTabs = computed(() => [
  { key: 'all',     label: '全部',   count: data.value.total },
  { key: 'done',    label: '已完成', count: data.value.completed.length },
  { key: 'pending', label: '未完成', count: data.value.pending.length },
])

const displayList = computed(() => {
  const done = data.value.completed.map((c: any) => ({ ...c, _done: true }))
  const pend = data.value.pending.map((p: any) => ({ ...p, _done: false }))
  const all = [...done, ...pend]
  if (activeTab.value === 'done') return done
  if (activeTab.value === 'pending') return pend
  return all
})

onLoad(async (opts: any) => {
  const id = parseInt(opts?.id || '', 10)
  if (Number.isNaN(id)) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    return
  }
  try {
    const res = await getTodoCompletion(id)
    if (res.success) {
      data.value = {
        completed: res.completed || [],
        pending: res.pending || [],
        total: res.total || 0
      }
      // also get the notice title
      const { getNoticeDetail } = await import('@/api/notice')
      const detail = await getNoticeDetail(id)
      if (detail.success) notice.value = detail.notice
    }
  } catch (_) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.page {
  min-height: 100vh;
  background: $surface;
}
.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.hero-strip {
  margin: 24rpx 32rpx 16rpx;
  padding: 28rpx;
  background: $gradient-primary;
  border-radius: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hero-text { flex: 1; min-width: 0; }
.hero-title {
  font-size: 34rpx; font-weight: 700; color: #fff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hero-sub {
  margin-top: 6rpx; font-size: 24rpx; color: rgba(255,255,255,0.8);
}
.hero-stat {
  text-align: center; padding-left: 24rpx;
}
.stat-num {
  font-size: 48rpx; font-weight: 800; color: #fff; line-height: 1;
}
.stat-label {
  font-size: 20rpx; color: rgba(255,255,255,0.7); margin-top: 4rpx;
}

/* 进度条 */
.progress-wrap {
  margin: 0 32rpx 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.progress-track {
  flex: 1;
  height: 12rpx;
  background: $outline-variant;
  border-radius: 999rpx;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: $gradient-primary;
  border-radius: 999rpx;
  transition: width 0.4s ease;
}
.progress-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $primary;
  min-width: 60rpx;
  text-align: right;
}

/* Filter */
.filter-scroll {
  margin: 0 28rpx 12rpx;
  white-space: nowrap;
}
.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 24rpx;
  margin-right: 12rpx;
  background: $surface-container-low;
  border-radius: 20rpx;
  transition: all $transition-fast;
  &.active {
    background: $primary;
    .ft-text { color: #fff; font-weight: 600; }
    .ft-count { background: rgba(255,255,255,0.25); color: #fff; }
  }
}
.ft-text { font-size: 26rpx; color: $on-surface; }
.ft-count {
  font-size: 20rpx; padding: 1rpx 10rpx;
  background: $outline-variant; border-radius: 10rpx; color: $on-surface-variant;
}

/* List */
.list { margin: 0 28rpx; }
.list-row {
  display: flex;
  align-items: center;
  padding: 22rpx 20rpx;
  background: #fff;
  border-radius: 14rpx;
  margin-bottom: 8rpx;
  box-shadow: 0 1rpx 6rpx rgba(0,0,0,0.03);
  border-left: 6rpx solid transparent;
  &.done { border-left-color: #2e7d32; }
  &.pending { border-left-color: #e6a000; }
}
.lr-name { font-size: 28rpx; font-weight: 600; color: $on-surface; width: 130rpx; }
.lr-id { font-size: 24rpx; color: $on-surface-tertiary; flex: 1; }
.lr-status { text-align: right; }
.badge-done { font-size: 24rpx; color: #2e7d32; }
.badge-pending { font-size: 24rpx; color: #bf6b00; }

.empty-state {
  text-align: center; padding: 80rpx 0;
  .empty-text { font-size: 26rpx; color: $on-surface-tertiary; }
}

.page-spacer { height: 32rpx; }
</style>
