<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getExpenseDetail } from '@/api/fee'
import type { FeeExpense } from '@/api/fee'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'

const route = useRoute()
const expense = ref<(FeeExpense & { approvals?: any[]; voteResult?: any }) | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const id = Number(route.query.id)
    if (!id) { error.value = new Error('缺少记录编号，请从列表重新进入'); return }
    const res = await getExpenseDetail(id)
    if (res.success) expense.value = res.expense
    else error.value = new Error('记录加载失败')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''
const tierLabel = (t: string) => ({ small: '小额', medium: '中额', large: '大额' })[t] || t
</script>
<template>
  <div class="detail-page">
    <NavBar title="报销详情" show-back />
    <StateView
      :loading="loading"
      :error="error"
      :empty="!expense"
      empty-title="记录不存在"
      empty-description="该报销记录可能已被删除，或链接已失效"
      @retry="load"
    >
    <div v-if="expense" class="content">
      <div class="amount-bar">
        <div class="amount-big">¥{{ Number(expense.amount).toFixed(2) }}</div>
        <span :class="['big-badge', statusClass(expense.status)]">{{ statusLabel(expense.status) }}</span>
      </div>

      <div class="info-card">
        <div class="info-row"><span class="label">金额级别</span><span class="value">{{ tierLabel(expense.tier) }}</span></div>
        <div class="info-row"><span class="label">用途</span><span class="value">{{ expense.purpose }}</span></div>
        <div class="info-row"><span class="label">申请人</span><span class="value">{{ expense.applicant_name || '我' }}</span></div>
        <div class="info-row"><span class="label">提交时间</span><span class="value">{{ expense.created_at?.slice(0, 16) }}</span></div>
      </div>

      <!-- 审批链 -->
      <div v-if="expense.approval_chain?.length" class="section">
        <h3>审批流程</h3>
        <div v-for="(node, i) in expense.approval_chain" :key="i" class="approval-node">
          <div class="node-step">步骤 {{ i + 1 }}</div>
          <div class="node-status">
            <span :class="['node-badge', node.status === 1 ? 'done' : node.status === 2 ? 'rejected' : 'waiting']">
              {{ node.status === 1 ? '已通过' : node.status === 2 ? '已驳回' : '待审批' }}
            </span>
            <span v-if="node.approver_name" class="node-approver">{{ node.approver_name }}</span>
            <span v-if="node.notes" class="node-notes">{{ node.notes }}</span>
          </div>
        </div>
      </div>

      <!-- 投票结果 -->
      <div v-if="expense.voteResult" class="section">
        <h3>投票结果</h3>
        <div class="vote-info">
          <span>赞成 {{ expense.voteResult.approveCount }}</span>
          <span>反对 {{ expense.voteResult.rejectCount }}</span>
          <span>总票 {{ expense.voteResult.totalVotes }}</span>
          <span v-if="expense.voteResult.thresholdMet" class="vote-pass">✅ 已达标</span>
          <span v-else class="vote-fail">⏳ 未达标</span>
        </div>
      </div>
    </div>
    </StateView>
  </div>
</template>
<style scoped>
.detail-page { padding-bottom: var(--spacing-lg); }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.content { padding: 20px 16px; }
.amount-bar { text-align: center; margin-bottom: 20px; }
.amount-big { font-size: 32px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
.big-badge { font-size: 13px; font-weight: 600; padding: 4px 16px; border-radius: 6px; }
.big-badge.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.big-badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.big-badge.rejected { background: var(--color-error-bg); color: var(--color-error); }
.info-card {
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 16px; margin-bottom: 16px;
}
.info-row { display: flex; padding: 8px 0; font-size: 14px; }
.info-row + .info-row { border-top: 1px solid var(--color-border); }
.label { color: var(--color-text-3); width: 80px; flex-shrink: 0; }
.value { color: var(--color-text); flex: 1; }
.section { margin-bottom: 20px; }
.section h3 { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.approval-node { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
.approval-node:last-child { border-bottom: none; }
.node-step { font-size: 12px; font-weight: 600; color: var(--color-text-3); min-width: 48px; }
.node-status { flex: 1; }
.node-badge { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.node-badge.done { background: var(--color-success-bg); color: var(--color-success); }
.node-badge.rejected { background: var(--color-error-bg); color: var(--color-error); }
.node-badge.waiting { background: var(--color-accent-bg); color: var(--color-accent); }
.node-approver { font-size: 12px; color: var(--color-text-2); margin-left: 8px; }
.node-notes { display: block; font-size: 12px; color: var(--color-text-3); margin-top: 2px; }
.vote-info { display: flex; gap: 16px; font-size: 14px; color: var(--color-text-2); flex-wrap: wrap; }
.vote-pass { color: var(--color-success); font-weight: 600; }
.vote-fail { color: var(--color-warning); font-weight: 600; }
</style>
