<template>
  <view class="suggestion-page">
    <custom-nav-bar title="建议箱" />
    <scroll-view scroll-y class="main-scroll">
      <view class="intro-card">
        <text class="intro-title">您的声音，我们倾听</text>
        <text class="intro-desc">匿名提交建议和意见，区队干部会认真处理每一条反馈</text>
      </view>

      <button class="submit-entry" @tap="goSubmit"><text class="entry-text">✉️ 提交建议</text></button>

      <view class="section-header"><text class="section-title">我的提交</text></view>

      <view class="sug-list">
        <view v-for="item in suggestions" :key="item.id" class="sug-card" @tap="goStatus(item)">
          <view :class="['status-bar', item.status]"></view>
          <view class="sug-body">
            <text class="sug-title">{{ item.title }}</text>
            <text class="sug-time">{{ item.time }}</text>
            <view :class="['status-tag', item.status]">{{ sugStatus(item.status) }}</view>
          </view>
        </view>

        <view v-if="suggestions.length === 0" class="empty-state"><text class="empty-text">暂无提交记录</text></view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const suggestions = ref([
  { id: 1, title: '希望增加自习室开放时间', time: '2026-04-03', status: 'processing' },
  { id: 2, title: '食堂菜品建议增加清淡口味', time: '2026-03-25', status: 'replied' }
])

function sugStatus(s) {
  if (s === 'processing') return '处理中'
  return '已回复'
}

function goSubmit() { uni.navigateTo({ url: '/pages/suggestion/submit' }) }
function goStatus(item) { uni.navigateTo({ url: `/pages/suggestion/status?id=${item.id}` }) }
</script>

<style lang="scss" scoped
> .suggestion-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.intro-card {
  margin: 24rpx 32rpx; padding: 28rpx 24rpx; background: linear-gradient(135deg, rgba(0,30,64,0.04), rgba(0,51,102,0.02));
  border-radius: 20rpx; border-left: 8rpx solid #003366;
}
.intro-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 10rpx; }
.intro-desc { font-size: 25rpx; color: #43474f; line-height: 1.5; }

.submit-entry {
  margin: 20rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center;
  &::after { display: none; } &:active { opacity: 0.9; }
}
.entry-text { font-size: 28rpx; font-weight: 600; color: #fff; }

.section-header { padding: 0 32rpx; margin-top: 28rpx; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: #191c1e; }

.sug-list { padding: 0 32rpx; }
.sug-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.status-bar {
  width: 10rpx; flex-shrink: 0;
  &.processing { background: #466270; }
  &.replied { background: #003366; }
}
.sug-body { flex: 1; padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.sug-title { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.sug-time { font-size: 22rpx; color: #c3c6d1; white-space: nowrap; }
.status-tag {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.processing { background: rgba(70,98,112,0.08); color: #466270; }
  &.replied { background: rgba(0,30,64,0.06); color: #001e40; }
}

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>