<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/ui/NavBar.vue'
import { useUserStore } from '@/stores/user'
import { getSummary, getPendingApprovals } from '@/api/fee'
import { getUnreadCount, getTodoCount } from '@/api/notice'
import { getAllSuggestions } from '@/api/suggestion'
import { getAllLeaves } from '@/api/leave'

import type { LeaveItem } from '@/api/leave'

const router = useRouter()
const userStore = useUserStore()
const isAdmin = userStore.isAdmin
const feeSummary = ref<any>(null)
const unreadNoticeCount = ref(0)
const pendingFeeCount = ref(0)
const pendingLeaveCount = ref(0)
const pendingSuggestionCount = ref(0)
const allLeaves = ref<LeaveItem[]>([])
const todoCount = ref(0)
const myLeaveCount = ref(0)
const loading = ref(true)

// 当前用户的请假统计
const myActiveLeaves = computed(() => {
  const now = new Date()
  const parseLocal = (t: string) => {
    const [date, time] = (t || '').split(' ')
    if (!date || !time) return new Date(NaN)
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm, ss] = time.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm, ss || 0)
  }
  return allLeaves.value.filter(l =>
    l.user_id === userStore.profile?.id &&
    l.status === 1 && !l.is_cancelled &&
    parseLocal(l.start_time || '') <= now &&
    parseLocal(l.end_time || '') >= now
  )
})

// ── 请假矩阵计算 ──
interface MatrixCell {
  name: string
  student_id: string
  start: string
  end: string
  reason: string
}
const leaveMatrix = computed(() => {
  const now = new Date()
  const active = allLeaves.value.filter(l => {
    if (l.status !== 1 || l.is_cancelled) return false
    // 后端返回 "2026-06-02 13:00:00" 无时区，强制按本地时间解析
    const parseLocal = (t: string) => {
      const [date, time] = (t || '').split(' ')
      if (!date || !time) return new Date(NaN)
      const [y, m, d] = date.split('-').map(Number)
      const [hh, mm, ss] = time.split(':').map(Number)
      return new Date(y, m - 1, d, hh, mm, ss || 0)
    }
    const start = parseLocal(l.start_time || '')
    const end = parseLocal(l.end_time || '')
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
    return start <= now && end >= now
  })
  // 固定时段请假类型：只在对应时间段内生效
  const FIXED_WINDOWS: Record<string, [number, number]> = {
    '早操': [6 * 60, 7 * 60],
    '早集合': [7 * 60, 8 * 60 + 10],
    '午集合': [13 * 60, 14 * 60],
    '收假集合': [18 * 60, 19 * 60],
    '晚自习': [18 * 60 + 30, 20 * 60 + 30],
  }

  function isInFixedWindow(leave: any): boolean {
    const window = FIXED_WINDOWS[leave.leave_type]
    if (!window) return true // 非固定类型直接通过
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return nowMin >= window[0] && nowMin < window[1]
  }

  // 按 leave_type 分组，同一人同原因合并
  const groups: Record<string, Map<number, { name: string; student_id: string; start: string; end: string; startRaw: string; endRaw: string; reason: string }>> = {}
  const typeReasonCounts: Record<string, Record<string, number>> = {}
  for (const l of active) {
    if (!isInFixedWindow(l)) continue
    const type = l.leave_type || '其他'
    if (!groups[type]) { groups[type] = new Map(); typeReasonCounts[type] = {} }
    const reasonKey = (l.reason || '未知').split('：')[0]
    typeReasonCounts[type][reasonKey] = (typeReasonCounts[type][reasonKey] || 0) + 1
    const uid = l.user_id
    const mergeKey = `${uid}_${reasonKey}`
    const existing = groups[type].get(mergeKey)
    const cell = {
      name: l.applicant_name || `用户${uid}`,
      student_id: l.applicant_student_id || '',
      start: formatLeaveDate(l.start_time),
      end: formatLeaveDate(l.end_time),
      startRaw: l.start_time,
      endRaw: l.end_time,
      reason: l.reason || '',
    }
    if (existing) {
      if (cell.startRaw < existing.startRaw) { existing.start = cell.start; existing.startRaw = cell.startRaw }
      if (cell.endRaw > existing.endRaw) { existing.end = cell.end; existing.endRaw = cell.endRaw }
    } else {
      groups[type].set(mergeKey, cell)
    }
  }
  const result: Record<string, { cells: MatrixCell[]; reasons: string[] }> = {}
  for (const [type, map] of Object.entries(groups)) {
    const cells = Array.from(map.values()).map(({ name, student_id, start, end, reason }) => ({ name, student_id, start, end, reason }))
    const counts = typeReasonCounts[type] || {}
    const reasons = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => v > 1 ? `${k}×${v}` : k)
    result[type] = { cells, reasons }
  }
  return result
})

const leaveTypes = computed(() => Object.keys(leaveMatrix.value).sort())
const activeLeaveTotal = computed(() =>
  Object.values(leaveMatrix.value).reduce((sum, v) => sum + v.cells.length, 0)
)

function formatLeaveDate(t: string) {
  if (!t) return ''
  const [date, time] = t.split(' ')
  if (!date || !time) return ''
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return `${m}/${d} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    const [summaryRes, approvalRes, noticeRes, suggestionRes, leaveRes, todoRes] = await Promise.all([
      getSummary().catch(() => null),
      getPendingApprovals().catch(() => null),
      getUnreadCount().catch(() => null),
      getAllSuggestions({ status: 0 }).catch(() => null),
      getAllLeaves().catch(() => null),
      getTodoCount().catch(() => null),
    ])
    if (summaryRes?.success) feeSummary.value = summaryRes.data?.summary || summaryRes.summary
    if (approvalRes?.success) pendingFeeCount.value = approvalRes.approvals?.length || 0
    if (noticeRes?.success) unreadNoticeCount.value = noticeRes.count
    if (suggestionRes?.success) pendingSuggestionCount.value = suggestionRes.suggestions?.length || 0
    if (leaveRes?.success) {
      allLeaves.value = leaveRes.leaves || []
      pendingLeaveCount.value = allLeaves.value.filter(l => l.status === 0 && !l.is_cancelled).length
    }
    if (todoRes?.success) todoCount.value = todoRes.count
  } catch (_) {}
  finally { loading.value = false }
})

interface MgmtItem {
  icon: string
  label: string
  path: string
  badge?: boolean | (() => number)
  desc?: string
}

const mgmtGroups = computed<{ name: string; items: MgmtItem[] }[]>(() => [
  {
    name: '人事管理',
    items: [
      { icon: '👥', label: '成员管理', path: '/pages/admin/members', desc: '查看所有成员信息' },
      { icon: '🏥', label: '请假审批', path: '/pages/leave/approvals', desc: `${pendingLeaveCount.value} 条待审批`, badge: true },
      { icon: '📢', label: '通知管理', path: '/pages/notice/admin', desc: `${unreadNoticeCount.value} 条待办` },
      { icon: '💡', label: '建议箱', path: '/pages/suggestion/inbox', desc: `${pendingSuggestionCount.value} 条待处理` },
    ]
  },
  {
    name: '财务与教务',
    items: [
      { icon: '💰', label: '班费审批', path: '/pages/fee/approvals', desc: '待审批列表', badge: true },
      { icon: '📒', label: '班费账本', path: '/pages/fee/index', desc: '收支记录与收缴' },
      { icon: '📝', label: '作业管理', path: '/pages/homework/index', desc: '发布与批改' },
      { icon: '⭐', label: '积分管理', path: '/pages/points/manage', desc: '积分规则与调整' },
    ]
  },
  {
    name: '活动与互动',
    items: [
      { icon: '🗳️', label: '投票管理', path: '/pages/vote/manage', desc: '创建与管理投票' },
      { icon: '🏆', label: '擂台管理', path: '/pages/challenge/manage', desc: 'PK挑战管理' },
      { icon: '🎰', label: '抽奖管理', path: '/pages/lottery/manage', desc: '抽奖活动配置' },
    ]
  },
  {
    name: '内容管理',
    items: [
      { icon: '📣', label: '公告管理', path: '/pages/announcement/admin', desc: '公告与资源共享管理' },
      { icon: '🖼️', label: '相册管理', path: '/pages/album/index', desc: '上传与管理照片' },
    ]
  },
])
</script>
<template>
  <div class="dashboard-page">
    <NavBar title="仪表盘" show-back />

    <div v-if="loading" class="loading-state">加载中...</div>

    <template v-else>
      <!-- ≡≡ 管理员仪表盘 ≡≡ -->
      <template v-if="isAdmin">
        <!-- 待处理 -->
        <div class="section-title">待处理</div>
        <div class="pending-row">
          <div class="pending-item" @click="router.push('/pages/notice/admin')">
            <span class="count">{{ unreadNoticeCount }}</span>
            <span class="label">📢 通知待办</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/fee/approvals')">
            <span class="count">{{ pendingFeeCount }}</span>
            <span class="label">💰 班费审批</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/leave/approvals')">
            <span class="count">{{ pendingLeaveCount }}</span>
            <span class="label">🏥 请假审批</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/suggestion/inbox')">
            <span class="count">{{ pendingSuggestionCount }}</span>
            <span class="label">💡 建议待开</span>
          </div>
        </div>

        <!-- 实时请假矩阵 -->
        <div class="section-title">
          请假矩阵
          <span v-if="activeLeaveTotal > 0" class="matrix-badge">{{ activeLeaveTotal }} 人离队</span>
          <span v-else class="matrix-badge empty">全员在队</span>
          <span class="matrix-link" @click="router.push('/pages/leave/approvals')">全部请假情况 ›</span>
        </div>
        <div v-if="activeLeaveTotal === 0" class="matrix-empty">🎉 当前没有请假外出人员，全员在队</div>
        <div v-else class="matrix-card">
          <div v-for="type in leaveTypes" :key="type" class="matrix-row">
            <div class="matrix-type">{{ type }}<span class="type-count">{{ leaveMatrix[type].cells.length }}</span><span class="type-reasons">{{ leaveMatrix[type].reasons.join(" ") }}</span></div>
            <div class="matrix-cells">
              <div v-for="cell in leaveMatrix[type].cells" :key="cell.student_id + cell.start" class="matrix-cell">
                <span class="cell-name">{{ cell.name }} <span class="cell-sid">{{ cell.student_id }}</span></span>
                <span class="cell-time">{{ cell.start }} ~ {{ cell.end }}</span>
                <span class="cell-reason">{{ cell.reason }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 管理功能 -->
        <div class="section-title">管理功能</div>
        <div class="mgmt-section">
          <div v-for="group in mgmtGroups" :key="group.name" class="mgmt-group">
            <div class="mgmt-group-title">{{ group.name }}</div>
            <div class="mgmt-grid">
              <div v-for="item in group.items" :key="item.label" class="mgmt-card" @click="router.push(item.path)">
                <div class="mgmt-icon">{{ item.icon }}</div>
                <div class="mgmt-info">
                  <div class="mgmt-label">{{ item.label }}</div>
                  <div class="mgmt-desc">{{ item.desc }}</div>
                </div>
                <div class="mgmt-arrow">›</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ≡≡ 学员仪表盘 ≡≡ -->
      <template v-else>
        <div class="section-title">我的概况</div>
        <div class="pending-row">
          <div class="pending-item" @click="router.push('/pages/notice/index')">
            <span class="count">{{ unreadNoticeCount }}</span>
            <span class="label">📢 未读通知</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/notice/index')">
            <span class="count">{{ todoCount }}</span>
            <span class="label">📋 待完成任务</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/leave/index')">
            <span class="count">{{ myActiveLeaves.length }}</span>
            <span class="label">🏥 生效中请假</span>
          </div>
          <div class="pending-item" @click="router.push('/pages/fee/index')">
            <span class="count">¥{{ feeSummary ? Number(feeSummary.balance).toFixed(0) : '--' }}</span>
            <span class="label">💰 班费余额</span>
          </div>
        </div>

        <!-- 全班请假情况 -->
        <div class="section-title">
          全班请假
          <span v-if="activeLeaveTotal > 0" class="matrix-badge">{{ activeLeaveTotal }} 人离队</span>
          <span v-else class="matrix-badge empty">全员在队</span>
          <span class="matrix-link" @click="router.push('/pages/leave/index')">我的请假 ›</span>
        </div>
        <div v-if="activeLeaveTotal === 0" class="matrix-empty">🎉 当前没有请假外出人员，全员在队</div>
        <div v-else class="matrix-card">
          <div v-for="type in leaveTypes" :key="type" class="matrix-row">
            <div class="matrix-type">{{ type }}<span class="type-count">{{ leaveMatrix[type].cells.length }}</span><span class="type-reasons">{{ leaveMatrix[type].reasons.join(" ") }}</span></div>
            <div class="matrix-cells">
              <div v-for="cell in leaveMatrix[type].cells" :key="cell.student_id + cell.start" class="matrix-cell">
                <span class="cell-name">{{ cell.name }} <span class="cell-sid">{{ cell.student_id }}</span></span>
                <span class="cell-time">{{ cell.start }} ~ {{ cell.end }}</span>
                <span class="cell-reason">{{ cell.reason }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 快捷入口 -->
        <div class="section-title">常用功能</div>
        <div class="quick-grid">
          <div class="quick-item" @click="router.push('/pages/leave/apply')">🏥 请假</div>
          <div class="quick-item" @click="router.push('/pages/fee/expense-apply')">🧾 报销</div>
          <div class="quick-item" @click="router.push('/pages/homework/index')">📝 作业</div>
          <div class="quick-item" @click="router.push('/pages/album/index')">🖼️ 相册</div>
          <div class="quick-item" @click="router.push('/pages/vote/index')">🗳️ 投票</div>
          <div class="quick-item" @click="router.push('/pages/features/index')">📱 更多</div>
        </div>
      </template>

      <!-- ≡≡ 公有：班费概况 ≡≡ -->
      <div class="section-title">班费概况</div>
      <div v-if="feeSummary" class="data-card">
        <div class="data-row">
          <span class="label">当前余额</span>
          <span class="value accent">¥{{ Number(feeSummary.balance).toFixed(2) }}</span>
        </div>
        <div class="data-row">
          <span class="label">总收入</span>
          <span class="value">¥{{ Number(feeSummary.totalIncome).toFixed(2) }}</span>
        </div>
        <div class="data-row">
          <span class="label">总支出</span>
          <span class="value">¥{{ Number(feeSummary.totalExpense).toFixed(2) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
<style scoped>
.dashboard-page { padding-bottom: 80px; }
.loading-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }
.pending-row {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  padding: 0 12px; margin-bottom: 4px;
}
@media (min-width: 480px) { .pending-row { grid-template-columns: repeat(4, 1fr); } }
.pending-item {
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 16px 6px; text-align: center;
  cursor: pointer;
}
.pending-item .count { font-size: 24px; font-weight: 700; color: var(--color-accent); display: block; }
.pending-item .label { font-size: 11px; color: var(--color-text-2); margin-top: 4px; display: block; }

/* 管理功能（二级菜单） */
.mgmt-section { padding: 0 12px; }
.mgmt-group { margin-bottom: 8px; }
.mgmt-group-title {
  font-size: 11px; font-weight: 600; color: var(--color-text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 4px 4px 6px;
}
.mgmt-grid { display: grid; grid-template-columns: 1fr; gap: 6px; }
@media (min-width: 768px) { .mgmt-grid { grid-template-columns: 1fr 1fr; } }
.mgmt-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 14px 16px;
  cursor: pointer; transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.mgmt-card:active { background: var(--color-surface-hover); }
.mgmt-icon { font-size: 22px; flex-shrink: 0; width: 36px; text-align: center; }
.mgmt-info { flex: 1; min-width: 0; }
.mgmt-label { font-size: 14px; font-weight: 600; color: var(--color-text); }
.mgmt-desc { font-size: 11px; color: var(--color-text-3); margin-top: 2px; }
.mgmt-arrow { font-size: 18px; color: var(--color-text-3); flex-shrink: 0; }

/* data card */
.data-card {
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 16px; margin: 0 12px;
}
.data-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
.data-row + .data-row { border-top: 1px solid var(--color-border); }
.data-row .label { color: var(--color-text-2); }
.data-row .value { font-weight: 600; color: var(--color-text); }
.data-row .value.accent { color: var(--color-accent); font-size: 16px; }

/* ── 请假矩阵 ── */
.matrix-badge {
  font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 10px;
  background: var(--color-warning-bg); color: var(--color-warning);
  margin-left: 8px; vertical-align: middle;
}
.matrix-badge.empty { background: #dcfce7; color: #16a34a; }

.matrix-link {
  font-size: 12px; color: var(--color-accent); cursor: pointer;
  margin-left: auto; font-weight: 400; white-space: nowrap;
}

.matrix-empty {
  text-align: center; padding: 16px; margin: 0 12px;
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); font-size: 14px; color: var(--color-text-3);
}

.matrix-card {
  margin: 0 12px; background: var(--color-surface);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
  overflow: hidden;
}

.matrix-row {
  display: flex; border-bottom: 1px solid var(--color-border);
}
.matrix-row:last-child { border-bottom: none; }

.matrix-type {
  width: 72px; flex-shrink: 0;
  padding: 12px 10px; font-size: 13px; font-weight: 700;
  color: var(--color-accent); background: var(--color-accent-bg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; word-break: keep-all; gap: 4px;
}
.type-count {
  font-size: 16px; font-weight: 800; color: var(--color-accent);
  line-height: 1;
}
.type-reasons {
  font-size: 9px; color: var(--color-text-3); line-height: 1.3;
  text-align: center; word-break: keep-all; margin-top: 2px;
}

.matrix-cells {
  flex: 1; padding: 8px 12px; display: flex; flex-wrap: wrap; gap: 6px;
}

.matrix-cell {
  background: var(--color-bg); border-radius: var(--radius-sm);
  padding: 6px 10px; display: flex; flex-direction: column; gap: 2px;
  border-left: 2px solid var(--color-warning);
}

.cell-name {
  font-size: 13px; font-weight: 600; color: var(--color-text);
}
.cell-sid {
  font-size: 10px; font-weight: 400; color: var(--color-text-3); margin-left: 2px;
}
.cell-time {
  font-size: 11px; color: var(--color-text-3); white-space: nowrap;
}
.cell-reason {
  font-size: 10px; color: var(--color-warning); font-weight: 500;
}

/* 学员快捷入口 */
.quick-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  padding: 0 12px;
}
.quick-item {
  background: var(--color-surface); box-shadow: var(--shadow-card);
  border-radius: var(--radius-md); padding: 14px 8px; text-align: center;
  font-size: 13px; font-weight: 500; color: var(--color-text); cursor: pointer;
}
</style>
