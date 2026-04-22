<template>
  <view class="fee-page">
    <custom-nav-bar title="班费管理" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Balance Card -->
      <view class="balance-card">
        <view class="balance-bg"></view>
        <view class="balance-content">
          <text class="balance-label">当前余额</text>
          <view class="balance-amount-row">
            <text class="currency">¥</text>
            <text class="amount">{{ balance }}</text>
          </view>
          <view class="balance-meta">
            <view class="meta-item">
              <text class="meta-label">总收入</text>
              <text class="meta-value income">+{{ totalIncome }}</text>
            </view>
            <view class="meta-divider"></view>
            <view class="meta-item">
              <text class="meta-label">总支出</text>
              <text class="meta-value expense">-{{ totalExpense }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="action-grid">
        <navigator url="/pages/fee/apply" class="action-card">
          <view class="action-icon-wrap blue">
            <text class="action-emoji">📝</text>
          </view>
          <text class="action-label">使用申请</text>
        </navigator>
        <navigator url="/pages/fee/collection" class="action-card">
          <view class="action-icon-wrap green">
            <text class="action-emoji">💰</text>
          </view>
          <text class="action-label">班费收缴</text>
        </navigator>
        <navigator url="/pages/fee/reimbursement" class="action-card">
          <view class="action-icon-wrap orange">
            <text class="action-emoji">🧾</text>
          </view>
          <text class="action-label">报销申请</text>
        </navigator>
        <navigator url="/pages/fee/vote" class="action-card" v-if="isAdmin">
          <view class="action-icon-wrap purple">
            <text class="action-emoji">🗳️</text>
          </view>
          <text class="action-label">投票表决</text>
        </navigator>
      </view>

      <!-- Management Entry -->
      <view class="mgmt-section">
        <view class="section-header">
          <text class="section-title">管理功能</text>
        </view>
        <view class="mgmt-grid">
          <navigator url="/pages/fee/records" class="mgmt-card">
            <text class="mgmt-icon">📊</text>
            <text class="mgmt-label">收支记录</text>
          </navigator>
          <navigator url="/pages/fee/publication" class="mgmt-card">
            <text class="mgmt-icon">📢</text>
            <text class="mgmt-label">报销公示</text>
          </navigator>
          <navigator url="/pages/fee/supervision" class="mgmt-card">
            <text class="mgmt-icon">🔍</text>
            <text class="mgmt-label">财务监督</text>
          </navigator>
          <navigator url="/pages/fee/apply-approve" class="mgmt-card" v-if="isAdmin">
            <text class="mgmt-icon">✅</text>
            <text class="mgmt-label">申请审核</text>
          </navigator>
        </view>
      </view>

      <!-- Recent Records -->
      <view class="records-section">
        <view class="section-header">
          <text class="section-title">最近记录</text>
          <navigator url="/pages/fee/records" class="more-link">全部 ›</navigator>
        </view>
        <view class="record-list">
          <view v-for="item in recentRecords" :key="item.id" class="record-item">
            <view :class="['record-dot', item.type === 'income' ? 'in' : 'out']"></view>
            <view class="record-info">
              <text class="record-desc">{{ item.desc }}</text>
              <text class="record-time">{{ item.time }}</text>
            </view>
            <text :class="['record-amount', item.type === 'income' ? 'income' : 'expense']">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount }}
            </text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { isAdmin as checkAdmin } from '@/utils/auth.js'
import { getBalance, getMyExpenses, getAllExpenses } from '@/api/fee'
import { hasBackendToken } from '@/utils/request'

const balance = ref('0.00')
const totalIncome = ref('0.00')
const totalExpense = ref('0.00')
const isAdmin = ref(false)
const loading = ref(false)

const recentRecords = ref([])

function formatAmount(num) {
  if (typeof num !== 'number') return '0.00'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function fetchFeeData() {
  if (!hasBackendToken()) {
    console.warn('未登录后端，跳过加载班费数据')
    return
  }

  loading.value = true
  try {
    // 获取余额
    const balanceRes = await getBalance()
    if (balanceRes.success && balanceRes.balance) {
      const b = balanceRes.balance
      balance.value = formatAmount(b.balance || 0)
      totalIncome.value = formatAmount(b.totalIncome || 0)
      totalExpense.value = formatAmount(b.totalExpense || 0)
    }

    // 获取记录
    const expensesRes = isAdmin.value
      ? await getAllExpenses()
      : await getMyExpenses()

    if (expensesRes.success) {
      recentRecords.value = (expensesRes.expenses || []).map(e => ({
        id: e.id,
        desc: e.purpose,
        time: e.created_at ? e.created_at.substring(0, 10) : '',
        amount: formatAmount(e.amount),
        type: e.type
      }))
    }
  } catch (error) {
    console.error('获取班费数据失败:', error)
    uni.showToast({ title: '获取数据失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  isAdmin.value = checkAdmin()
  fetchFeeData()
})
</script>

<style lang="scss" scoped>
.fee-page {
  min-height: 100vh;
  background-color: #f7f9fc;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.balance-card {
  position: relative;
  margin: 24rpx 32rpx;
  border-radius: 24rpx;
  overflow: hidden;
}

.balance-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
}

.balance-content {
  position: relative;
  padding: 40rpx 32rpx;
}

.balance-label {
  font-size: 26rpx;
  color: rgba(255,255,255,0.65);
  display: block;
  margin-bottom: 12rpx;
}

.balance-amount-row {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 28rpx;
}

.currency {
  font-family: 'PingFang SC', sans-serif;
  font-size: 36rpx;
  font-weight: 700;
  color: #ffffff;
}

.amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 72rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -1rpx;
}

.balance-meta {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.meta-item {
  flex: 1;
  text-align: center;
}

.meta-label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.55);
  display: block;
  margin-bottom: 4rpx;
}

.meta-value {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;

  &.income { color: #a7c8ff; }
  &.expense { color: #ffb4ab; }
}

.meta-divider {
  width: 1rpx;
  height: 48rpx;
  background: rgba(255,255,255,0.15);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  padding: 0 32rpx;
  margin-top: 32rpx;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 8rpx;
  background: #ffffff;
  border-radius: 18rpx;
}

.action-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.blue { background: rgba(0,30,64,0.06); }
  &.green { background: rgba(70,98,112,0.08); }
  &.orange { background: rgba(70,0,2,0.05); }
  &.purple { background: rgba(0,51,102,0.07); }
}

.action-emoji {
  font-size: 36rpx;
}

.action-label {
  font-size: 22rpx;
  font-weight: 500;
  color: #43474f;
  text-align: center;
}

.mgmt-section {
  margin: 40rpx 32rpx 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.section-title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 30rpx;
  font-weight: 600;
  color: #191c1e;
}

.more-link {
  font-size: 24rpx;
  color: #43474f;
  font-weight: 500;
}

.mgmt-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}

.mgmt-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 24rpx 8rpx;
  background: #ffffff;
  border-radius: 18rpx;
}

.mgmt-icon {
  font-size: 36rpx;
}

.mgmt-label {
  font-size: 22rpx;
  font-weight: 500;
  color: #43474f;
  text-align: center;
}

.records-section {
  margin: 40rpx 32rpx 0;
}

.record-list {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.record-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 16rpx;
}

.record-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  flex-shrink: 0;

  &.in { background: #003366; }
  &.out { background: #460002; }
}

.record-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.record-desc {
  font-size: 27rpx;
  color: #191c1e;
  font-weight: 500;
}

.record-time {
  font-size: 22rpx;
  color: #c3c6d1;
}

.record-amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  flex-shrink: 0;

  &.income { color: #003366; }
  &.expense { color: #460002; }
}
</style>