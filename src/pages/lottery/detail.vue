<template>
  <view class="detail-page">
    <custom-nav-bar title="抽奖详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view v-if="lottery" class="lottery-info">
        <text class="l-title">{{ lottery.name }}</text>
        <text class="l-desc">{{ lottery.description || '' }}</text>
        <view class="info-grid">
          <view class="info-item"><text class="info-val">{{ participantCount }}</text><text class="info-label">参与人数</text></view>
          <view class="info-item"><text class="info-val">{{ lottery.winner_count || 0 }}</text><text class="info-label">中奖人数</text></view>
          <view class="info-item"><text class="info-val">{{ formatDate(lottery.end_time) }}</text><text class="info-label">截止时间</text></view>
        </view>

        <view class="prize-list-section">
          <text class="section-sub">活动规则</text>
          <text class="rules-text">{{ lottery.rules }}</text>
        </view>
      </view>

      <button class="join-btn" v-if="canJoin" @click="join">参与抽奖</button>
      <view class="joined-tag" v-else-if="myRecord">
        {{ myRecord.is_winner ? `🏆 已中奖：${myRecord.prize || '神秘奖品'}` : '✓ 已参与，未中奖' }}
      </view>

      <view v-if="isAdminUser && lottery" class="info-card">
        <text class="section-label">管理员操作</text>
        <view class="btn-row">
          <button class="action-btn" @tap="openDraw" v-if="lottery.is_active">开奖</button>
          <button class="action-btn" @tap="closeNow" v-if="lottery.is_active">关闭</button>
        </view>
      </view>

      <view v-if="winners.length" class="info-card">
        <text class="section-label">中奖名单</text>
        <view v-for="w in winners" :key="w.id" class="winner-row">
          <text class="winner-name">🏆 {{ w.user_name }}</text>
          <text class="winner-prize">{{ w.prize || '神秘奖品' }}</text>
        </view>
      </view>

      <view style="height: 80rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getLotteryDetail, joinLottery, drawLottery, closeLottery } from '@/api/lottery'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const id = ref(null)
const lottery = ref(null)
const participants = ref([])
const myRecord = ref(null)

const participantCount = computed(() => participants.value.length)
const winners = computed(() => participants.value.filter(p => p.is_winner))
const canJoin = computed(() => lottery.value?.is_active && !myRecord.value)

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetch() {
  if (!id.value) return
  try {
    const res = await getLotteryDetail(id.value)
    lottery.value = res.lottery
    participants.value = res.participants || []
    myRecord.value = res.myRecord || null
  } catch (_) {}
}

async function join() {
  uni.showModal({
    title: '确认参与',
    content: '确定参加本次抽奖？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await joinLottery(id.value)
        uni.showToast({ title: '已参与', icon: 'success' })
        fetch()
      } catch (_) {}
    }
  })
}

function openDraw() {
  uni.showModal({
    title: '开奖',
    editable: true,
    placeholderText: '请输入中奖人数',
    success: async (r) => {
      if (!r.confirm) return
      const winnerCount = Number(r.content)
      if (!Number.isFinite(winnerCount) || winnerCount <= 0) {
        uni.showToast({ title: '人数无效', icon: 'none' }); return
      }
      try {
        await drawLottery(id.value, { winner_count: winnerCount, prize: '神秘奖品' })
        uni.showToast({ title: '开奖成功', icon: 'success' })
        fetch()
      } catch (_) {}
    }
  })
}

async function closeNow() {
  try {
    await closeLottery(id.value)
    uni.showToast({ title: '已关闭', icon: 'success' })
    fetch()
  } catch (_) {}
}

onLoad((opts) => { id.value = Number(opts?.id) || null })
onShow(() => fetch())
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.lottery-info { margin: 24rpx 32rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 22rpx; padding: 32rpx 28rpx; }
.l-title { font-size: 36rpx; font-weight: 700; color: #fff; display: block; margin-bottom: 10rpx; }
.l-desc { font-size: 26rpx; color: rgba(255,255,255,0.7); display: block; margin-bottom: 24rpx; }

.info-grid { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.info-item { flex: 1; text-align: center; }
.info-val { display: block; font-size: 28rpx; font-weight: 700; color: #fff; margin-bottom: 4rpx; }
.info-label { font-size: 21rpx; color: rgba(255,255,255,0.6); }

.prize-list-section { border-top: 1rpx solid rgba(255,255,255,0.15); padding-top: 20rpx; }
.section-sub { font-size: 25rpx; font-weight: 600; color: rgba(255,255,255,0.85); display: block; margin-bottom: 12rpx; }
.rules-text { font-size: 24rpx; color: rgba(255,255,255,0.85); line-height: 1.6; }

.join-btn { margin: 28rpx 32rpx; height: 88rpx; background: #fff; border-radius: 44rpx; border: none; font-size: 29rpx; font-weight: 700; color: #001e40; &::after { display: none; } }
.joined-tag { margin: 28rpx 32rpx; text-align: center; padding: 24rpx; background: rgba(70,98,112,0.06); border-radius: 18rpx; font-size: 27rpx; font-weight: 600; color: #466270; }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 24rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.btn-row { display: flex; gap: 16rpx; }
.action-btn { flex: 1; height: 80rpx; background: #f2f4f7; color: #001e40; font-size: 26rpx; border-radius: 14rpx; border: none; }
.winner-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-top: 1rpx solid #f2f4f7; }
.winner-row:first-of-type { border-top: none; }
.winner-name { font-size: 26rpx; color: #191c1e; font-weight: 500; }
.winner-prize { font-size: 24rpx; color: #466270; }
</style>
