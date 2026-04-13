<template>
  <view class="lottery-page">
    <custom-nav-bar title="抽奖活动" />
    <scroll-view scroll-y class="main-scroll">
      <view class="active-lottery" v-if="currentLottery">
        <text class="section-label">进行中</text>
        <view class="lottery-card" @tap="goDetail(currentLottery)">
          <view class="prize-area">
            <text class="prize-icon">🎁</text>
            <view class="prize-info">
              <text class="prize-name">{{ currentLottery.name }}</text>
              <text class="prize-desc">{{ currentLottery.desc }}</text>
            </view>
          </view>
          <view class="lottery-meta">
            <text class="meta-item">已参与 {{ currentLottery.joined }}/{{ currentLottery.total }} 人</text>
            <text class="meta-dot">·</text>
            <text class="meta-item">截止 {{ currentLottery.deadline }}</text>
          </view>
          <view class="progress-row">
            <view class="progress-bar"><view class="progress-fill" :style="{ width: (currentLottery.joined / currentLottery.total * 100) + '%' }"></view></view>
            <text class="progress-pct">{{ Math.round(currentLottery.joined / currentLottery.total * 100) }}%</text>
          </view>
          <button class="join-btn" @click.stop="joinLottery">立即参与</button>
        </view>
      </view>

      <view class="history-section">
        <text class="section-label">历史记录</text>
        <view v-for="item in history" :key="item.id" class="hist-card" @tap="goDetail(item)">
          <view class="hist-body">
            <text class="hist-name">{{ item.name }}</text>
            <text class="hist-time">{{ item.time }}</text>
            <view :class="['hist-status', item.won ? 'won' : 'lost']">{{ item.won ? '🏆 中奖' : '未中奖' }}</view>
          </view>
        </view>

        <view v-if="history.length === 0" class="empty-state"><text class="empty-text">暂无抽奖记录</text></view>
      </view>

      <button class="create-btn" v-if="isAdmin" @tap="goCreate"><text class="create-text">+ 创建抽奖</text></button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const isAdmin = ref(true)
const currentLottery = ref({
  id: 1, name: '月度幸运抽奖', desc: '精美礼品等你来拿', joined: 18, total: 32, deadline: '2026-04-15'
})
const history = ref([
  { id: 2, name: '开学季抽奖', time: '2026-03-01', won: false },
  { id: 3, name: '元旦抽奖', time: '2025-12-31', won: true }
])

function goDetail(item) { uni.navigateTo({ url: `/pages/lottery/detail?id=${item.id}` }) }
function joinLottery() {
  uni.showModal({
    title: '确认参与',
    content: '确定参加本次抽奖？',
    success: (res) => {
      if (res.confirm) { currentLottery.value.joined++; uni.showToast({ title: '已参与', icon: 'success' }) }
    }
  })
}
function goCreate() { uni.navigateTo({ url: '/pages/lottery/create' }) }
</script>

<style lang="scss" scoped
> .lottery-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; display: block; margin-bottom: 16rpx; }

.active-lottery { padding: 24rpx 32rpx; }
.lottery-card {
  background: linear-gradient(135deg, #001e40, #003366); border-radius: 22rpx;
  padding: 32rpx 28rpx; &:active { opacity: 0.9; }
}
.prize-area { display: flex; align-items: center; gap: 20rpx; margin-bottom: 20rpx; }
.prize-icon { font-size: 56rpx; }
.prize-info { flex: 1; }
.prize-name { font-family: 'PingFang SC'; font-size: 33rpx; font-weight: 700; color: #fff; display: block; }
.prize-desc { font-size: 25rpx; color: rgba(255,255,255,0.7); display: block; margin-top: 4rpx; }

.lottery-meta { display: flex; gap: 10rpx; align-items: center; flex-wrap: wrap; margin-bottom: 14rpx; }
.meta-item { font-size: 23rpx; color: rgba(255,255,255,0.75); }
.meta-dot { font-size: 23rpx; color: rgba(255,255,255,0.4); }

.progress-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 22rpx; }
.progress-bar { flex: 1; height: 10rpx; background: rgba(255,255,255,0.15); border-radius: 5rpx; overflow: hidden; }
.progress-fill { height: 100%; background: #fff; border-radius: 5rpx; transition: width 0.3s; }
.progress-pct { font-size: 23rpx; color: #fff; font-weight: 600; white-space: nowrap; }

.join-btn {
  width: 100%; height: 84rpx; background: #fff; border-radius: 42rpx; border: none;
  font-size: 29rpx; font-weight: 700; color: #001e40; &::after { display: none; } &:active { transform: scale(0.97); }
}

.history-section { padding: 0 32rpx; margin-top: 28rpx; }
.hist-card { background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.hist-body { padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.hist-name { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.hist-time { font-size: 22rpx; color: #c3c6d1; white-space: nowrap; }
.hist-status {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 21rpx; font-weight: 600;
  &.won { background: rgba(70,98,112,0.08); color: #466270; }
  &.lost { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}

.create-btn { margin: 24rpx 32rpx; height: 88rpx; background: #f2f4f7; border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: #eceef1; } }
.create-text { font-size: 28rpx; font-weight: 600; color: #001e40; }

.empty-state { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>