<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/ui/NavBar.vue'
import PendingRow from './components/PendingRow.vue'
import LeaveMatrix from './components/LeaveMatrix.vue'
import CompanyOverview from './components/CompanyOverview.vue'
import MgmtGrid from './components/MgmtGrid.vue'
import MySummary from './components/MySummary.vue'
import QuickGrid from './components/QuickGrid.vue'
import StateView from '@/components/ui/StateView.vue'
import { useUserStore } from '@/stores/user'
import { getSummary, getPendingApprovals } from '@/api/fee'
import { getUnreadCount, getTodoCount } from '@/api/notice'
import { getAllSuggestions } from '@/api/suggestion'
import { getAllLeaves } from '@/api/leave'
import { getLeaveTypes, type LeaveTypeConfig } from '@/api/leave-config'
import { getCompanyOverview, type CompanyClassStat } from '@/api/company'

import type { LeaveItem } from '@/api/leave'

const router = useRouter()
const userStore = useUserStore()
// 必须用 computed：此前是 setup 期求值的普通布尔，同一会话内换账号/权限变更后不会更新
const isAdmin = computed(() => userStore.isAdmin)
const isSuperAdmin = computed(() => userStore.role === 8)
const feeSummary = ref<any>(null)
const unreadNoticeCount = ref(0)
const pendingFeeCount = ref(0)
const pendingLeaveCount = ref(0)
const pendingSuggestionCount = ref(0)
const allLeaves = ref<LeaveItem[]>([])
const todoCount = ref(0)
const myLeaveCount = ref(0)
const loading = ref(true)
const leaveConfigs = ref<LeaveTypeConfig[]>([])

// ── 中队概览（各区队管理层平行可见）──
const canViewCompany = computed(() => userStore.hasPermission('VIEW_COMPANY'))
const companySummary = ref<{ total: number; on_leave: number; present: number; currently_leave: number; not_returned: number } | null>(null)
const companyClasses = ref<CompanyClassStat[]>([])
const companyDate = (() => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
})()

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

// ── 待处理 / 我的概况渲染数据（下沉到 PendingRow 组件）──
interface PendingItem {
  count: string | number
  label: string
  path: string
}
const adminPendingItems = computed<PendingItem[]>(() => [
  { count: unreadNoticeCount.value, label: '📢 通知待办', path: '/pages/notice/admin' },
  { count: pendingFeeCount.value, label: '💰 班费审批', path: '/pages/fee/approvals' },
  { count: pendingLeaveCount.value, label: '🏥 请假审批', path: '/pages/leave/approvals' },
  { count: pendingSuggestionCount.value, label: '💡 建议待开', path: '/pages/suggestion/inbox' }
])
const mySummaryItems = computed<PendingItem[]>(() => [
  { count: unreadNoticeCount.value, label: '📢 未读通知', path: '/pages/notice/index' },
  { count: todoCount.value, label: '📋 待完成任务', path: '/pages/notice/index' },
  { count: myActiveLeaves.value.length, label: '🏥 生效中请假', path: '/pages/leave/index' },
  {
    count: feeSummary.value ? `¥${Number(feeSummary.value.balance).toFixed(0)}` : '--',
    label: '💰 班费余额',
    path: '/pages/fee/index'
  }
])

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
  // 固定时段请假类型：从 API 配置动态计算
  const FIXED_WINDOWS = computed(() => {
    const map: Record<string, [number, number]> = {}
    for (const c of leaveConfigs.value) {
      if (c.is_fixed && c.start_time && c.end_time) {
        const toMin = (t: string) => {
          const [h, m] = t.split(':').map(Number)
          return h * 60 + (m || 0)
        }
        map[c.type_name] = [toMin(c.start_time), toMin(c.end_time)]
      }
    }
    return map
  })

  function isInFixedWindow(leave: any): boolean {
    const window = FIXED_WINDOWS.value[leave.leave_type]
    if (!window) return true // 非固定类型直接通过
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return nowMin >= window[0] && nowMin < window[1]
  }

  // 按 leave_type 分组，同一人同原因合并
  const groups: Record<string, Map<string, { name: string; student_id: string; start: string; end: string; startRaw: string; endRaw: string; reason: string }>> = {}
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

const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [summaryRes, approvalRes, noticeRes, suggestionRes, leaveRes, todoRes, configRes, companyRes] = await Promise.all([
      getSummary().catch(() => null),
      getPendingApprovals().catch(() => null),
      getUnreadCount().catch(() => null),
      getAllSuggestions({ status: 0 }).catch(() => null),
      getAllLeaves().catch(() => null),
      getTodoCount().catch(() => null),
      getLeaveTypes().catch(() => null),
      canViewCompany.value ? getCompanyOverview(companyDate).catch(() => null) : Promise.resolve(null),
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
    if (configRes?.data) leaveConfigs.value = configRes.data
    if (companyRes && (companyRes as any).success) {
      companySummary.value = (companyRes as any).summary || null
      companyClasses.value = (companyRes as any).classes || []
    }
    // 核心数据全挂时才显示错误态：局部失败保留其余内容，但数字不会被当成 0（见模板里的 --）
    if (!summaryRes && !approvalRes && !noticeRes && !leaveRes && !todoRes) {
      error.value = new Error('待办数据加载失败')
    }
  } catch (e) {
    error.value = e
  } finally { loading.value = false }
}

onMounted(load)

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
      { icon: 'users', label: '成员管理', path: '/pages/admin/members', desc: '查看所有成员信息' },
      { icon: 'calendar', label: '请假审批', path: '/pages/leave/approvals', desc: `${pendingLeaveCount.value} 条待审批`, badge: true },
      { icon: 'megaphone', label: '通知管理', path: '/pages/notice/admin', desc: `${unreadNoticeCount.value} 条待办` },
      { icon: 'info', label: '建议箱', path: '/pages/suggestion/inbox', desc: `${pendingSuggestionCount.value} 条待处理` },
    ]
  },
  {
    name: '财务与教务',
    items: [
      { icon: 'money', label: '班费审批', path: '/pages/fee/approvals', desc: '待审批列表', badge: true },
      { icon: 'wallet', label: '班费账本', path: '/pages/fee/index', desc: '收支记录与收缴' },
      { icon: 'book', label: '作业管理', path: '/pages/homework/index', desc: '发布与批改' },
      { icon: 'star', label: '积分管理', path: '/pages/points/manage', desc: '积分规则与调整' },
    ]
  },
  {
    name: '活动与互动',
    items: [
      { icon: 'check-circle', label: '投票管理', path: '/pages/vote/manage', desc: '创建与管理投票' },
      { icon: 'trophy', label: '擂台管理', path: '/pages/challenge/manage', desc: 'PK挑战管理' },
      { icon: 'gift', label: '抽奖管理', path: '/pages/lottery/manage', desc: '抽奖活动配置' },
    ]
  },
  {
    name: '内容管理',
    items: [
      { icon: 'megaphone', label: '公告管理', path: '/pages/announcement/admin', desc: '公告与资源共享管理' },
      { icon: 'image', label: '相册管理', path: '/pages/album/index', desc: '上传与管理照片' },
    ]
  },
])
</script>
<template>
  <div class="dashboard-page">
    <NavBar :title="isAdmin ? '待办中心' : '我的待办'" />

    <StateView
      :loading="loading"
      :error="error"
      empty-title="暂时没有需要处理的事"
      @retry="load"
    >
      <!-- ≡≡ 管理员仪表盘 ≡≡ -->
      <template v-if="isAdmin">
        <!-- 超管入口 -->
        <div v-if="isSuperAdmin" class="super-admin-banner" @click="router.push('/admin/panel')">
          <span class="banner-icon">🛡️</span>
          <span class="banner-text">超级管理员后台</span>
          <span class="banner-arrow">›</span>
        </div>

        <!-- 待处理 -->
        <div class="section-title">待处理</div>
        <PendingRow :items="adminPendingItems" />

        <!-- 中队概览（各区队管理层平行可见） -->
        <CompanyOverview v-if="canViewCompany && companySummary" :summary="companySummary" :classes="companyClasses" />

        <!-- 实时请假矩阵 -->
        <LeaveMatrix
          :matrix="leaveMatrix"
          :leave-types="leaveTypes"
          :active-leave-total="activeLeaveTotal"
          title="请假矩阵"
          link-text="全部请假情况 ›"
          link-path="/pages/leave/approvals"
        />

        <!-- 管理功能 -->
        <MgmtGrid :groups="mgmtGroups" />
      </template>

      <!-- ≡≡ 学员仪表盘 ≡≡ -->
      <template v-else>
        <MySummary :items="mySummaryItems" />

        <!-- 全班请假情况 -->
        <LeaveMatrix
          :matrix="leaveMatrix"
          :leave-types="leaveTypes"
          :active-leave-total="activeLeaveTotal"
          title="全班请假"
          link-text="我的请假 ›"
          link-path="/pages/leave/index"
        />

        <!-- 快捷入口 -->
        <QuickGrid />
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
    </StateView>
  </div>
</template>
<style scoped>
.dashboard-page { padding-bottom: var(--spacing-lg); }
.loading-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.super-admin-banner {
  display: flex; align-items: center; gap: 8px;
  margin: 12px; padding: 12px 16px;
  background: linear-gradient(135deg, var(--color-primary) 0%, #0f2440 100%);
  border-radius: 10px; color: #fff; cursor: pointer;
  box-shadow: 0 2px 8px rgba(26,58,92,0.3);
}
.banner-icon { font-size: 20px; }
.banner-text { flex: 1; font-size: 15px; font-weight: 600; }
.banner-arrow { font-size: 20px; opacity: 0.7; }
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

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
</style>
