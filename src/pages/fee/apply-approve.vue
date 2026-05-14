<template>
  <view class="approve-page">
    <custom-nav-bar title="申请审核" :showBack="true" />
    <scroll-view scroll-y class="main-scroll" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadData">
      <view class="filter-tabs">
        <view :class="['tab', { active: currentTab === 'pending' }]" @tap="switchTab('pending')">
          <text class="tab-text">待审核</text>
          <text class="tab-count">{{ pendingList.length }}</text>
        </view>
        <view :class="['tab', { active: currentTab === 'done' }]" @tap="switchTab('done')">
          <text class="tab-text">已处理</text>
        </view>
      </view>

      <view class="app-list">
        <view v-for="item in displayList" :key="item.id" class="app-card">
          <view class="card-accent" :class="tierClass(item.tier, item.amount)"></view>
          <view class="card-body">
            <view class="card-top">
              <text class="app-title">{{ item.purpose }}</text>
              <text class="app-amount">¥{{ Number(item.amount).toFixed(2) }}</text>
            </view>
            <text class="app-detail" v-if="item.details">{{ item.details }}</text>
            <view class="meta-row">
              <text class="meta-text">申请人：{{ item.applicant_name || item.student_id || '未知' }}</text>
              <text class="meta-text">{{ formatTime(item.created_at) }}</text>
              <text class="meta-text">{{ tierLabel(item.tier, item.amount) }}</text>
            </view>

            <view class="action-area" v-if="currentTab === 'pending'">
              <button class="action-btn reject" @click="doReject(item)" :disabled="processingId === item.id">驳回</button>
              <button class="action-btn approve" @click="doApprove(item)" :disabled="processingId === item.id">
                {{ processingId === item.id ? '处理中...' : '通过' }}
              </button>
            </view>

            <view class="result-tag" v-else>
              <text :class="['result-text', item.status === 1 ? 'yes' : 'no']">
                {{ item.status === 1 ? '✓ 已通过' : '✗ 已驳回' }}
              </text>
              <text class="result-notes" v-if="item.approval_notes">（{{ item.approval_notes }}）</text>
            </view>
          </view>
        </view>

        <view v-if="allData.length === 0" class="empty-state">
          <text class="empty-text">暂无记录</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getPendingApprovals, approveExpense, rejectExpense } from '@/api/fee'

const currentTab = ref('pending')
const allData = ref([])
const refreshing = ref(false)
const processingId = ref(null)

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
  return '大额·区队长→全体投票'
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
  const [res] = await uni.showModal({
    title: '确认通过',
    content: `确定通过「${item.purpose}」（¥${Number(item.amount).toFixed(2)}）的审批？`
  })
  if (!res.confirm) return

  processingId.value = item.id
  try {
    const result = await approveExpense(item.id)
    if (result.success) {
      uni.showToast({ title: '已通过', icon: 'success' })
      item.status = 1
    } else {
      uni.showToast({ title: result.message || '操作失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '审批失败', icon: 'none' })
  } finally {
    processingId.value = null
  }
}

async function doReject(item) {
  const [res] = await uni.showModal({
    title: '确认驳回',
    content: `确定驳回「${item.purpose}」？`
  })
  if (!res.confirm) return

  processingId.value = item.id
  try {
    const result = await rejectExpense(item.id)
    if (result.success) {
      uni.showToast({ title: '已驳回', icon: 'none' })
      item.status = 2
    } else {
      uni.showToast({ title: result.message || '操作失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '驳回失败', icon: 'none' })
  } finally {
    processingId.value = null
  }
}

onMounted(() => loadData())
</script>

<style lang="scss" scoped>
.approve-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.filter-tabs { display: flex; gap: 16rpx; padding: 20rpx 32rpx; background: #fff; }
.tab {
  flex: 1; height: 72rpx; border-radius: 36rpx; display: flex; align-items: center;
  justify-content: center; gap: 8rpx; background: #f2f4f7;
  &.active { background: #001e40; .tab-text { color: #fff; } .tab-count { background: rgba(255,255,255,0.2); color: #fff; } }
}
.tab-text { font-size: 26rpx; font-weight: 500; color: #43474f; }
.tab-count {
  padding: 2rpx 12rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  background: rgba(0,30,64,0.06); color: #001e40;
}

.app-list { padding: 24rpx 32rpx; }

.app-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; }
.card-accent {
  width: 10rpx; flex-shrink: 0;
  &.small { background: #466270; }
  &.medium { background: #001e40; }
  &.large { background: #800020; }
}
.card-body { flex: 1; padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12rpx; }
.app-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; flex: 1; }
.app-amount { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #001e40; }
.app-detail { font-size: 24rpx; color: #43474f; margin-bottom: 16rpx; display: block; line-height: 1.5; }
.meta-row { display: flex; gap: 24rpx; margin-bottom: 20rpx; flex-wrap: wrap; }
.meta-text { font-size: 22rpx; color: #c3c6d1; }

.action-area { display: flex; gap: 12rpx; }
.action-btn {
  flex: 1; height: 72rpx; border-radius: 14rpx; border: none; font-size: 26rpx; font-weight: 600;
  &.reject { background: #f2f4f7; color: #460002; }
  &.approve { background: linear-gradient(135deg, #001e40, #003366); color: #fff; }
  &[disabled] { opacity: 0.5; }
}
.result-tag { text-align: center; padding-top: 8rpx; }
.result-text { font-size: 26rpx; font-weight: 600; &.yes { color: #003366; } &.no { color: #460002; } }
.result-notes { font-size: 22rpx; color: #c3c6d1; margin-left: 8rpx; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
