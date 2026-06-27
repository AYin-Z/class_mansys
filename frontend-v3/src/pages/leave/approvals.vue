<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getAllLeaves, approveLeave, cancelLeave } from '@/api/leave'
import type { LeaveItem } from '@/api/leave'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const leaves = ref<LeaveItem[]>([])
const loading = ref(true)
const actionLoading = ref<number | null>(null)
const expandedId = ref<number | null>(null)
const proofViewUrl = ref<string | null>(null)
const approvalNote = ref('')
const cancelling = ref<number | null>(null)

async function handleAdminCancel(id: number) {
  cancelling.value = id
  try {
    const res = await cancelLeave(id)
    if (res.success) {
      showToast('已销假')
      leaves.value = leaves.value.map(l => l.id === id ? { ...l, is_cancelled: true } : l)
    } else {
      showToast(res.message || '操作失败', 'error')
    }
  } catch (_) { showToast('操作失败', 'error') }
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

onMounted(async () => {
  try {
    const res = await getAllLeaves()
    if (res.success) {
      leaves.value = (res.leaves || []).sort((a, b) => a.status - b.status)
    }
  } catch (_) {
    showToast('加载失败', 'error')
  } finally {
    loading.value = false
  }
})

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handleApprove(id: number) {
  actionLoading.value = id
  try {
    const res = await approveLeave(id, 1, approvalNote.value.trim() || undefined)
    if (res.success) {
      showToast('已通过')
      leaves.value = leaves.value.filter(l => l.id !== id)
      if (expandedId.value === id) { expandedId.value = null; approvalNote.value = '' }
    } else {
      showToast(res.message || '操作失败', 'error')
    }
  } catch (_) {
    showToast('操作失败', 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleReject(id: number) {
  const notes = prompt('驳回原因（选填）：')
  if (notes === null) return // user cancelled
  actionLoading.value = id
  try {
    const res = await approveLeave(id, 2, notes || undefined)
    if (res.success) {
      showToast('已驳回')
      leaves.value = leaves.value.filter(l => l.id !== id)
      if (expandedId.value === id) { expandedId.value = null; approvalNote.value = '' }
    } else {
      showToast(res.message || '操作失败', 'error')
    }
  } catch (_) {
    showToast('操作失败', 'error')
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

    <div v-if="loading" class="state-msg">加载中...</div>
    <div v-else-if="filteredLeaves.length === 0" class="state-msg">暂无审批记录</div>

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
              <img v-for="(url, i) in getAttachments(item)" :key="i" :src="url" class="proof-img" @click.stop="viewProof(url)" />
            </div>
          </div>
          <div v-if="item.approval_notes" class="approval-notes">
            <div class="expanded-label">审批意见</div>
            <p>{{ item.approval_notes }}</p>
          </div>
          <div v-if="item.status === 1 && !item.is_cancelled" class="actions" @click.stop>
            <button class="btn btn-cancel"
              :disabled="cancelling === item.id"
              @click="handleAdminCancel(item.id)">
              {{ cancelling === item.id ? '…' : '管理员销假' }}
            </button>
          </div>
          <div v-if="item.status === 0" class="actions" @click.stop>
            <input v-model="approvalNote" class="note-input" placeholder="审批意见（选填）" maxlength="100" />
            <button class="btn btn-approve"
              :disabled="actionLoading === item.id"
              @click="handleApprove(item.id)">
              通过
            </button>
            <button class="btn btn-reject"
              :disabled="actionLoading === item.id"
              @click="handleReject(item.id)">
              驳回
            </button>
          </div>
        </div>
      </template>
    </div>
    <!-- 图片查看器 -->
    <div v-if="proofViewUrl" class="viewer-overlay" @click="proofViewUrl = null">
      <div class="viewer-close" @click="proofViewUrl = null">✕</div>
      <img :src="proofViewUrl" class="viewer-img" @click.stop />
    </div>
  </div>
</template>

<style scoped>
.approval-page { padding-bottom: 80px; }

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

.state-msg { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }

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
.status-badge.approved { background: #dcfce7; color: #16a34a; }
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

.actions { display: flex; gap: 8px; }
.btn {
  flex: 1; height: 40px; border: none; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:active:not(:disabled) { opacity: 0.85; }
.btn-approve { background: #dcfce7; color: #16a34a; }
.btn-reject { background: var(--color-error-bg); color: var(--color-error); }
.btn-cancel { background: var(--color-surface-hover); color: var(--color-text-2); width: 100%; }
.note-input { width: 100%; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; background: var(--color-bg); color: var(--color-text); outline: none; margin-bottom: 8px; box-sizing: border-box; }

.proof-section { margin-bottom: 12px; }
.proof-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.proof-img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; cursor: pointer; }
.viewer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 200; display: flex; align-items: center; justify-content: center; }
.viewer-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; cursor: pointer; background: rgba(255,255,255,0.15); border-radius: 50%; z-index: 10; }
.viewer-img { max-width: 100%; max-height: 80vh; object-fit: contain; }
</style>
