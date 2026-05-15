<template>
  <div class="page">
    <custom-nav-bar title="待办完成情况" :showBack="true" />

    <div scroll-y class="main-scroll">
      <div class="hero-strip">
        <div class="hero-text">
          <span class="hero-title">{{ notice?.title || '通知' }}</span>
          <span class="hero-sub">已完成 {{ data.completed.length }} / {{ data.total }} 人</span>
        </div>
        <div class="hero-stat">
          <span class="stat-num">{{ data.total }}</span>
          <span class="stat-label">全班</span>
        </div>
      </div>

      <!-- 完成率进度条 -->
      <div class="progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: percent + '%' }"></div>
        </div>
        <span class="progress-text">{{ percent }}%</span>
      </div>

      <!-- 筛选 tab -->
      <div scroll-x class="filter-scroll" show-scrollbar="false">
        <div
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="['filter-tab', { active: activeTab === tab.key }]"
          @tap="activeTab = tab.key"
        >
          <span class="ft-text">{{ tab.label }}</span>
          <span class="ft-count">{{ tab.count }}</span>
        </div>
      </div>

      <!-- 名单 -->
      <div class="list">
        <div
          v-for="item in displayList"
          :key="item.id"
          :class="['list-row', item._done ? 'done' : 'pending']"
        >
          <span class="lr-name">{{ item.name }}</span>
          <span class="lr-id">{{ item.student_id }}</span>
          <div class="lr-status">
            <span v-if="item._done" class="badge-done">✅ 已完成</span>
            <span v-else class="badge-pending">⏳ 未完成</span>
          </div>
        </div>

        <div v-if="displayList.length === 0" class="empty-state">
          <span class="empty-text">暂无数据</span>
        </div>
      </div>

      <div class="page-spacer"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
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
    showToast('参数错误')
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
    showToast('加载失败')
  }
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.page {
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
