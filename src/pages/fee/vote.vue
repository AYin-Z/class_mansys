<template>
  <view class="vote-page">
    <custom-nav-bar title="投票表决" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="active-vote-card" v-if="activeVote">
        <view class="vote-header">
          <view class="status-badge active">进行中</view>
          <text class="deadline">截止：{{ activeVote.deadline }}</text>
        </view>
        <text class="vote-title">{{ activeVote.title }}</text>
        <text class="vote-desc">{{ activeVote.description }}</text>

        <view class="progress-section">
          <view class="progress-header">
            <text class="progress-label">投票进度</text>
            <text class="progress-rate">{{ voteRate }}%</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: voteRate + '%' }"></view>
          </view>
          <view class="vote-stats">
            <text class="stat-item">同意 {{ agreeCount }} 票</text>
            <text class="stat-item">反对 {{ disagreeCount }} 票</text>
            <text class="stat-item">未投 {{ unvotedCount }} 人</text>
          </view>
        </view>

        <view class="vote-actions">
          <button :class="['vote-btn', { selected: myVote === 'agree' }, 'agree']" @click="castVote('agree')" :disabled="!!myVote">
            <text class="btn-icon">✓</text><text class="btn-text">同意</text>
          </button>
          <button :class="['vote-btn', { selected: myVote === 'disagree' }, 'disagree']" @click="castVote('disagree')" :disabled="!!myVote">
            <text class="btn-icon">✗</text><text class="btn-text">反对</text>
          </button>
        </view>

        <view class="threshold-info">
          <text class="threshold-text">通过门槛：≥2/3班干部同意（需{{ threshold }}票）</text>
        </view>
      </view>

      <view class="empty-state" v-else>
        <text class="empty-icon">🗳️</text>
        <text class="empty-title">暂无进行中的投票</text>
      </view>

      <!-- Vote History -->
      <view class="history-section">
        <text class="section-title">历史投票</text>
        <view class="history-list">
          <view v-for="item in historyVotes" :key="item.id" class="history-card">
            <view :class="['result-indicator', item.passed ? 'pass' : 'fail']"></view>
            <view class="history-body">
              <text class="history-title">{{ item.title }}</text>
              <text class="history-result">{{ item.passed ? '已通过' : '未通过' }} · {{ item.agree }}/{{ item.total }}票</text>
              <text class="history-time">{{ item.time }}</text>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const myVote = ref('')
const activeVote = ref({
  id: 1,
  title: '团建活动经费申请 ¥680.00',
  description: '用于本周末班级团建活动，包括聚餐和活动物料费用',
  deadline: '2026-04-11 18:00'
})

const agreeCount = ref(4)
const disagreeCount = ref(1)
const totalVoters = ref(7)
const unvotedCount = computed(() => totalVoters.value - agreeCount.value - disagreeCount.value - (myVote.value ? 1 : 0))
const voteRate = computed(() => {
  const total = agreeCount.value + disagreeCount.value + (myVote.value ? 1 : 0)
  return total > 0 ? Math.round((agreeCount.value + (myVote.value === 'agree' ? 1 : 0)) / total * 100) : 0
})
const threshold = computed(() => Math.ceil(totalVoters.value * 2 / 3))

function castVote(choice) {
  uni.showModal({
    title: '确认投票',
    content: `确定投${choice === 'agree' ? '同意' : '反对'}票？`,
    success: (res) => {
      if (res.confirm) {
        myVote.value = choice
        if (choice === 'agree') agreeCount.value++
        else disagreeCount.value++
        uni.showToast({ title: '投票成功', icon: 'success' })
      }
    }
  })
}

const historyVotes = ref([
  { id: 1, title: '购买清洁用品 ¥186.50', passed: true, agree: 6, total: 7, time: '2026-03-28' },
  { id: 2, title: '购买体育器材 ¥320.00', passed: false, agree: 3, total: 7, time: '2026-03-15' }
])
</script>

<style lang="scss" scoped>
.vote-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.active-vote-card {
  margin: 24rpx 32rpx; background: #fff; border-radius: 24rpx; overflow: hidden;
}
.vote-header { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 28rpx 0; }
.status-badge {
  padding: 8rpx 20rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.1); color: #466270; }
}
.deadline { font-size: 22rpx; color: #c3c6d1; }
.vote-title {
  font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #191c1e;
  padding: 20rpx 28rpx 12rpx;
}
.vote-desc { font-size: 26rpx; color: #43474f; line-height: 1.5; padding: 0 28rpx; }

.progress-section { margin: 28rpx; background: #f7f9fc; border-radius: 16rpx; padding: 24rpx; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 14rpx; }
.progress-label { font-size: 24rpx; color: #43474f; font-weight: 500; }
.progress-rate { font-family: 'PingFang SC'; font-size: 26rpx; font-weight: 700; color: #001e40; }
.progress-bar { height: 14rpx; background: #e6e8eb; border-radius: 7rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 7rpx; transition: width 0.3s; }
.vote-stats { display: flex; gap: 16rpx; margin-top: 14rpx; flex-wrap: wrap; }
.stat-item { font-size: 22rpx; color: #c3c6d1; }

.vote-actions { display: flex; gap: 16rpx; padding: 0 28rpx 24rpx; }
.vote-btn {
  flex: 1; height: 88rpx; border-radius: 18rpx; border: none; display: flex; align-items: center;
  justify-content: center; gap: 10rpx; transition: all 0.2s;

  &.agree { background: #f2f4f7; .btn-icon, .btn-text { color: #003366; } &.selected { background: linear-gradient(135deg, #001e40, #003366); .btn-icon, .btn-text { color: #fff; } } }
  &.disagree { background: #f2f4f7; .btn-icon, .btn-text { color: #460002; } &.selected { background: linear-gradient(135deg, #460002, #6e0006); .btn-icon, .btn-text { color: #fff; } } }

  &[disabled] { opacity: 0.6; }
  &:not([disabled]):active { transform: scale(0.97); }
}
.btn-icon { font-size: 30rpx; font-weight: 700; }
.btn-text { font-size: 28rpx; font-weight: 600; }

.threshold-info { padding: 0 28rpx 28rpx; }
.threshold-text { font-size: 22rpx; color: #c3c6d1; }

.empty-state { padding: 120rpx 48rpx; text-align: center; }
.empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-title { font-size: 28rpx; color: #c3c6d1; }

.history-section { margin: 40rpx 32rpx 0; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 20rpx; }
.history-list { display: flex; flex-direction: column; gap: 12rpx; }
.history-card { position: relative; display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; }
.result-indicator {
  width: 8rpx; flex-shrink: 0;
  &.pass { background: #003366; }
  &.fail { background: #460002; }
}
.history-body { flex: 1; padding: 20rpx 20rpx 20rpx 16rpx; }
.history-title { font-size: 27rpx; font-weight: 500; color: #191c1e; display: block; }
.history-result { font-size: 23rpx; color: #43474f; display: block; margin-top: 6rpx; }
.history-time { font-size: 21rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
</style>