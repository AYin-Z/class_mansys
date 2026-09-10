<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPendingApprovals, approveExpense, rejectExpense, castVote, getVoteResult } from '@/api/fee'
import type { FeeExpense, VoteResult } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const userStore = useUserStore()
const approvals = ref<FeeExpense[]>([])
const loading = ref(true)
const actionLoading = ref<number | null>(null)
const voteModal = ref<{ id: number; show: boolean }>({ id: 0, show: false })
const voteResult = ref<VoteResult | null>(null)
const rejectModal = ref<{ id: number; show: boolean }>({ id: 0, show: false })
const rejectNotes = ref('')

onMounted(async () => {
  try {
    const res = await getPendingApprovals()
    if (res.success) approvals.value = res.approvals || []
  } catch (_) {}
  finally { loading.value = false }
})

async function handleApprove(id: number) {
  actionLoading.value = id
  try {
    const res = await approveExpense(id)
    if (res.success) {
      showToast('已审批通过')
      approvals.value = approvals.value.filter(a => a.id !== id)
    } else {
      showToast(res.message || '操作失败', 'error')
    }
  } catch (_) { showToast('操作失败', 'error') }
  finally { actionLoading.value = null }
}

function openReject(id: number) { rejectModal.value = { id, show: true }; rejectNotes.value = '' }
async function handleReject() {
  const id = rejectModal.value.id
  actionLoading.value = id
  try {
    const res = await rejectExpense(id, rejectNotes.value || undefined)
    if (res.success) {
      showToast('已驳回')
      approvals.value = approvals.value.filter(a => a.id !== id)
      rejectModal.value.show = false
    } else {
      showToast(res.message || '操作失败', 'error')
    }
  } catch (_) { showToast('操作失败', 'error') }
  finally { actionLoading.value = null }
}

async function openVote(id: number) {
  voteModal.value = { id, show: true }
  voteResult.value = null
  try { const res = await getVoteResult(id); if (res.success) voteResult.value = res }
  catch { voteResult.value = null }
}

async function handleVote(id: number, vote: 1 | 2) {
  try {
    const res = await castVote(id, vote)
    if (res.success) {
      showToast(`已投票（${res.approveCount || 0} 赞成 / 需 ${voteResult.value?.totalVotes || '?'} 票）`)
      approvals.value = approvals.value.filter(a => a.id !== id)
    } else {
      showToast(res.error || '投票失败', 'error')
    }
  } catch (_) { showToast('投票失败', 'error') }
  finally { voteModal.value = { id: 0, show: false } }
}

const tierLabel = (t: string) => ({ small: '小额', medium: '中额', large: '大额' })[t] || t
const stepLabel = (step: number) => ({ 1: '区队长审批', 2: '辅导员审批', 3: '全员投票' })[step] || '待处理'
const canReview = (item: FeeExpense) => userStore.isAdmin && item.approval_step !== 3
const canVote = (item: FeeExpense) => item.approval_step === 3
</script>
<template>
  <div class="approval-page">
    <NavBar title="审批/投票" show-back />
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="approvals.length === 0" class="empty-state">暂无待审批事项</div>

    <div v-for="item in approvals" :key="item.id" class="approval-card">
      <div class="card-top">
        <div class="amount">¥{{ Number(item.amount).toFixed(2) }}</div>
        <div class="tier-tag">{{ tierLabel(item.tier) }}</div>
      </div>
      <div class="purpose">{{ item.purpose }}</div>
      <div class="applicant">{{ item.applicant_name || '' }} · {{ stepLabel(item.approval_step) }} · {{ item.created_at?.slice(0, 10) }}</div>
      <div class="actions">
        <button v-if="canReview(item)" class="btn-approve" :disabled="actionLoading === item.id" @click="handleApprove(item.id)">通过</button>
        <button v-if="canReview(item)" class="btn-reject" :disabled="actionLoading === item.id" @click="openReject(item.id)">驳回</button>
        <button v-if="canVote(item)" class="btn-vote" @click="openVote(item.id)">投票</button>
      </div>
    </div>

    <!-- 驳回弹窗 -->
    <div v-if="rejectModal.show" class="overlay" @click.self="rejectModal.show = false">
      <div class="modal">
        <h3>驳回申请</h3>
        <p class="modal-desc">请填写驳回原因</p>
        <textarea v-model="rejectNotes" placeholder="驳回原因（选填）" class="modal-textarea" />
        <div class="modal-actions">
          <button class="btn-reject" :disabled="actionLoading === rejectModal.id" @click="handleReject">确认驳回</button>
          <button class="btn-cancel" @click="rejectModal.show = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 投票弹窗 -->
    <div v-if="voteModal.show" class="overlay" @click.self="voteModal.show = false">
      <div class="modal">
        <h3>投票审批</h3>
        <p class="modal-desc">大额支出需干部投票表决</p>
        <div v-if="voteResult" class="vote-progress">
          <div class="vote-bar">
            <div class="vote-fill" :style="{ width: Math.min(100, (voteResult.approveCount / Math.max(voteResult.totalVotes || 1, 1)) * 100) + '%' }"></div>
          </div>
          <div class="vote-stats">
            👍 {{ voteResult.approveCount }} / 👎 {{ voteResult.rejectCount }} · 已投 {{ voteResult.totalVotes }} 票
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-approve" @click="handleVote(voteModal.id, 1)">赞成</button>
          <button class="btn-reject" @click="handleVote(voteModal.id, 2)">反对</button>
          <button class="btn-cancel" @click="voteModal.show = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.approval-page { padding-bottom: 80px; }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.approval-card {
  margin: 8px 12px; padding: 16px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
}
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.amount { font-size: 22px; font-weight: 700; color: var(--color-text); }
.tier-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: var(--color-accent-bg); color: var(--color-accent); }
.purpose { font-size: 14px; color: var(--color-text); margin-bottom: 4px; }
.applicant { font-size: 12px; color: var(--color-text-3); margin-bottom: 12px; }
.actions { display: flex; gap: 8px; }
.actions button {
  flex: 1; height: 38px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer; border: none;
}
.actions button:disabled { opacity: 0.5; }
.btn-approve { background: #dcfce7; color: #16a34a; }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.btn-vote { background: var(--color-accent-bg); color: var(--color-accent); }
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--color-surface); border-radius: var(--radius-lg);
  padding: 24px; width: 300px; max-width: 85vw;
}
.modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--color-text); }
.modal-desc { font-size: 14px; color: var(--color-text-2); margin-bottom: 16px; }
.modal-actions { display: flex; gap: 8px; }
.modal-actions button { flex: 1; height: 40px; border: none; border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); }
.modal-textarea {
  width: 100%; min-height: 60px; padding: 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 14px; resize: vertical; margin-bottom: 12px;
  background: var(--color-surface-2); color: var(--color-text); box-sizing: border-box;
}
.vote-progress { margin-bottom: 14px; }
.vote-bar { height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.vote-fill { height: 100%; background: var(--color-accent); border-radius: 4px; transition: width 0.3s; }
.vote-stats { font-size: 12px; color: var(--color-text-2); text-align: center; }
</style>
