<template>
  <div class="fee-page">
    <custom-nav-bar title="班费管理" />

    <div scroll-y class="main-scroll">
      <!-- Balance Card -->
      <div class="balance-card">
        <div class="balance-bg"></div>
        <div class="balance-content">
          <span class="balance-label">当前余额</span>
          <div class="balance-amount-row">
            <span class="currency">¥</span>
            <span class="amount">{{ balance }}</span>
          </div>
          <div class="balance-meta">
            <div class="meta-item">
              <span class="meta-label">总收入</span>
              <span class="meta-value income">+{{ totalIncome }}</span>
            </div>
            <div class="meta-divider"></div>
            <div class="meta-item">
              <span class="meta-label">总支出</span>
              <span class="meta-value expense">-{{ totalExpense }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="action-grid">
        <router-link to="/pages/fee/apply" class="action-card">
          <div class="action-icon-wrap blue">
            <span class="action-emoji">📝</span>
          </div>
          <span class="action-label">使用申请</span>
        </router-link>
        <router-link to="/pages/fee/collection" class="action-card">
          <div class="action-icon-wrap green">
            <span class="action-emoji">💰</span>
          </div>
          <span class="action-label">班费收缴</span>
        </router-link>
        <router-link to="/pages/fee/reimbursement" class="action-card">
          <div class="action-icon-wrap orange">
            <span class="action-emoji">🧾</span>
          </div>
          <span class="action-label">报销申请</span>
        </router-link>
        <router-link to="/pages/fee/vote" class="action-card" v-if="isAdmin">
          <div class="action-icon-wrap purple">
            <span class="action-emoji">🗳️</span>
          </div>
          <span class="action-label">投票表决</span>
        </router-link>
      </div>

      <!-- Management Entry -->
      <div class="mgmt-section">
        <div class="section-header">
          <span class="section-title">管理功能</span>
        </div>
        <div class="mgmt-grid">
          <router-link to="/pages/fee/records" class="mgmt-card">
            <span class="mgmt-icon">📊</span>
            <span class="mgmt-label">收支记录</span>
          </router-link>
          <router-link to="/pages/fee/publication" class="mgmt-card">
            <span class="mgmt-icon">📢</span>
            <span class="mgmt-label">报销公示</span>
          </router-link>
          <router-link to="/pages/fee/supervision" class="mgmt-card">
            <span class="mgmt-icon">🔍</span>
            <span class="mgmt-label">财务监督</span>
          </router-link>
          <router-link to="/pages/fee/apply-approve" class="mgmt-card" v-if="isAdmin">
            <span class="mgmt-icon">✅</span>
            <span class="mgmt-label">申请审核</span>
          </router-link>
        </div>
      </div>

      <!-- Recent Records -->
      <div class="records-section">
        <div class="section-header">
          <span class="section-title">最近记录</span>
          <router-link to="/pages/fee/records" class="more-link">全部 ›</router-link>
        </div>
        <div class="record-list">
          <div v-for="item in recentRecords" :key="item.id" class="record-item">
            <div :class="['record-dot', item.type === 'income' ? 'in' : 'out']"></div>
            <div class="record-info">
              <span class="record-desc">{{ item.desc }}</span>
              <span class="record-time">{{ item.time }}</span>
            </div>
            <span :class="['record-amount', item.type === 'income' ? 'income' : 'expense']">
              {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount }}
            </span>
          </div>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>

    <custom-tab-bar current="profile" />
  </div>
</template>

<script setup lang="ts">


import { onMounted, ref } from 'vue'
import { isAdmin as checkAdmin } from '@/utils/auth'
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
    showToast('获取数据失败')
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
@import "@/uni.scss";.fee-page {
  min-height: 100vh;
  background-color: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
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
  background: $gradient-primary;
}

.balance-content {
  position: relative;
  padding: 40rpx 32rpx;
}

.balance-label {
  font-size: 26rpx;
  color: rgba($on-primary,0.65);
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
  color: $on-primary;
}

.amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 72rpx;
  font-weight: 700;
  color: $on-primary;
  letter-spacing: -1rpx;
}

.balance-meta {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba($on-primary,0.1);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.meta-item {
  flex: 1;
  text-align: center;
}

.meta-label {
  font-size: 22rpx;
  color: rgba($on-primary,0.55);
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
  background: rgba($on-primary,0.15);
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
  background: $surface-container-lowest;
  border-radius: $radius-lg;
}

.action-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.blue { background: rgba($primary,0.06); }
  &.green { background: rgba($secondary,0.08); }
  &.orange { background: rgba($tertiary,0.05); }
  &.purple { background: rgba($primary-container,0.07); }
}

.action-emoji {
  font-size: 36rpx;
}

.action-label {
  font-size: 22rpx;
  font-weight: 500;
  color: $on-surface-variant;
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
  color: $on-surface;
}

.more-link {
  font-size: 24rpx;
  color: $on-surface-variant;
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
  background: $surface-container-lowest;
  border-radius: $radius-lg;
}

.mgmt-icon {
  font-size: 36rpx;
}

.mgmt-label {
  font-size: 22rpx;
  font-weight: 500;
  color: $on-surface-variant;
  text-align: center;
}

.records-section {
  margin: 40rpx 32rpx 0;
}

.record-list {
  background: $surface-container-lowest;
  border-radius: $radius-lg;
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

  &.in { background: $primary-container; }
  &.out { background: $tertiary; }
}

.record-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.record-desc {
  font-size: 27rpx;
  color: $on-surface;
  font-weight: 500;
}

.record-time {
  font-size: 22rpx;
  color: $outline-variant;
}

.record-amount {
  font-family: 'PingFang SC', sans-serif;
  font-size: 28rpx;
  font-weight: 600;
  flex-shrink: 0;

  &.income { color: $primary-container; }
  &.expense { color: $tertiary; }
}
</style>