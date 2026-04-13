<template>
  <view class="detail-page">
    <custom-nav-bar title="抽奖详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="lottery-info">
        <text class="l-title">{{ lottery.name }}</text>
        <text class="l-desc">{{ lottery.desc }}</text>
        <view class="info-grid">
          <view class="info-item"><text class="info-val">{{ lottery.joined }}/{{ lottery.total }}</text><text class="info-label">参与人数</text></view>
          <view class="info-item"><text class="info-val">{{ lottery.prizes }}</text><text class="info-label">奖品数量</text></view>
          <view class="info-item"><text class="info-val">{{ lottery.deadline }}</text><text class="info-label">截止时间</text></view>
        </view>

        <view class="prize-list-section">
          <text class="section-sub">奖品清单</text>
          <view v-for="(p, idx) in prizes" :key="idx" class="prize-row">
            <text class="prize-rank">{{ p.rank }}</text>
            <text class="prize-name">{{ p.name }}</text>
            <text class="prize-count">×{{ p.count }}</text>
          </view>
        </view>
      </view>

      <button class="join-btn" v-if="!joined && lottery.status === 'active'" @click="joinLottery">参与抽奖</button>
      <view class="joined-tag" v-else-if="joined">✓ 已参与</view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
const joined = ref(false)
const lottery = ref({ name: '月度幸运抽奖', desc: '精美礼品等你来拿', joined: 18, total: 32, prizes: 5, deadline: '2026-04-15', status: 'active' })
const prizes = ref([
  { rank: '一等奖', name: '蓝牙耳机', count: 1 },
  { rank: '二等奖', name: '充电宝', count: 2 },
  { rank: '三等奖', name: '笔记本', count: 2 }
])
function joinLottery() {
  uni.showModal({
    title: '确认参与',
    content: '确定参加本次抽奖？',
    success: (res) => {
      if (res.confirm) { joined.value = true; uni.showToast({ title: '已参与', icon: 'success' }) }
    }
  })
}
</script>

<style lang="scss" scoped
> .detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.lottery-info { margin: 24rpx 32rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 22rpx; padding: 32rpx 28rpx; }
.l-title { font-family: 'PingFang SC'; font-size: 36rpx; font-weight: 700; color: #fff; display: block; margin-bottom: 10rpx; }
.l-desc { font-size: 26rpx; color: rgba(255,255,255,0.7); display: block; margin-bottom: 24rpx; }

.info-grid { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.info-item { flex: 1; text-align: center; }
.info-val { display: block; font-size: 28rpx; font-weight: 700; color: #fff; margin-bottom: 4rpx; }
.info-label { font-size: 21rpx; color: rgba(255,255,255,0.6); }

.prize-list-section { border-top: 1rpx solid rgba(255,255,255,0.15); padding-top: 20rpx; }
.section-sub { font-size: 25rpx; font-weight: 600; color: rgba(255,255,255,0.85); display: block; margin-bottom: 16rpx; }
.prize-row { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 0; }
.prize-rank { font-size: 24rpx; font-weight: 600; color: rgba(255,255,255,0.8); width: 90rpx; }
.prize-name { flex: 1; font-size: 26rpx; color: #fff; }
.prize-count { font-size: 24rpx; color: rgba(255,255,255,0.6); }

.join-btn { margin: 28rpx 32rpx; height: 88rpx; background: #fff; border-radius: 44rpx; border: none; font-size: 29rpx; font-weight: 700; color: #001e40; &::after { display: none; } }
.joined-tag { margin: 28rpx 32rpx; text-align: center; padding: 24rpx; background: rgba(70,98,112,0.06); border-radius: 18rpx; font-size: 27rpx; font-weight: 600; color: #466270; }
</style>