<template>
  <view class="psy-page">
    <custom-nav-bar title="心理干预" />
    <scroll-view scroll-y class="main-scroll">
      <view class="intro-card">
        <view class="accent-bar"></view>
        <text class="intro-title">私密保护</text>
        <text class="intro-desc">所有申请均匿名处理，仅指定人员可查看，严格保护您的隐私</text>
      </view>

      <button class="apply-entry" @tap="goApply">
        <text class="entry-icon">🧠</text>
        <text class="entry-text">申请新的心理干预</text>
      </button>

      <view class="section-header"><text class="section-title">我的申请记录</text></view>

      <view class="app-list">
        <view v-for="item in apps" :key="item.id" class="app-card">
          <view :class="['status-bar', item.status]"></view>
          <view class="app-body">
            <text class="app-type">{{ item.type }}</text>
            <text class="app-time">{{ item.time }}</text>
            <view :class="['status-tag', item.status]">{{ statusText(item.status) }}</view>
          </view>
        </view>

        <view v-if="apps.length === 0" class="empty-state">
          <text class="empty-text">暂无申请记录</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const apps = ref([
  { id: 1, type: '情绪疏导', time: '2026-04-05', status: 'processing' },
  { id: 2, type: '学业压力', time: '2026-03-20', status: 'completed' }
])

function statusText(s) {
  if (s === 'processing') return '处理中'
  return '已完成'
}

function goApply() { uni.navigateTo({ url: '/pages/psychological/apply' }) }
</script>

<style lang="scss" scoped
> .psy-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.intro-card {
  position: relative; margin: 24rpx 32rpx; background: linear-gradient(135deg, rgba(0,30,64,0.03), rgba(0,51,102,0.02));
  border-radius: 20rpx; padding: 28rpx 24rpx; overflow: hidden;
}
.accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 10rpx; background: #003366; }
.intro-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 10rpx; }
.intro-desc { font-size: 25rpx; color: #43474f; line-height: 1.5; }

.apply-entry {
  display: flex; align-items: center; gap: 16rpx; margin: 24rpx 32rpx;
  padding: 28rpx 24rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx;
  border: none; &::after { display: none; } &:active { opacity: 0.9; }
}
.entry-icon { font-size: 40rpx; }
.entry-text { font-size: 29rpx; font-weight: 600; color: #fff; }

.section-header { padding: 0 32rpx; margin-top: 32rpx; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: #191c1e; }

.app-list { padding: 0 32rpx; }
.app-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; }
.status-bar {
  width: 10rpx; flex-shrink: 0;
  &.processing { background: #466270; }
  &.completed { background: #003366; }
}
.app-body { flex: 1; padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.app-type { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.app-time { font-size: 23rpx; color: #c3c6d1; }
.status-tag {
  padding: 6rpx 16rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.processing { background: rgba(70,98,112,0.08); color: #466270; }
  &.completed { background: rgba(0,30,64,0.06); color: #001e40; }
}

.empty-state { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>