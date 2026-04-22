<template>
  <view class="records-page">
    <custom-nav-bar title="经费记录" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="filter-row">
        <view :class="['filter-chip', { active: filter === 'all' }]" @tap="filter = 'all'">全部</view>
        <view :class="['filter-chip', { active: filter === 'approved' }]" @tap="filter = 'approved'">已通过</view>
        <view :class="['filter-chip', { active: filter === 'pending' }]" @tap="filter = 'pending'">待审批</view>
        <view :class="['filter-chip', { active: filter === 'rejected' }]" @tap="filter = 'rejected'">已驳回</view>
      </view>

      <view class="record-list">
        <view v-for="(group, gIdx) in groupedRecords" :key="gIdx" class="record-group">
          <text class="group-date">{{ group.date }}</text>
          <view v-for="item in group.items" :key="item.id" class="record-card">
            <view :class="['status-dot', item.status]"></view>
            <view class="record-main">
              <text class="record-title">{{ item.title }}</text>
              <text class="record-applicant">{{ item.applicant }}</text>
            </view>
            <view class="record-right">
              <text class="record-amount">¥{{ item.amount }}</text>
              <text :class="['record-status', item.status]">{{ statusText(item.status) }}</text>
            </view>
          </view>
        </view>

        <view v-if="filteredRecords.length === 0" class="empty-state">
          <text class="empty-text">暂无记录</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const filter = ref('all')

const allRecords = ref([
  { id: 1, date: '2026-04-09', title: '购买班级活动物资', applicant: '张三', amount: '320.00', status: 'pending' },
  { id: 2, date: '2026-04-08', title: '校外实践交通费', applicant: '李四', amount: '680.00', status: 'approved' },
  { id: 3, date: '2026-04-07', title: '打印学习资料', applicant: '王五', amount: '45.00', status: 'approved' },
  { id: 4, date: '2026-04-05', title: '购买清洁用品', applicant: '赵六', amount: '186.50', status: 'rejected' },
  { id: 5, date: '2026-04-01', title: '购买体育器材', applicant: '孙七', amount: '320.00', status: 'approved' }
])

const filteredRecords = computed(() => {
  if (filter.value === 'all') return allRecords.value
  return allRecords.value.filter(r => r.status === filter.value)
})

const groupedRecords = computed(() => {
  const map = {}
  filteredRecords.value.forEach(r => {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  })
  return Object.keys(map).map(date => ({ date, items: map[date] }))
})

function statusText(status) {
  const map = { approved: '已通过', pending: '待审批', rejected: '已驳回' }
  return map[status] || status
}
</script>

<style lang="scss" scoped>
.records-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.filter-row {
  display: flex; gap: 12rpx; padding: 20rpx 32rpx;
}
.filter-chip {
  height: 60rpx; padding: 0 28rpx; border-radius: 30rpx; display: flex; align-items: center;
  justify-content: center; background: #fff; font-size: 26rpx; font-weight: 500; color: #43474f;
  &.active { background: #001e40; color: #fff; }
}

.record-list { padding: 0 32rpx; }

.record-group { margin-bottom: 24rpx; }
.group-date {
  font-size: 24rpx; font-weight: 600; color: #c3c6d1; display: block; margin-bottom: 12rpx;
  padding-left: 4rpx;
}

.record-card {
  display: flex; align-items: center; gap: 16rpx; padding: 22rpx 0;
  border-bottom: 1rpx solid transparent;

  &:not(:last-child) { border-bottom-color: #f2f4f7; }
}
.status-dot {
  width: 10rpx; height: 10rpx; border-radius: 50%; flex-shrink: 0;
  &.approved { background: #003366; }
  &.pending { background: #466270; }
  &.rejected { background: #460002; }
}
.record-main { flex: 1; min-width: 0; }
.record-title { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; }
.record-applicant { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.record-right { text-align: right; flex-shrink: 0; }
.record-amount {
  font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; display: block; color: #001e40;
}
.record-status {
  font-size: 21rpx; display: block; margin-top: 4rpx;
  &.approved { color: #003366; }
  &.pending { color: #466270; }
  &.rejected { color: #460002; }
}

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
