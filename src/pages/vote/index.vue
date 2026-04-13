<template>
  <view class="vote-page">
    <custom-nav-bar title="投票" />
    <scroll-view scroll-y class="main-scroll">
      <view class="vote-list">
        <view v-for="item in votes" :key="item.id" class="vote-card" @tap="goDetail(item)">
          <view class="card-accent" :class="item.status"></view>
          <view class="card-body">
            <view class="card-top">
              <text class="vote-title">{{ item.title }}</text>
              <view :class="['status-badge', item.status]">{{ statusText(item.status) }}</view>
            </view>
            <text class="vote-desc">{{ item.desc }}</text>
            <view class="vote-meta">
              <text class="meta-item">{{ item.type === 'single' ? '单选' : '多选' }}</text>
              <text class="meta-dot">·</text>
              <text class="meta-item">{{ item.total }}人已参与</text>
              <text class="meta-dot">·</text>
              <text class="meta-item">{{ item.deadline }}</text>
            </view>
          </view>
        </view>

        <view v-if="votes.length === 0" class="empty-state"><text class="empty-text">暂无投票</text></view>
      </view>

      <button class="create-btn" @tap="goCreate"><text class="create-text">+ 创建投票</text></button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const votes = ref([
  { id: 1, title: '下学期班委选举', desc: '请为新一届班委成员投票', type: 'multiple', total: 25, deadline: '2026-04-15', status: 'active' },
  { id: 2, title: '春游地点选择', desc: '选择本学期春游目的地', type: 'single', total: 30, deadline: '2026-04-10', status: 'active' },
  { id: 3, title: '班级口号征集', desc: '选择你最喜欢的班级口号', type: 'single', total: 32, deadline: '2026-03-28', status: 'ended' }
])
function statusText(s) { return s === 'active' ? '进行中' : '已结束' }
function goDetail(item) { uni.navigateTo({ url: `/pages/vote/detail?id=${item.id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/vote/create' }) }
</script>

<style lang="scss" scoped
> .vote-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.vote-list { padding: 24rpx 32rpx; }

.vote-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; &:active { opacity: 0.85; } }
.card-accent {
  width: 10rpx; flex-shrink: 0;
  &.active { background: #466270; }
  &.ended { background: #c3c6d1; }
}
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.vote-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 600; color: #191c1e; flex: 1; }
.status-badge {
  padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.08); color: #466270; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}
.vote-desc { font-size: 25rpx; color: #43474f; margin-bottom: 16rpx; display: block; line-height: 1.5; }
.vote-meta { display: flex; gap: 10rpx; align-items: center; flex-wrap: wrap; }
.meta-item { font-size: 22rpx; color: #c3c6d1; }
.meta-dot { font-size: 22rpx; color: #e0e3e6; }

.create-btn { margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: #eceef1; } }
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>