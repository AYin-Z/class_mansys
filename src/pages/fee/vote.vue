<template>
  <div class="vote-page">
    <custom-nav-bar title="投票表决" :showBack="true" />
    <div scroll-y class="main-scroll">
      <!-- 进行中的投票 -->
      <div class="active-vote-card" v-if="activeVote">
        <div class="vote-header">
          <div class="status-badge active">进行中</div>
          <span class="deadline">截止：{{ formatTime(activeVote.end_time) }}</span>
        </div>
        <span class="vote-title">{{ activeVote.title }}</span>
        <span class="vote-desc" v-if="activeVote.description">{{ activeVote.description }}</span>

        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">投票进度</span>
            <span class="progress-rate">{{ voteRate }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: voteRate + '%' }"></div>
          </div>
          <div class="vote-stats">
            <span class="stat-item">总票数 {{ voteDetail.total_votes || 0 }} 票</span>
            <span class="stat-item">参与 {{ voteDetail.total_votes || 0 }} 人</span>
          </div>
        </div>

        <!-- 选项列表（单选/多选） -->
        <div class="options-section">
          <div
            v-for="opt in voteDetail.options"
            :key="opt.id"
            :class="['option-item', { selected: myChoices.includes(opt.id), voted: voteDetail.my_choices && voteDetail.my_choices.length > 0 }]"
            @click="selectOption(opt)"
          >
            <div class="option-label">
              <span class="option-marker">{{ myChoices.includes(opt.id) ? '✓' : '' }}</span>
            </div>
            <div class="option-content">
              <span class="option-text">{{ opt.content }}</span>
              <span class="option-count" v-if="voteDetail.total_votes">({{ opt.vote_count }}票)</span>
            </div>
            <div class="option-bar-bg" v-if="voteDetail.total_votes">
              <div class="option-bar" :style="{ width: opt.rate + '%' }"></div>
            </div>
          </div>
        </div>

        <div class="vote-actions" v-if="!hasVoted">
          <button class="vote-btn submit" :disabled="myChoices.length === 0" @click="submitVote">
            <span class="btn-text">提交投票</span>
          </button>
        </div>
        <div class="voted-msg" v-else>
          <span>你已投票</span>
        </div>

        <div class="threshold-info">
          <span class="threshold-text">{{ isSingle ? '单选' : '多选' }} · {{ getVoteStatus(activeVote) === 'ended' ? '已结束' : getVoteStatus(activeVote) === 'active' ? '进行中' : '未开始' }}</span>
        </div>
      </div>

      <div class="empty-state" v-else-if="!loading">
        <span class="empty-icon">🗳️</span>
        <span class="empty-title">暂无进行中的投票</span>
      </div>
      <div class="loading-state" v-else>
        <span class="loading-text">加载中...</span>
      </div>

      <!-- 投票历史 -->
      <div class="history-section">
        <span class="section-title">历史投票</span>
        <div class="history-list">
          <div v-for="item in historyVotes" :key="item.id" class="history-card">
            <div :class="['result-indicator', item.passed ? 'pass' : 'fail']"></div>
            <div class="history-body">
              <span class="history-title">{{ item.title }}</span>
              <span class="history-result">{{ item.passed ? '已通过' : '未通过' }} · {{ item.agree }}/{{ item.total }}票</span>
              <span class="history-time">{{ item.end_time }}</span>
            </div>
          </div>
        </div>
        <div class="empty-history" v-if="!loading && historyVotes.length === 0 && !activeVote">
          <span class="empty-title">暂无投票记录</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { getVotes, getVoteDetail, castVote, getVoteStatus, isVoteSingle } from '@/api/vote'
const loading = ref(true)
const votes = ref([])
const activeVote = ref(null)
const voteDetail = ref({ options: [], total_votes: 0, my_choices: [] })
const myChoices = ref([])
const hasVoted = ref(false)

const isSingle = computed(() => activeVote.value ? isVoteSingle(activeVote.value) : true)
const voteRate = computed(() => {
  const total = voteDetail.value.total_votes || 0
  const voters = votes.value.length > 0 ? votes.value.length : total
  return voters > 0 ? Math.round(total / voters * 100) : 0
})
const historyVotes = computed(() =>
  votes.value
    .filter(v => getVoteStatus(v) === 'ended')
    .map(v => {
      const detail = voteMap.value.get(v.id)
      const total = detail?.total_votes || 0
      const firstCount = detail?.options?.[0]?.vote_count || 0
      return { id: v.id, title: v.title, end_time: v.end_time, agree: total, total, passed: total > 0 }
    })
)

const voteMap = ref(new Map())

function formatTime(t) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 16)
}

function selectOption(opt) {
  if (hasVoted.value) return
  if (isSingle.value) {
    myChoices.value = [opt.id]
  } else {
    const idx = myChoices.value.indexOf(opt.id)
    if (idx >= 0) myChoices.value.splice(idx, 1)
    else myChoices.value.push(opt.id)
  }
}

async function submitVote() {
  if (myChoices.value.length === 0 || !activeVote.value) return
  uni.showLoading({ title: '提交中...' })
  try {
    const res = await castVote(activeVote.value.id, myChoices.value)
    if (res.success) {
      hasVoted.value = true
      showToast('投票成功')
      await loadData()
    } else {
      uni.showToast({ title: res.error || '投票失败', icon: 'none' })
    }
  } catch (e) {
    showToast('网络错误')
  } finally {
    
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await getVotes()
    if (res.success) {
      votes.value = res.votes || []

      // 找到进行中的投票
      const active = res.votes.find(v => getVoteStatus(v) === 'active')
      activeVote.value = active || null

      if (active) {
        const detailRes = await getVoteDetail(active.id)
        if (detailRes.success) {
          voteDetail.value = detailRes
          myChoices.value = [...(detailRes.my_choices || [])]
          hasVoted.value = detailRes.my_choices && detailRes.my_choices.length > 0
        }
      }

      // 加载历史投票详情
      const history = res.votes.filter(v => getVoteStatus(v) === 'ended')
      for (const v of history) {
        try {
          const detailRes = await getVoteDetail(v.id)
          if (detailRes.success) {
            voteMap.value.set(v.id, detailRes)
          }
        } catch (e) {
          // 忽略单个历史加载失败
        }
      }
    }
  } catch (e) {
    showToast('加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.vote-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.active-vote-card {
  margin: 24rpx 32rpx; background: $surface-container-lowest; border-radius: 24rpx; overflow: hidden;
}
.vote-header { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 28rpx 0; }
.status-badge {
  padding: 8rpx 20rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.1); color: $secondary; }
}
.deadline { font-size: 22rpx; color: $outline-variant; }
.vote-title {
  font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: $on-surface;
  padding: 20rpx 28rpx 12rpx;
}
.vote-desc { font-size: 26rpx; color: $on-surface-variant; line-height: 1.5; padding: 0 28rpx; }

.progress-section { margin: 28rpx; background: $surface; border-radius: 16rpx; padding: 24rpx; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 14rpx; }
.progress-label { font-size: 24rpx; color: $on-surface-variant; font-weight: 500; }
.progress-rate { font-family: 'PingFang SC'; font-size: 26rpx; font-weight: 700; color: $primary; }
.progress-bar { height: 14rpx; background: $surface-container-high; border-radius: 7rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #001e40, #003366); border-radius: 7rpx; transition: width 0.3s; }
.vote-stats { display: flex; gap: 16rpx; margin-top: 14rpx; flex-wrap: wrap; }
.stat-item { font-size: 22rpx; color: $outline-variant; }

.options-section { padding: 0 28rpx; }
.option-item {
  position: relative; margin-bottom: 12rpx; padding: 20rpx; border-radius: 14rpx;
  background: $surface; overflow: hidden; display: flex; align-items: center; gap: 12rpx;
  &.selected { background: rgba(0,30,64,0.06); }
  &.voted { pointer-events: none; }
}
.option-bar-bg {
  position: absolute; left: 0; bottom: 0; height: 4rpx; background: $surface-container-high; width: 100%;
}
.option-bar {
  height: 100%; background: linear-gradient(90deg, #001e40, #003366);
  border-radius: 2rpx; transition: width 0.5s;
}
.option-label {
  width: 36rpx; height: 36rpx; border-radius: 50%; background: $surface-container-lowest; border: 2rpx solid #d0d3d9;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  .selected & { background: $primary; border-color: $primary; }
}
.option-marker { font-size: 22rpx; font-weight: 700; color: $on-primary; }
.option-content { flex: 1; display: flex; gap: 8rpx; align-items: center; }
.option-text { font-size: 26rpx; color: $on-surface; }
.option-count { font-size: 22rpx; color: $outline-variant; }

.vote-actions { padding: 16rpx 28rpx 24rpx; }
.vote-btn.submit {
  width: 100%; height: 88rpx; border-radius: 18rpx; border: none;
  background: $gradient-primary; color: $on-primary;
  display: flex; align-items: center; justify-content: center;
  &:disabled { opacity: 0.5; }
  &:not(:disabled):active { transform: scale(0.97); }
}
.voted-msg { text-align: center; padding: 20rpx; font-size: 26rpx; color: $secondary; font-weight: 500; }

.threshold-info { padding: 0 28rpx 28rpx; }
.threshold-text { font-size: 22rpx; color: $outline-variant; }

.empty-state, .loading-state { padding: 120rpx 48rpx; text-align: center; }
.loading-text { font-size: 28rpx; color: $outline-variant; }
.empty-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.empty-title { font-size: 28rpx; color: $outline-variant; }

.history-section { margin: 40rpx 32rpx 0; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: $on-surface; display: block; margin-bottom: 20rpx; }
.history-list { display: flex; flex-direction: column; gap: 12rpx; }
.history-card { position: relative; display: flex; background: $surface-container-lowest; border-radius: 16rpx; overflow: hidden; }
.result-indicator {
  width: 8rpx; flex-shrink: 0;
  &.pass { background: $primary-container; }
  &.fail { background: #460002; }
}
.history-body { flex: 1; padding: 20rpx 20rpx 20rpx 16rpx; }
.history-title { font-size: 27rpx; font-weight: 500; color: $on-surface; display: block; }
.history-result { font-size: 23rpx; color: $on-surface-variant; display: block; margin-top: 6rpx; }
.history-time { font-size: 21rpx; color: $outline-variant; display: block; margin-top: 4rpx; }
.empty-history { padding: 60rpx; text-align: center; }
</style>
