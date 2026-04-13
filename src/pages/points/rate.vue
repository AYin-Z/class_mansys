<template>
  <view class="rate-page">
    <custom-nav-bar title="评分标准" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view v-for="cat in categories" :key="cat.key" class="category-card">
        <text class="cat-title">{{ cat.title }}</text>
        <view v-for="item in cat.items" :key="item.name" class="rate-row">
          <text class="rate-name">{{ item.name }}</text>
          <text :class="['rate-val', item.type]">{{ item.type === 'add' ? '+' : '' }}{{ item.points }}</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const categories = ref([
  {
    key: 'discipline', title: '纪律表现',
    items: [
      { name: '全勤打卡', points: 10, type: 'add' },
      { name: '迟到/早退', points: 3, type: 'minus' },
      { name: '旷课', points: 10, type: 'minus' }
    ]
  },
  {
    key: 'activity', title: '活动参与',
    items: [
      { name: '参加区队活动', points: 5, type: 'add' },
      { name: '组织活动', points: 8, type: 'add' },
      { name: '无故缺席', points: 3, type: 'minus' }
    ]
  },
  {
    key: 'study', title: '学习表现',
    items: [
      { name: '作业全交', points: 5, type: 'add' },
      { name: '考试进步', points: 10, type: 'add' },
      { name: '作业缺交', points: 2, type: 'minus' }
    ]
  }
])
</script>

<style lang="scss" scoped
> .rate-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.category-card {
  margin: 20rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 24rpx 24rpx;
}
.cat-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 16rpx; padding-bottom: 14rpx; border-bottom: 2rpx solid #f2f4f7; }

.rate-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.rate-name { font-size: 26rpx; color: #191c1e; }
.rate-val {
  font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 700;
  &.add { color: #001e40; }
  &.minus { color: #460002; }
}
</style>