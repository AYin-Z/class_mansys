<script setup lang="ts">
import { mediaUrl, openMedia } from '@/utils/media'
import { ref, onMounted, computed } from 'vue'
import { getAllLeaves, approveLeave, cancelLeave } from '@/api/leave'
import type { LeaveItem } from '@/api/leave'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const leaves = ref<LeaveItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)
const actionLoading = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const proofViewUrl = ref<string | null>(null)
const approvalNote = ref('')
const cancelling = ref<number | null>(null)
/** 驳回弹窗（此前用原生 prompt，在 Capacitor 壳里可能返回 null 导致驳回静默失败，还丢掉已填意见） */
const rejectModal = ref<{ id: number; show: boolean }>({ id: 0, show: false })
const rejectNote = ref('')

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getAllLeaves()
    if (res.success) {
      leaves.value = (res.leaves || []).sort((a, b) => a.status - b.status)
    } else {
      error.value = new Error('加载请假列表失败')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

async function handleAdminCancel(id: number) {
  const item = leaves.value.find(l => l.id === id)
  const ok = await showConfirm(
    '管理员销假',
    `确认对「${item?.applicant_name || '该同学'}」的请假执行销假？`,
    { confirmText: '确认销假', danger: true, hint: '销假后该请假立即失效，同学如需再休必须重新申请' },
  )
  if (!ok) return
  cancelling.value = id
  try {
    const res = await cancelLeave(id)
    if (res.success) {
      showToast('已销假', 'success')
      leaves.value = leaves.value.map(l => l.id === id ? { ...l, is_cancelled: true } : l)
    } else {
      showToast(res.message || '销假失败，请刷新后重试', 'error')
    }
  } catch (e) { toastIfNotNotified(e, '销假失败，请刷新后重试') }
  finally { cancelling.value = null }
}

function getAttachments(item: any): string[] {
  try {
    const raw = item.attachments
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') return JSON.parse(raw)
  } catch {}
  return []
}

function viewProof(url: string) { proofViewUrl.value = url }

const TABS = ['待审批', '生效中', '已销假', '已驳回']
const activeTab = ref(0)

const now = new Date()

const filteredLeaves = computed(() => {
  const parseLocal = (t: string) => {
    const [date, time] = (t || '').split(' ')
    if (!date || !time) return new Date(NaN)
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm, ss] = time.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, ss || 0)
  }
  if (activeTab.value === 0) {
    return leaves.value.filter(l => l.status === 0)
  }
  if (activeTab.value === 1) {
    // 生效中：已通过 + 未销假 + 当前时间在请假范围内
    return leaves.value.filter(l => {
      if (l.status !== 1 || l.is_cancelled) return false
      const end = parseLocal(l.end_time)
      return end >= now
    })
  }
  if (activeTab.value === 2) {
    // 已销假：已通过 + 已过结束时间
    return leaves.value.filter(l => {
      if (l.status !== 1) return false
      const end = parseLocal(l.end_time)
      return l.is_cancelled || end < now
    })
  }
  if (activeTab.value === 3) {
    return leaves.value.filter(l => l.status === 2)
  }
  return leaves.value
})

onMounted(load)

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handleApprove(id: number) {
  if (actionLoading.value) return
  actionLoading.value = id
  try {
    const res = await approveLeave(id, 1, approvalNote.value.trim() || undefined)
    if (res.success) {
      showToast('已通过该请假', 'success')
      leaves.value = leaves.value.filter(l => l.id !== id)
      if (expandedId.value === id) { expandedId.value = null; approvalNote.value = '' }
    } else {
      showToast(res.message || '审批失败，请刷新后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '审批失败，请刷新后重试')
  } finally {
    actionLoading.value = null
  }
}

function openReject(id: number) {
  rejectModal.value = { id, show: true }
  // 把干部在卡片里已填的审批意见带进来，不要在驳回时丢掉
  rejectNote.value = approvalNote.value.trim()
}

async function handleReject() {
  const id = rejectModal.value.id
  if (actionLoading.value) return
  actionLoading.value = id
  try {
    const res = await approveLeave(id, 2, rejectNote.value.trim() || undefined)
    if (res.success) {
      showToast('已驳回该请假', 'success')
      leaves.value = leaves.value.filter(l => l.id !== id)
      rejectModal.value.show = false
      if (expandedId.value === id) { expandedId.value = null; approvalNote.value = '' }
    } else {
      showToast(res.message || '驳回失败，请刷新后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '驳回失败，请刷新后重试')
  } finally {
    actionLoading.value = null
  }
}

function timeRange(item: LeaveItem) {
  const s = item.start_time?.slice(0, 16)
  const e = item.end_time?.slice(0, 16)
  return `${s} ~ ${e}`
}

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''
</script>

<template>
  <div class="approval-page">
    <NavBar title="请假审批" show-back />

    <div class="tabs">
      <span v-for="(tab, i) in TABS" :key="i"
        :class="['tab', { active: activeTab === i }]"
        @click="activeTab = i">{{ tab }}</span>
    </div>

    <StateView
      :loading="loading"
      :error="error"
      :empty="filteredLeaves.length === 0"
      empty-icon="calendar"
      :empty-variant="activeTab === 0 ? 'default' : 'filtered'"
      :empty-title="activeTab === 0 ? '没有待审批的请假' : '当前分类下没有记录'"
      :empty-description="activeTab === 0 ? '同学提交请假后会出现在这里' : '换个分类看看，或稍后下拉刷新'"
      @retry="load"
    >
      <div v-for="item in filteredLeaves" :key="item.id"
        :class="['card', { expanded: expandedId === item.id }]"
        @click="toggleExpand(item.id)">

      <div class="card-main">
        <div class="card-header">
          <div class="applicant-info">
            <span class="applicant-name">{{ item.applicant_name || '未知' }}</span>
            <span class="student-id">{{ item.applicant_student_id || '' }}</span>
          </div>
          <span :class="['status-badge', statusClass(item.status)]">{{ statusLabel(item.status) }}</span>
        </div>

        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-label">类型</span>
            <span class="meta-value">{{ item.leave_type }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">时间</span>
            <span class="meta-value">{{ timeRange(item) }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">原因</span>
            <span class="meta-value reason-snippet">{{ item.reason }}</span>
          </div>
        </div>
      </div>

      <template v-if="expandedId === item.id">
        <div class="card-expanded">
          <div class="full-reason">
            <div class="expanded-label">请假原因</div>
            <p>{{ item.reason }}</p>
          </div>
          <div v-if="getAttachments(item).length > 0" class="proof-section">
            <div class="expanded-label">证明材料</div>
            <div class="proof-imgs">
              <img v-for="(url, i) in getAttachments(item)" :key="i" :src="mediaUrl(url)" class="proof-img" @click.stop="viewProof(url)" />
            </div>
          </div>
          <div v-if="item.approval_notes" class="approval-notes">
            <div class="expanded-label">审批意见</div>
            <p>{{ item.approval_notes }}</p>
          </div>
          <div v-if="item.status === 1 && !item.is_cancelled" class="actions" @click.stop>
            <BaseButton variant="ghost" size="md" :loading="cancelling === item.id" @click="handleAdminCancel(item.id)">
              管理员销假
            </BaseButton>
          </div>
          <div v-if="item.status === 0" class="actions" @click.stop>
            <input v-model="approvalNote" class="note-input" placeholder="审批意见（选填）" maxlength="100" />
            <BaseButton size="md" :loading="actionLoading === item.id" @click="handleApprove(item.id)">
              通过
            </BaseButton>
            <BaseButton variant="danger" size="md" :disabled="actionLoading === item.id" @click="openReject(item.id)">
              驳回
            </BaseButton>
          </div>
        </div>
      </template>
      </div>
    </StateView>

    <!-- 驳回弹窗（替代原生 prompt） -->
    <BaseModal v-model="rejectModal.show" title="驳回请假" danger>
      <p class="modal-desc">驳回后同学需要重新提交申请，请说明原因。</p>
      <textarea v-model="rejectNote" class="note-textarea" placeholder="驳回原因（选填，会展示给同学）" maxlength="200" />
      <template #footer>
        <BaseButton variant="secondary" :disabled="actionLoading === rejectModal.id" @click="rejectModal.show = false">取消</BaseButton>
        <BaseButton variant="danger" :loading="actionLoading === rejectModal.id" @click="handleReject">确认驳回</BaseButton>
      </template>
    </BaseModal>

    <!-- 图片查看器 -->
    <div v-if="proofViewUrl" class="viewer-overlay" @click="proofViewUrl = null">
      <div class="viewer-close" @click="proofViewUrl = null">
        <AppIcon name="close" :size="22" />
      </div>
      <img :src="mediaUrl(proofViewUrl)" class="viewer-img" @click.stop />
    </div>
  </div>
</template>

<style scoped>
.approval-page { padding-bottom: var(--spacing-lg); }

.tabs {
  display: flex; gap: 4px; padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}
.tab {
  font-size: 13px; font-weight: 500; padding: 6px 14px;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--color-text-2); white-space: nowrap;
  transition: all 0.15s;
}
.tab.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

.modal-desc { font-size: var(--font-size-body); color: var(--color-text-2); margin-bottom: 12px; line-height: 1.55; }
.note-textarea {
  width: 100%; min-height: 80px; padding: 10px 12px; box-sizing: border-box;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-surface-2); color: var(--color-text);
  font-size: var(--font-size-body); font-family: inherit; resize: vertical;
}

.card {
  margin: 8px 12px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  overflow: hidden; cursor: pointer;
  transition: box-shadow 0.2s;
}
.card:active { box-shadow: var(--shadow-card-hover); }

.card-main { padding: 14px 16px; }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.applicant-info { display: flex; align-items: center; gap: 8px; }
.applicant-name { font-size: 15px; font-weight: 600; color: var(--color-text); }
.student-id { font-size: 12px; color: var(--color-text-3); }

.status-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.status-badge.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.status-badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.status-badge.rejected { background: var(--color-error-bg); color: var(--color-error); }

.meta-row {
  display: flex; gap: 8px; font-size: 13px;
  color: var(--color-text-2); line-height: 1.6;
}
.meta-label { color: var(--color-text-3); flex-shrink: 0; min-width: 32px; }
.meta-value { flex: 1; }
.reason-snippet {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.card-expanded {
  border-top: 1px solid var(--color-border);
  padding: 14px 16px;
  animation: slideIn 0.2s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.full-reason, .approval-notes { margin-bottom: 14px; }
.expanded-label { font-size: 12px; font-weight: 600; color: var(--color-text-3); margin-bottom: 4px; }
.full-reason p, .approval-notes p {
  font-size: 14px; line-height: 1.7; color: var(--color-text);
  margin: 0;
}

.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.actions > :deep(.btn) { flex: 1; }
.note-input { width: 100%; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; background: var(--color-bg); color: var(--color-text); outline: none; margin-bottom: 8px; box-sizing: border-box; }

.proof-section { margin-bottom: 12px; }
.proof-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.proof-img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; cursor: pointer; }
.viewer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 200; display: flex; align-items: center; justify-content: center; }
.viewer-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; cursor: pointer; background: rgba(255,255,255,0.15); border-radius: 50%; z-index: 10; }
.viewer-img { max-width: 100%; max-height: 80vh; object-fit: contain; }
</style>
