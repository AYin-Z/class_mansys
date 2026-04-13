<template>
  <view class="challenge-page">
    <custom-nav-bar title="擂台挑战" />
    <scroll-view scroll-y class="main-scroll">
      <view class="category-tabs">
        <view v-for="cat in categories" :key="cat.key" :class="['cat-tab', { active: currentCat === cat.key }]" @tap="currentCat = cat.key">
          <text class="cat-icon">{{ cat.icon }}</text>
          <text class="cat-label">{{ cat.label }}</text>
        </view>
      </view>

      <view class="challenge-list">
        <view v-for="item in challenges" :key="item.id" class="challenge-card" @tap="goDetail(item)">
          <view class="card-header">
            <view :class="['type-badge', item.type]">{{ typeName(item.type) }}</view>
            <view :class="['status-badge', item.status]">{{ statusName(item.status) }}</view>
          </view>
          <text class="ch-title">{{ item.title }}</text>
          <view class="ch-meta">
            <text class="meta-item">发起人：{{ item.challenger }}</text>
            <text class="meta-item">截止：{{ item.deadline }}</text>
          </view>
          <view class="progress-row" v-if="item.status === 'active'">
            <view class="progress-bar-sm"><view class="progress-fill" :style="{ width: item.progress + '%' }"></view></view>
            <text class="progress-text">{{ item.votes }}票</text>
          </view>
        </view>

        <view v-if="challenges.length === 0" class="empty-state"><text class="empty-text">暂无挑战</text></view>
      </view>

      <button class="create-btn" @tap="goCreate"><text class="create-text">+ 发起挑战</text></button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const currentCat = ref('study')
const categories = [
  { key: 'study', icon: '📚', label: '学习' },
  { key: 'discipline', icon: '📋', label: '纪律' },
  { key: 'fitness', icon: '💪', label: '体能' }
]

const challenges = ref([
  { id: 1, type: 'study', status: 'active', title: '高数月考挑战赛', challenger: '学习副区', deadline: '2026-04-20', votes: 12, progress: 60 },
  { id: 2, type: 'discipline', status: 'active', title: '全勤打卡挑战', challenger: '区队长', deadline: '2026-04-30', votes: 8, progress: 40 },
  { id: 3, type: 'fitness', status: 'ended', title: '5公里跑步挑战', challenger: '体育委员', deadline: '2026-04-01', votes: 15, progress: 100 }
])

function typeName(t) { const map = { study: '学习', discipline: '纪律', fitness: '体能' }; return map[t] || t }
function statusName(s) { const map = { active: '进行中', ended: '已结束' }; return map[s] || s }
function goDetail(item) { uni.navigateTo({ url: `/pages/challenge/detail?id=${item.id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/challenge/apply' }) }
</script>

<style lang="scss" scoped
> .challenge-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.category-tabs {
  display: flex; gap: 16rpx; padding: 20rpx 32rpx;
}
.cat-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  padding: 20rpx 12rpx; background: #fff; border-radius: 18rpx;
  &.active { background: linear-gradient(135deg, #001e40, #003366); .cat-icon, .cat-label { color: #fff; filter: grayscale(0); } }
}
.cat-icon { font-size: 36rpx; }
.cat-label { font-size: 24rpx; font-weight: 500; color: #43474f; }

.challenge-list { padding: 24rpx 32rpx; }

.challenge-card {
  background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; margin-bottom: 16rpx;
  &:active { opacity: 0.85; }
}
.card-header { display: flex; gap: 10rpx; margin-bottom: 14rpx; }
.type-badge {
  padding: 4rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.study { background: rgba(0,30,64,0.06); color: #001e40; }
  &.discipline { background: rgba(70,98,112,0.08); color: #466270; }
  &.fitness { background: rgba(70,0,2,0.05); color: #460002; }
}
.status-badge {
  padding: 4rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.1); color: #466270; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.ch-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 12rpx; }
.ch-meta { display: flex; gap: 20rpx; margin-bottom: 16rpx; flex-wrap: wrap; }
.meta-item { font-size: 22rpx; color: #c3c6d1; }

.progress-row { display: flex; align-items: center; gap: 12rpx; }
.progress-bar-sm { flex: 1; height: 10rpx; background: #f2f4f7; border-radius: 5rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 5rpx; }
.progress-text { font-size: 22rpx; color: #001e40; font-weight: 600; white-space: nowrap; }

.create-btn {
  margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none;
  display: flex; align-items: center; justify-content: center; &::after { display: none; }
  &:active { background: #eceef1; }
}
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>