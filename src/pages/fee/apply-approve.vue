<template>
  <div class="approve-page">
    <custom-nav-bar title="申请审核" :showBack="true" />
    <div scroll-y class="main-scroll" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadData">
      <div class="filter-tabs">
        <div :class="['tab', { active: currentTab === 'pending' }]" @tap="switchTab('pending')">
          <span class="tab-text">待审核</span>
          <span class="tab-count">{{ pendingList.length }}</span>
        </div>
        <div :class="['tab', { active: currentTab === 'done' }]" @tap="switchTab('done')">
          <span class="tab-text">已处理</span>
        </div>
      </div>

      <div class="app-list">
        <div v-for="item in displayList" :key="item.id" class="app-card">
          <div class="card-accent" :class="tierClass(item.tier, item.amount)"></div>
          <div class="card-body">
            <div class="card-top">
              <span class="app-title">{{ item.purpose }}</span>
              <span class="app-amount">¥{{ Number(item.amount).toFixed(2) }}</span>
            </div>
            <span class="app-detail" v-if="item.details">{{ item.details }}</span>
            <div class="meta-row">
              <span class="meta-text">申请人：{{ item.applicant_name || item.student_id || '未知' }}</span>
              <span class="meta-text">{{ formatTime(item.created_at) }}</span>
              <span class="meta-text">{{ tierLabel(item.tier, item.amount) }}</span>
              <span class="meta-text" v-if="item.step === 3">已投票</span>
            </div>

            <!-- 投票阶段 (step 3) -->
            <div class="vote-area" v-if="currentTab === 'pending' && item.step === 3">
              <div class="vote-progress">
                <span class="vote-label">投票进度</span>
                <div class="vote-bar-wrap">
                  <div class="vote-bar-fill" :style="{ width: votePercent(item) + '%' }"></div>
                </div>
                <span class="vote-count">{{ item.vote_approve || 0 }}/19 同意</span>
              </div>
              <div class="vote-actions">
                <button class="action-btn reject" @click="doVote(item, 2)" :disabled="votingId === item.id">反对</button>
                <button class="action-btn approve" @click="doVote(item, 1)" :disabled="votingId === item.id">
                  {{ votingId === item.id ? '投票中...' : '同意' }}
                </button>
              </div>
            </div>

            <!-- 审批阶段 (step 1/2) -->
            <div class="action-area" v-else-if="currentTab === 'pending' && item.step !== 3">
              <button class="action-btn reject" @click="doReject(item)" :disabled="processingId === item.id">驳回</button>
              <button class="action-btn approve" @click="doApprove(item)" :disabled="processingId === item.id">
                {{ processingId === item.id ? '处理中...' : '通过' }}
              </button>
            </div>

            <div class="result-tag" v-else>
              <span :class="['result-text', item.status === 1 ? 'yes' : 'no']">
                {{ item.status === 1 ? '✓ 已通过' : '✗ 已驳回' }}
              </span>
              <span class="result-notes" v-if="item.approval_notes">（{{ item.approval_notes }}）</span>
            </div>
          </div>
        </div>

        <div v-if="allData.length === 0" class="empty-state">
          <span class="empty-text">暂无记录</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { getPendingApprovals, approveExpense, rejectExpense, castVote } from '@/api/fee'
const currentTab = ref('pending')
const allData = ref([])
const refreshing = ref(false)
const processingId = ref(null)
const votingId = ref(null)

const pendingList = computed(() => allData.value.filter(d => d.status === 0))
const doneList = computed(() => allData.value.filter(d => d.status !== 0))

const displayList = computed(() => currentTab.value === 'pending' ? pendingList.value : doneList.value)

function switchTab(tab) {
  currentTab.value = tab
}

function tierClass(tier, amount) {
  const a = Number(amount)
  if (tier === 'small' || a <= 100) return 'small'
  if (tier === 'medium' || a <= 500) return 'medium'
  return 'large'
}

function tierLabel(tier, amount) {
  const a = Number(amount)
  if (tier === 'small' || a <= 100) return '小额·区队长审批'
  if (tier === 'medium' || a <= 500) return '中额·区队长→辅导员'
  return '大额·区队长→辅导员→投票'
}

function votePercent(item) {
  const cur = item.vote_approve || 0
  return Math.min(100, Math.round(cur / 19 * 100))
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

async function loadData() {
  refreshing.value = true
  try {
    const res = await getPendingApprovals()
    if (res.success) {
      allData.value = res.approvals || []
    }
  } catch (e) {
    console.error('加载待审批列表失败:', e)
  } finally {
    refreshing.value = false
  }
}

async function doApprove(item) {
  const res = await uni.showModal({
    title: '确认通过',
    content: `确定通过「${item.purpose}」（¥${Number(item.amount).toFixed(2)}）的审批？`
  })
  if (!res.confirm) return

  processingId.value = item.id
  try {
    const result = await approveExpense(item.id)
    if (result.success) {
      showToast('已通过')
      item.status = 1
    } else {
      uni.showToast({ title: result.message || '操作失败', icon: 'none' })
    }
  } catch (e) {
    showToast('审批失败')
  } finally {
    processingId.value = null
  }
}

async function doReject(item) {
  const { value: notes } = await uni.showModal({
    title: '确认驳回',
    content: `请填写驳回原因（选填）：`,
    editable: true,
    placeholderText: '输入驳回原因...'
  })
  if (!notes?.confirm) return

  processingId.value = item.id
  try {
    const result = await rejectExpense(item.id, notes.content || '')
    if (result.success) {
      showToast('已驳回')
      item.status = 2
    } else {
      uni.showToast({ title: result.message || '操作失败', icon: 'none' })
    }
  } catch (e) {
    showToast('驳回失败')
  } finally {
    processingId.value = null
  }
}

async function doVote(item, vote) {
  votingId.value = item.id
  try {
    const result = await castVote(item.id, vote)
    if (result.success) {
      uni.showToast({ title: vote === 1 ? '已投同意' : '已投反对', icon: 'success' })
      item.vote_approve = result.approveCount || item.vote_approve
      if (result.thresholdMet) item.status = 1
    } else {
      uni.showToast({ title: result.error || '投票失败', icon: 'none' })
    }
  } catch (e) {
    showToast('投票失败')
  } finally {
    votingId.value = null
  }
}

onMounted(() => loadData())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.approve-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.filter-tabs { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: $surface-container-lowest; }
.tab {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center;
  justify-content: center; gap: 8rpx; background: $surface-container-low;
  &.active { background: $primary; .tab-text { color: $on-primary; } .tab-count { background: rgba(255,255,255,0.2); color: $on-primary; } }
}
.tab-text { font-size: 26rpx; font-weight: 500; color: $on-surface-variant; }
.tab-count {
  padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  background: rgba($primary, 0.06); color: $primary;
}

.app-list { padding: 24rpx 32rpx; }

.app-card { position: relative; display: flex; background: $surface-container-lowest; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; }
.card-accent {
  width: 10rpx; flex-shrink: 0;
  &.small { background: $secondary; }
  &.medium { background: $primary; }
  &.large { background: $tertiary; }
}
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.app-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: $on-surface; flex: 1; }
.app-amount { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: $primary; }
.app-detail { font-size: 24rpx; color: $on-surface-variant; margin-bottom: 16rpx; display: block; line-height: 1.5; }
.meta-row { display: flex; gap: 24rpx; margin-bottom: 20rpx; flex-wrap: wrap; }
.meta-text { font-size: 22rpx; color: $outline-variant; }

.vote-area { background: $surface-container-low; border-radius: 14rpx; padding: 16rpx; }
.vote-progress { margin-bottom: 12rpx; }
.vote-label { font-size: 22rpx; color: $on-surface-variant; display: block; margin-bottom: 8rpx; }
.vote-bar-wrap { height: 20rpx; background: $surface-container; border-radius: 10rpx; overflow: hidden; margin-bottom: 6rpx; }
.vote-bar-fill { height: 100%; background: $primary; border-radius: 10rpx; transition: width 0.3s; }
.vote-count { font-size: 20rpx; color: $on-surface-tertiary; }
.vote-actions { display: flex; gap: 12rpx; }

.action-area { display: flex; gap: 12rpx; }
.action-btn {
  flex: 1; height: 72rpx; border-radius: 14rpx; border: none; font-size: 26rpx; font-weight: 600;
  &.reject { background: $surface-container-low; color: $tertiary; }
  &.approve { background: $gradient-primary; color: $on-primary; }
  &[disabled] { opacity: 0.5; }
}
.result-tag { text-align: center; padding-top: 8rpx; }
.result-text { font-size: 26rpx; font-weight: 600; &.yes { color: $primary-container; } &.no { color: $tertiary; } }
.result-notes { font-size: 22rpx; color: $outline-variant; margin-left: 8rpx; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: $outline-variant; }
</style>
