<template>
  <div class="supervision-page">
    <custom-nav-bar title="财务监督" :showBack="true" />
    <div scroll-y class="main-scroll" @refresh="loadData" refresher-enabled :refresher-triggered="refreshing">
      <!-- Overview -->
      <div class="overview-card">
        <div class="overview-header">
          <span class="overview-title">财务概况</span>
          <span class="update-time">更新于 {{ updateTime }}</span>
        </div>
        <div class="overview-grid">
          <div class="overview-item">
            <span class="overview-value">¥{{ summary.balance.toFixed(2) }}</span>
            <span class="overview-label">当前余额</span>
          </div>
          <div class="overview-item">
            <span class="overview-value">{{ summary.totalIncome.toFixed(2) }}</span>
            <span class="overview-label">总收入</span>
          </div>
          <div class="overview-item">
            <span class="overview-value">{{ summary.totalExpense.toFixed(2) }}</span>
            <span class="overview-label">总支出</span>
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="section-block">
        <span class="block-title">最近交易</span>
        <div class="trans-list" v-if="transactions.length > 0">
          <div v-for="e in transactions" :key="e.id" class="trans-item">
            <div :class="['trans-dot', e.amount >= 0 ? 'in' : 'out']"></div>
            <div class="trans-info">
              <span class="trans-title">{{ e.purpose || e.type }}</span>
              <span class="trans-meta">{{ e.applicant_name || e.student_id || '未知' }} · {{ formatDate(e.created_at) }}</span>
            </div>
            <span :class="['trans-amount', e.amount >= 0 ? 'in' : 'out']">
              {{ e.amount >= 0 ? '+' : '-' }}¥{{ Math.abs(e.amount).toFixed(2) }}
            </span>
          </div>
        </div>
        <div class="empty-block" v-else-if="!loading">
          <span class="empty-text">暂无交易记录</span>
        </div>
      </div>

      <!-- Audit Trail -->
      <div class="section-block">
        <span class="block-title">审批轨迹</span>
        <div class="audit-list" v-if="auditLogs.length > 0">
          <div v-for="(log, idx) in auditLogs" :key="idx" class="audit-item">
            <div class="audit-step">
              <div class="step-num">{{ idx + 1 }}</div>
              <div class="step-line" v-if="idx < auditLogs.length - 1"></div>
            </div>
            <div class="audit-content">
              <span class="audit-action">{{ log.action }}</span>
              <span class="audit-person">{{ log.person }}</span>
              <span class="audit-time">{{ log.time }}</span>
              <span class="audit-note" v-if="log.note">{{ log.note }}</span>
            </div>
          </div>
        </div>
        <div class="empty-block" v-else-if="!loading">
          <span class="empty-text">暂无审批记录</span>
        </div>
      </div>

      <div class="loading-bar" v-if="loading" style="text-align: center; padding: 40rpx;">
        <span style="font-size: 24rpx; color: $outline-variant;">加载中...</span>
      </div>
      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onMounted, ref } from 'vue'
import { getSummary, getAllExpenses, getExpenseDetail } from '@/api/fee'
const loading = ref(true)
const refreshing = ref(false)
const summary = ref({ balance: 0, totalIncome: 0, totalExpense: 0 })
const transactions = ref([])
const auditLogs = ref([])
const updateTime = ref('')

function formatDate(t) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 16)
}

function buildAuditTrail(expenses) {
  const logs = []
  for (const e of expenses) {
    // Step-based audit trail
    const baseLog = {
      action: `提交使用申请 - ${e.purpose || e.type || '无描述'}`,
      person: e.applicant_name || e.student_id || '未知',
      time: formatDate(e.created_at),
      note: `¥${Number(e.amount).toFixed(2)}`
    }
    logs.push(baseLog)

    if (e.approval_chain && e.approval_chain.length > 0) {
      for (const step of e.approval_chain) {
        const stepLabels = ['', '区队长审批', '辅导员审批', '投票表决']
        const stepName = stepLabels[step.step] || `第${step.step}步`
        const statusLabel = step.status === 1 ? '通过' : step.status === 2 ? '驳回' : '待审'

        logs.push({
          action: step.status === 1 ? `${stepName}通过` : step.status === 2 ? `${stepName}驳回` : `${stepName}待审`,
          person: step.approver_name || (step.status === 1 ? '系统' : '待审批'),
          time: step.status === 1 ? e.approval_time || e.created_at : '',
          note: step.notes || statusLabel
        })
      }
    }

    if (e.status === 1) {
      logs.push({
        action: '资金已划拨',
        person: '系统',
        time: e.approval_time ? formatDate(e.approval_time) : '',
        note: '已办结'
      })
    }
  }
  return logs
}

async function loadData() {
  loading.value = true
  updateTime.value = formatDate(new Date().toISOString())
  try {
    const [summaryRes, expenseRes] = await Promise.all([
      getSummary(),
      getAllExpenses()
    ])

    if (summaryRes.success) {
      summary.value = summaryRes.summary
    }

    if (expenseRes.success) {
      // Sort by date desc
      const sorted = (expenseRes.expenses || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )
      transactions.value = sorted.slice(0, 20)

      // Build audit trail (last 10 expenses with details)
      const recent = sorted.slice(0, 5)
      const detailPromises = recent.map(e =>
        getExpenseDetail(e.id).catch(() => null)
      )
      const details = (await Promise.all(detailPromises))
        .filter(d => d && d.success)
        .map(d => ({ ...d.expense, approval_chain: d.expense.approval_chain || [] }))

      if (details.length > 0) {
        // Also add expenses with status that have no approval_chain but have basic info
        auditLogs.value = buildAuditTrail(details)
      } else {
        // Fallback: build trail from basic expense info
        const fallbackExpenses = sorted.filter(e => e.status !== undefined).slice(0, 3)
        auditLogs.value = buildAuditTrail(fallbackExpenses)
      }
    }
  } catch (e) {
    showToast('加载失败')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => loadData())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.supervision-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.overview-card {
  margin: 24rpx 32rpx; background: $gradient-primary; border-radius: 24rpx;
  padding: 32rpx; overflow: hidden;
}
.overview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28rpx; }
.overview-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: rgba(255,255,255,0.85); }
.update-time { font-size: 22rpx; color: rgba(255,255,255,0.5); }

.overview-grid { display: flex; gap: 0; }
.overview-item { flex: 1; text-align: center; }
.overview-value {
  font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 700; color: $on-primary; display: block; margin-bottom: 8rpx;
}
.overview-label { font-size: 22rpx; color: rgba(255,255,255,0.55); }

.section-block { margin: 32rpx 32rpx 0; background: $surface-container-lowest; border-radius: 20rpx; padding: 28rpx 24rpx; }
.block-title { font-family: 'PingFang SC'; font-size: 26rpx; font-weight: 600; color: $on-surface; display: block; margin-bottom: 24rpx; }

.trans-list { display: flex; flex-direction: column; gap: 4rpx; }
.trans-item { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; }
.trans-dot {
  width: 10rpx; height: 10rpx; border-radius: 50%; flex-shrink: 0;
  &.in { background: #a7c8ff; }
  &.out { background: #ffb4ab; }
}
.trans-info { flex: 1; min-width: 0; }
.trans-title { font-size: 26rpx; color: $on-surface; font-weight: 500; display: block; }
.trans-meta { font-size: 22rpx; color: $outline-variant; display: block; margin-top: 4rpx; }
.trans-amount {
  font-family: 'PingFang SC'; font-size: 27rpx; font-weight: 600; flex-shrink: 0;
  &.in { color: #a7c8ff; }
  &.out { color: #ffb4ab; }
}

.audit-list { display: flex; flex-direction: column; }
.audit-item { display: flex; gap: 16rpx; padding-bottom: 28rpx;
  &:last-child { padding-bottom: 0; }
}
.audit-step { display: flex; flex-direction: column; align-items: center; width: 36rpx; flex-shrink: 0; }
.step-num {
  width: 36rpx; height: 36rpx; border-radius: 50%; background: $surface-container-low; display: flex; align-items: center;
  justify-content: center; font-size: 20rpx; font-weight: 700; color: $on-surface-variant;
}
.step-line { flex: 1; width: 2rpx; background: $surface-container-high; margin-top: 8rpx; }
.audit-content { display: flex; flex-direction: column; gap: 4rpx; padding-top: 2rpx; }
.audit-action { font-size: 26rpx; font-weight: 500; color: $on-surface; }
.audit-person { font-size: 23rpx; color: $on-surface-variant; }
.audit-time { font-size: 21rpx; color: $outline-variant; }
.audit-note { font-size: 23rpx; color: $secondary; font-style: italic; }
.empty-block { padding: 40rpx 0; text-align: center; }
.empty-text { font-size: 24rpx; color: $outline-variant; }
</style>
