<template>
  <div class="records-page">
    <custom-nav-bar title="收支记录" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="filter-row">
        <div :class="['filter-chip', { active: filter === 'all' }]" @tap="filter = 'all'">全部</div>
        <div :class="['filter-chip', { active: filter === 'income' }]" @tap="filter = 'income'">收入</div>
        <div :class="['filter-chip', { active: filter === 'expense' }]" @tap="filter = 'expense'">支出</div>
      </div>

      <div class="record-list">
        <div v-for="(group, gIdx) in groupedRecords" :key="gIdx" class="record-group">
          <span class="group-date">{{ group.date }}</span>
          <div v-for="item in group.items" :key="item.id" class="record-card">
            <div :class="['type-dot', item.type === '收入' ? 'income' : 'expense']"></div>
            <div class="record-main">
              <span class="record-title">{{ item.purpose || item.title }}</span>
              <span class="record-category">{{ item.type === '收入' ? '收缴' : (item.tier === 'small' ? '小额支出' : item.tier === 'medium' ? '中额支出' : '大额支出') }}</span>
            </div>
            <div class="record-right">
              <span :class="['record-amount', item.type === '收入' ? 'income' : 'expense']">
                {{ item.type === '收入' ? '+' : '-' }}¥{{ Number(item.amount).toFixed(2) }}
              </span>
              <span class="record-time">{{ formatTime(item.created_at) }}</span>
            </div>
          </div>
        </div>

        <div v-if="filteredRecords.length === 0" class="empty-state">
          <span class="empty-text">暂无记录</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { getAllExpenses } from '@/api/fee'
const filter = ref('all')
const expenses = ref([])

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const filteredRecords = computed(() => {
  let list = expenses.value
  if (filter.value === 'income') return list.filter(r => r.type === '收入')
  if (filter.value === 'expense') return list.filter(r => r.type === '支出')
  return list
})

const groupedRecords = computed(() => {
  const map = {}
  filteredRecords.value.forEach(r => {
    const date = r.created_at ? r.created_at.slice(0, 10) : '未知日期'
    if (!map[date]) map[date] = []
    map[date].push(r)
  })
  return Object.keys(map).map(date => ({ date, items: map[date] }))
})

onMounted(async () => {
  uni.showLoading({ title: '加载中...' })
  try {
    const res = await getAllExpenses()
    if (res.success) expenses.value = res.expenses
  } catch (err) {
    showToast('加载失败')
  } finally {
    
  }
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.records-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }
.filter-row { display: flex; gap: 12rpx; padding: 20rpx 32rpx; }
.filter-chip { height: 60rpx; padding: 0 28rpx; border-radius: 30rpx; display: flex; align-items: center; justify-content: center; background: #fff; font-size: 26rpx; font-weight: 500; color: #43474f; &.active { background: #001e40; color: #fff; } }
.record-list { padding: 0 32rpx; }
.record-group { margin-bottom: 24rpx; }
.group-date { font-size: 24rpx; font-weight: 600; color: #c3c6d1; display: block; margin-bottom: 12rpx; padding-left: 4rpx; }
.record-card { display: flex; align-items: center; gap: 16rpx; padding: 22rpx 0; border-bottom: 1rpx solid transparent; &:not(:last-child) { border-bottom-color: #f2f4f7; } }
.type-dot { width: 10rpx; height: 10rpx; border-radius: 50%; flex-shrink: 0; &.income { background: #003366; } &.expense { background: #460002; } }
.record-main { flex: 1; min-width: 0; }
.record-title { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; }
.record-category { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.record-right { text-align: right; flex-shrink: 0; }
.record-amount { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; display: block; &.income { color: #003366; } &.expense { color: #460002; } }
.record-time { font-size: 21rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
