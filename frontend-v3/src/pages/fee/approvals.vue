<script setup lang="ts">
/**
 * 审批 / 投票
 *
 * 2026-09（B3）修复：
 *  - 投票按钮没有禁用/在途锁：弹窗在网络往返期间可重复点击，双击即多记一票，
 *    19 票门槛下足以推动一笔大额支出通过（同文件的通过/驳回其实写对了）。
 *  - 进度条分母用的是"已投票数"，4 人投 3 赞成就显示 75%，严重虚高；
 *    现在按 PRD 门槛（threshold，默认 19 票）计算，并显示「还需 N 票」。
 *  - 加载失败被吞成「暂无待审批事项」，与"真的没有待办"无法区分 → 三态 + 重试。
 *  - 原生 alert/裸 catch 文案「操作失败」→ 统一 toast 且不覆盖后端具体原因。
 */
import { computed, onMounted, ref } from 'vue'
import { approveExpense, castVote, getPendingApprovals, getVoteResult, rejectExpense } from '@/api/fee'
import type { FeeExpense, VoteResult } from '@/api/fee'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const userStore = useUserStore()
const approvals = ref<FeeExpense[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const actionLoading = ref<number | null>(null)
/** 投票在途锁：整个网络往返期间禁止重复提交 */
const voting = ref(false)
const voteError = ref<unknown>(null)
const voteModal = ref<{ id: number; show: boolean }>({ id: 0, show: false })
const voteResult = ref<VoteResult | null>(null)
const voteLoading = ref(false)
const rejectModal = ref<{ id: number; show: boolean }>({ id: 0, show: false })
const rejectNotes = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getPendingApprovals()
    if (res.success) approvals.value = res.approvals || []
    else error.value = new Error('加载待审批列表失败')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleApprove(item: FeeExpense) {
  if (actionLoading.value) return
  actionLoading.value = item.id
  try {
    const res = await approveExpense(item.id)
    if (res.success) {
      showToast('已审批通过', 'success')
      approvals.value = approvals.value.filter(a => a.id !== item.id)
    } else {
      showToast(res.message || '审批失败，请刷新后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '审批失败，请刷新后重试') }
  finally { actionLoading.value = null }
}

function openReject(id: number) {
  rejectModal.value = { id, show: true }
  rejectNotes.value = ''
}

async function handleReject() {
  const id = rejectModal.value.id
  if (actionLoading.value) return
  actionLoading.value = id
  try {
    const res = await rejectExpense(id, rejectNotes.value || undefined)
    if (res.success) {
      showToast('已驳回申请', 'success')
      approvals.value = approvals.value.filter(a => a.id !== id)
      rejectModal.value.show = false
    } else {
      showToast(res.message || '驳回失败，请刷新后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '驳回失败，请刷新后重试') }
  finally { actionLoading.value = null }
}

async function openVote(id: number) {
  voteModal.value = { id, show: true }
  voteResult.value = null
  voteError.value = null
  voteLoading.value = true
  try {
    const res = await getVoteResult(id)
    if (res.success) voteResult.value = res
    else voteError.value = new Error('暂时拿不到计票结果')
  } catch (e) {
    voteError.value = e
  } finally {
    voteLoading.value = false
  }
}

async function handleVote(vote: 1 | 2) {
  // 在途锁：双击/连点只会提交一次
  if (voting.value) return
  const id = voteModal.value.id
  voting.value = true
  try {
    const res = await castVote(id, vote)
    if (res.success) {
      const need = res.threshold || voteResult.value?.threshold || 19
      showToast(`投票成功（${res.approveCount || 0} 赞成，需 ${need} 票）`, 'success')
      voteModal.value = { id: 0, show: false }
      // 保留在列表中，让投票人还能看到后续计票进展（投票已由服务端记录，不会重复计）
      await load()
    } else {
      showToast(res.error || '投票失败，请重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '投票失败，请重试') }
  finally { voting.value = false }
}

const tierLabel = (t: string) => ({ small: '小额', medium: '中额', large: '大额' })[t] || t
const tierVariant = (t: string) => (t === 'large' ? 'danger' : t === 'medium' ? 'warning' : 'info') as 'danger' | 'warning' | 'info'
const stepLabel = (step: number) => ({ 1: '区队长审批', 2: '辅导员审批', 3: '全员投票' })[step] || '待处理'
const canReview = (item: FeeExpense) => userStore.hasPermission('APPROVE_FEE_USE') && item.approval_step !== 3
const canVote = (item: FeeExpense) => item.approval_step === 3

/** 进度按 PRD 门槛计算，而不是"已投票数"，避免虚高误导 */
const voteThreshold = computed(() => voteResult.value?.threshold || 19)
const votePercent = computed(() => {
  const approved = voteResult.value?.approveCount || 0
  return Math.min(100, Math.round((approved / Math.max(voteThreshold.value, 1)) * 100))
})
const votesNeeded = computed(() => Math.max(0, voteThreshold.value - (voteResult.value?.approveCount || 0)))
</script>

<template>
  <div class="approval-page">
    <NavBar title="审批 / 投票" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="approvals.length === 0"
      empty-icon="clipboard"
      empty-title="没有待你处理的事项"
      empty-description="小额支出由区队长审批；大额支出会通知全班投票"
      @retry="load"
    >
      <div v-for="item in approvals" :key="item.id" class="approval-card">
        <div class="card-top">
          <div class="amount">¥{{ Number(item.amount).toFixed(2) }}</div>
          <BaseBadge :variant="tierVariant(item.tier)" size="md">{{ tierLabel(item.tier) }}</BaseBadge>
        </div>
        <div class="purpose">{{ item.purpose }}</div>
        <div class="applicant">
          {{ item.applicant_name || '同学' }} · {{ stepLabel(item.approval_step) }}
          <template v-if="item.created_at"> · {{ item.created_at.slice(0, 10) }}</template>
        </div>
        <div class="actions">
          <BaseButton
            v-if="canReview(item)"
            variant="secondary"
            size="md"
            :loading="actionLoading === item.id"
            @click="handleApprove(item)"
          >
            通过
          </BaseButton>
          <BaseButton
            v-if="canReview(item)"
            variant="ghost"
            size="md"
            :disabled="actionLoading === item.id"
            @click="openReject(item.id)"
          >
            驳回
          </BaseButton>
          <BaseButton v-if="canVote(item)" size="md" @click="openVote(item.id)">
            去投票
          </BaseButton>
        </div>
      </div>
    </StateView>

    <!-- 驳回弹窗 -->
    <BaseModal v-model="rejectModal.show" title="驳回申请" danger>
      <p class="modal-desc">驳回后申请人需要重新提交，请说明原因。</p>
      <textarea v-model="rejectNotes" class="modal-textarea" placeholder="驳回原因（选填，会展示给申请人）" />
      <template #footer>
        <BaseButton variant="secondary" @click="rejectModal.show = false">取消</BaseButton>
        <BaseButton variant="danger" :loading="actionLoading === rejectModal.id" @click="handleReject">
          确认驳回
        </BaseButton>
      </template>
    </BaseModal>

    <!-- 投票弹窗 -->
    <BaseModal v-model="voteModal.show" title="大额支出投票">
      <p class="modal-desc">按班费管理办法，大额支出需全班匿名投票，<b>{{ voteThreshold }} 票</b>以上同意方可通过。</p>

      <div v-if="voteLoading" class="vote-loading">正在获取计票结果…</div>
      <template v-else-if="voteResult">
        <div class="vote-progress">
          <div class="vote-bar">
            <div class="vote-fill" :style="{ width: votePercent + '%' }" />
          </div>
          <div class="vote-stats">
            <span class="ok"><AppIcon name="thumbsUp" :size="14" /> {{ voteResult.approveCount }} 赞成</span>
            <span class="no">{{ voteResult.rejectCount }} 反对</span>
            <span class="total">已投 {{ voteResult.totalVotes }} 票</span>
          </div>
          <div class="vote-need">
            <template v-if="voteResult.thresholdMet">已达到通过门槛</template>
            <template v-else>还需 {{ votesNeeded }} 票赞成（门槛 {{ voteThreshold }} 票）</template>
          </div>
        </div>
      </template>
      <div v-else class="vote-loading">
        暂时拿不到计票结果，仍可投票，结果以服务端为准
      </div>

      <template #footer>
        <BaseButton variant="secondary" :disabled="voting" @click="voteModal.show = false">取消</BaseButton>
        <BaseButton :loading="voting" @click="handleVote(1)">赞成</BaseButton>
        <BaseButton variant="danger" :disabled="voting" @click="handleVote(2)">反对</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.approval-page { padding-bottom: var(--spacing-lg); }
.approval-card {
  margin: 8px 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.amount { font-size: var(--font-size-title); font-weight: 700; color: var(--color-text); }
.purpose { font-size: var(--font-size-body); color: var(--color-text); margin-bottom: 4px; }
.applicant { font-size: var(--font-size-xs); color: var(--color-text-3); margin-bottom: 12px; }
.actions { display: flex; gap: 8px; }
.actions > :deep(*) { flex: 1; }

.modal-desc { font-size: var(--font-size-body); color: var(--color-text-2); margin-bottom: 12px; line-height: 1.55; }
.modal-textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  font-family: inherit;
  resize: vertical;
  background: var(--color-surface-2);
  color: var(--color-text);
  box-sizing: border-box;
}
.vote-loading { font-size: var(--font-size-sm); color: var(--color-text-3); padding: 8px 0 12px; }
.vote-progress { margin-bottom: 4px; }
.vote-bar { height: 8px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; margin-bottom: 8px; }
.vote-fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-full); transition: width var(--dur-base); }
.vote-stats {
  display: flex; gap: 12px; font-size: var(--font-size-xs); color: var(--color-text-2);
}
.vote-stats .ok { color: var(--color-success); display: inline-flex; align-items: center; gap: 2px; }
.vote-need { margin-top: 6px; font-size: var(--font-size-xs); color: var(--color-text-3); }
</style>
