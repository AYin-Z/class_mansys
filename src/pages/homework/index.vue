<template>
  <view class="homework-page">
    <custom-nav-bar title="作业管理" />
    <scroll-view scroll-y class="main-scroll">
      <view class="tab-row">
        <view :class="['tab-item', { active: currentTab === 'list' }]" @tap="currentTab = 'list'"><text class="tab-text">作业列表</text></view>
        <view :class="['tab-item', { active: currentTab === 'submit' }]" @tap="currentTab = 'submit'"><text class="tab-text">我的提交</text></view>
      </view>

      <!-- Homework List -->
      <view v-if="currentTab === 'list'" class="hw-list">
        <view v-for="item in homeworks" :key="item.id" class="hw-card" @tap="goDetail(item)">
          <view :class="['status-dot', item.status]"></view>
          <view class="hw-body">
            <text class="hw-title">{{ item.title }}</text>
            <text class="hw-course">{{ item.course }}</text>
            <view class="hw-meta">
              <text class="meta-deadline">截止：{{ item.deadline }}</text>
              <view :class="['status-tag', item.status]">{{ hwStatus(item.status) }}</view>
            </view>
          </view>
        </view>
      </view>

      <!-- My Submissions -->
      <view v-else class="sub-list">
        <view v-for="item in submissions" :key="item.id" class="sub-card">
          <text class="sub-title">{{ item.title }}</text>
          <text class="sub-time">提交于 {{ item.time }}</text>
          <view :class="['score-tag', item.scored ? 'scored' : 'pending']">{{ item.scored ? `评分：${item.score}分` : '待批改' }}</view>
        </view>

        <view v-if="submissions.length === 0" class="empty-state"><text class="empty-text">暂无提交记录</text></view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const currentTab = ref('list')
const homeworks = ref([
  { id: 1, title: '第三章习题', course: '高等数学', deadline: '2026-04-12', status: 'active' },
  { id: 2, title: '实验报告三', course: '大学物理', deadline: '2026-04-15', status: 'active' },
  { id: 3, title: '英语作文', course: '大学英语', deadline: '2026-04-08', status: 'expired' }
])

const submissions = ref([
  { id: 1, title: '第二章习题', time: '2026-04-05 22:30', scored: true, score: 92 },
  { id: 2, title: '实验报告二', time: '2026-04-03 18:00', scored: false }
])

function hwStatus(s) {
  if (s === 'active') return '进行中'
  return '已截止'
}

function goDetail(item) { uni.navigateTo({ url: `/pages/homework/detail?id=${item.id}` }) }
</script>

<style lang="scss" scoped
> .homework-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.tab-row { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: #fff; }
.tab-item { flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center; justify-content: center; &.active { background: #001e40; .tab-text { color: #fff; } } }
.tab-text { font-size: 28rpx; font-weight: 500; color: #43474f; }

.hw-list { padding: 24rpx 32rpx; }
.hw-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.status-dot {
  width: 10rpx; flex-shrink: 0;
  &.active { background: #466270; }
  &.expired { background: #c3c6d1; }
}
.hw-body { flex: 1; padding: 22rpx 24rpx; }
.hw-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 6rpx; }
.hw-course { font-size: 23rpx; color: #c3c6d1; display: block; margin-bottom: 10rpx; }
.hw-meta { display: flex; align-items: center; justify-content: space-between; }
.meta-deadline { font-size: 23rpx; color: #43474f; }
.status-tag {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.08); color: #466270; }
  &.expired { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.sub-list { padding: 24rpx 32rpx; }
.sub-card { background: #fff; border-radius: 18rpx; padding: 24rpx; margin-bottom: 14rpx; }
.sub-title { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; margin-bottom: 8rpx; }
.sub-time { font-size: 22rpx; color: #c3c6d1; display: block; margin-bottom: 12rpx; }
.score-tag {
  display: inline-block; padding: 6rpx 16rpx; border-radius: 999rpx; font-size: 21rpx; font-weight: 600;
  &.scored { background: rgba(0,30,64,0.06); color: #001e40; }
  &.pending { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>