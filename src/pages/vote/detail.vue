<template>
  <view class="detail-page">
    <custom-nav-bar title="投票详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view v-if="vote.id" class="vote-info">
        <text class="vote-title">{{ vote.title }}</text>
        <text v-if="vote.description" class="vote-desc">{{ vote.description }}</text>
        <view class="meta-row">
          <view :class="['status-badge', status]">{{ statusText(status) }}</view>
          <text class="meta-text">{{ isSingle ? '单选' : '多选' }} · {{ totalVotes }}票</text>
        </view>
        <text class="period">{{ formatTime(vote.start_time) }} 至 {{ formatTime(vote.end_time) }}</text>
        <view class="scope-row">
          <view class="scope-tag visible">{{ vote.visible_scope === 'admin' ? '仅班干部可见' : '全部可见' }}</view>
          <view class="scope-tag votable">{{ vote.vote_scope === 'admin' ? '仅班干部可投' : '全部可投' }}</view>
        </view>
      </view>

      <view class="options-section">
        <text class="section-label">投票选项</text>
        <view v-for="opt in options" :key="opt.id"
              :class="['option-card', { selected: isSelected(opt.id), voted: hasVoted }]"
              @tap="selectOption(opt.id)">
          <view class="option-header">
            <view :class="['mark', isSingle ? 'radio' : 'check', { selected: isSelected(opt.id) }]"></view>
            <text class="option-label">{{ opt.content }}</text>
            <text v-if="showResults" class="option-count">{{ opt.vote_count }}票</text>
          </view>
          <view v-if="showResults" class="progress-bar-sm">
            <view class="progress-fill" :style="{ width: (opt.rate || 0) + '%' }"></view>
          </view>
          <text v-if="showResults" class="rate-text">{{ opt.rate || 0 }}%</text>
        </view>
      </view>

      <button v-if="canVote" class="submit-btn" :disabled="loading" @click="onCastVote">
        {{ hasVoted ? (isSingle ? '修改投票' : '已投票') : (loading ? '提交中…' : '提交投票') }}
      </button>

      <button v-if="canClose" class="close-btn" @click="onClose">关闭投票</button>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getVoteDetail, castVote, closeVote, isVoteSingle, getVoteStatus } from '@/api/vote'
import { isAdmin } from '@/utils/auth'

const vote = ref({})
const options = ref([])
const myChoices = ref([])
const totalVotes = ref(0)
const selectedIds = ref([])
const loading = ref(false)
const isAdminUser = ref(false)

const isSingle = computed(() => isVoteSingle(vote.value || { type: 'single' }))
const status = computed(() => vote.value?.id ? getVoteStatus(vote.value) : 'pending')
const hasVoted = computed(() => myChoices.value.length > 0)
const showResults = computed(() => hasVoted.value || status.value === 'ended' || isAdminUser.value)
const canVote = computed(() => {
  if (status.value !== 'active') return false
  if (vote.value?.vote_scope === 'admin' && !isAdminUser.value) return false
  return true
})
const canClose = computed(() => isAdminUser.value && vote.value?.is_active)

function isSelected(id) {
  return selectedIds.value.includes(id)
}

function selectOption(id) {
  if (!canVote.value) return
  if (isSingle.value) {
    selectedIds.value = [id]
  } else {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  }
}

function statusText(s) {
  if (s === 'pending') return '未开始'
  if (s === 'active') return '进行中'
  return '已结束'
}

function formatTime(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 16).replace('T', ' ')
}

async function fetchDetail(id) {
  try {
    const res = await getVoteDetail(id)
    if (res?.success) {
      vote.value = res.vote || {}
      options.value = res.options || []
      myChoices.value = res.my_choices || []
      selectedIds.value = [...myChoices.value]
      totalVotes.value = res.total_votes || 0
    }
  } catch (e) {}
}

async function onCastVote() {
  if (selectedIds.value.length === 0) {
    uni.showToast({ title: '请选择选项', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await castVote(vote.value.id, selectedIds.value)
    uni.showToast({ title: '投票成功', icon: 'success' })
    fetchDetail(vote.value.id)
  } catch (e) {}
  finally { loading.value = false }
}

function onClose() {
  uni.showModal({
    title: '关闭投票', content: '关闭后将无法继续投票，确认？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await closeVote(vote.value.id)
        uni.showToast({ title: '已关闭', icon: 'success' })
        fetchDetail(vote.value.id)
      } catch (e) {}
    }
  })
}

onLoad((opts) => {
  isAdminUser.value = isAdmin()
  if (opts?.id) fetchDetail(Number(opts.id))
})
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.vote-info { margin: 24rpx 32rpx; padding: 28rpx 24rpx; background: #fff; border-radius: 20rpx; }
.vote-title { font-family: 'PingFang SC'; font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 12rpx; }
.vote-desc { font-size: 26rpx; color: #43474f; line-height: 1.5; display: block; margin-bottom: 16rpx; }
.status-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.pending { background: rgba(70,98,112,0.08); color: #466270; }
  &.active { background: rgba(0,30,64,0.06); color: #001e40; }
  &.ended { background: rgba(195,198,209,0.2); color: #c3c6d1; }
}
.meta-row { display: flex; align-items: center; gap: 14rpx; margin-bottom: 10rpx; }
.meta-text { font-size: 24rpx; color: #466270; }
.period { font-size: 22rpx; color: #c3c6d1; display: block; }
.scope-row { display: flex; gap: 10rpx; margin-top: 14rpx; }
.scope-tag {
  padding: 4rpx 16rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 500;
  &.visible { background: rgba(70,98,112,0.06); color: #466270; }
  &.votable { background: rgba(0,30,64,0.06); color: #001e40; }
}

.options-section { margin: 0 32rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 4rpx; display: block; margin-bottom: 18rpx; }

.option-card { position: relative; background: #fff; border-radius: 16rpx; padding: 22rpx 24rpx; margin-bottom: 14rpx; &:active { opacity: 0.85; } &.selected { background: linear-gradient(135deg, rgba(0,30,64,0.04), rgba(0,51,102,0.02)); } }
.option-header { display: flex; align-items: center; gap: 14rpx; }
.mark {
  width: 36rpx; height: 36rpx; border: 3rpx solid #e0e3e6;
  flex-shrink: 0; transition: all 0.2s;
}
.radio { border-radius: 50%; }
.check { border-radius: 8rpx; }
.mark.selected { border-color: #001e40; background: linear-gradient(135deg, #001e40, #003366); box-shadow: inset 0 0 0 5rpx #fff; }
.rate-text { display: block; font-size: 22rpx; color: #466270; margin-top: 6rpx; text-align: right; font-weight: 600; }
.close-btn { margin: 12rpx 32rpx 0; height: 80rpx; background: #f2f4f7; border-radius: 16rpx; border: none; font-size: 26rpx; color: #460002; font-weight: 600; &::after { display: none; } }
.option-label { flex: 1; font-size: 28rpx; font-weight: 500; color: #191c1e; }
.option-count { font-size: 24rpx; color: #001e40; font-weight: 600; }
.progress-bar-sm { height: 8rpx; background: #f2f4f7; border-radius: 4rpx; overflow: hidden; margin-top: 14rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 4rpx; }

.submit-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
</style>
