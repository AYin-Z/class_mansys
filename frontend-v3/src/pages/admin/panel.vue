<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { USER_ROLES } from '@/types/roles'
import { listMembers, getMemberDetail, updateMemberRole, getAdminLeaveConfig, updateLeaveConfig, getRecentOperations } from '@/api/admin'
import type { AdminMember, MemberDetailResult } from '@/api/admin'
import type { LeaveTypeConfig } from '@/api/leave-config'
import { getAllLeaves } from '@/api/leave'
import { getSummary } from '@/api/fee'
import { getLeaveTypes } from '@/api/leave-config'
import OverviewSection, { type OverviewData } from './panel/OverviewSection.vue'
import MembersSection from './panel/MembersSection.vue'
import MemberDetailModal from './panel/MemberDetailModal.vue'
import LeaveConfigSection from './panel/LeaveConfigSection.vue'

const router = useRouter()
const userStore = useUserStore()

// 当前面板 tab
type PanelTab = 'overview' | 'members' | 'leave-config'
const activeTab = ref<PanelTab>('overview')

// 登出
async function doLogout() {
  await userStore.logout()
  router.replace('/admin/login')
}

// ========== 概览数据 ==========
const overview = ref<OverviewData>({
  members: 0, admins: 0, students: 0,
  activeLeaves: 0, pendingLeaves: 0,
  pendingFeeApprovals: 0, feeBalance: '0',
  leaveConfigCount: 0, enabledConfigCount: 0,
  classes: [] as { name: string; count: number }[],
  roleDist: [] as { label: string; count: number }[],
  recentOps: [],
})
const overviewLoading = ref(true)

onMounted(async () => {
  await userStore.refresh()
  if (userStore.role !== USER_ROLES.SUPER_ADMIN) {
    router.replace('/admin/login')
    return
  }
  loadOverview()
})

async function loadOverview() {
  overviewLoading.value = true
  try {
    const [membersRes, leavesRes, feeRes, configRes, opsRes] = await Promise.all([
      listMembers({ pageSize: 200 }),
      getAllLeaves().catch(() => null),
      getSummary().catch(() => null),
      getLeaveTypes().catch(() => null),
      getRecentOperations({ limit: 10 }).catch(() => null),
    ])
    const members = membersRes?.members || []
    overview.value.members = membersRes?.total || members.length
    // 在编学员 = member_type=student（含班干部）；班干部 = role 1-7
    overview.value.admins = members.filter(m => m.role >= 1 && m.role <= 7).length
    overview.value.students = members.filter(m => (m.member_type || 'student') === 'student').length
    overview.value.activeLeaves = members.reduce((s, m) => s + (m.active_leave_count || 0), 0)

    // 班级分布
    const classMap: Record<string, number> = {}
    members.forEach(m => {
      const cn = m.class_name || m.class_id || '未知'
      classMap[cn] = (classMap[cn] || 0) + 1
    })
    overview.value.classes = Object.entries(classMap).map(([name, count]) => ({ name, count }))

    // 角色分布
    const roleMap: Record<string, number> = {}
    members.forEach(m => {
      const label = ROLE_LABELS[m.role] || `角色${m.role}`
      roleMap[label] = (roleMap[label] || 0) + 1
    })
    overview.value.roleDist = Object.entries(roleMap).map(([label, count]) => ({ label, count }))

    // 请假
    if (leavesRes?.leaves) {
      overview.value.pendingLeaves = leavesRes.leaves.filter(l => l.status === 0 && !l.is_cancelled).length
    }

    // 班费
    if (feeRes?.success) {
      const data = (feeRes as any).data || feeRes
      const s = data?.summary || data
      overview.value.pendingFeeApprovals = Number(s?.pending_small || 0) + Number(s?.pending_medium || 0) + Number(s?.pending_large || 0)
      overview.value.feeBalance = Number(s?.balance || 0).toFixed(2)
    }

    // 请假配置
    if (configRes?.data) {
      overview.value.leaveConfigCount = configRes.data.length
      overview.value.enabledConfigCount = configRes.data.filter(c => c.enabled).length
    }

    // 近期操作
    if (opsRes?.operations) {
      overview.value.recentOps = opsRes.operations.slice(0, 10)
    }
  } catch (_) { /* ignore */ }
  finally { overviewLoading.value = false }
}

// ========== 成员管理 ==========
const members = ref<AdminMember[]>([])
const memberSearch = ref('')
const memberLoading = ref(false)

async function loadMembers() {
  memberLoading.value = true
  try {
    const res = await listMembers({ keyword: memberSearch.value || undefined, pageSize: 200 })
    members.value = res?.members || []
  } finally {
    memberLoading.value = false
  }
}

// 成员详情弹窗
const selectedMember = ref<AdminMember | null>(null)
const memberDetail = ref<MemberDetailResult | null>(null)
const detailLoading = ref(false)
const roleChanging = ref(false)

async function openMemberDetail(member: AdminMember) {
  selectedMember.value = member
  detailLoading.value = true
  memberDetail.value = null
  try {
    memberDetail.value = await getMemberDetail(member.id)
  } finally {
    detailLoading.value = false
  }
}

function closeMemberDetail() {
  selectedMember.value = null
  memberDetail.value = null
}

async function changeRole(memberId: number, newRole: number) {
  roleChanging.value = true
  try {
    await updateMemberRole(memberId, newRole)
    // 刷新详情和列表
    if (selectedMember.value) {
      const detail = await getMemberDetail(memberId)
      memberDetail.value = detail
      selectedMember.value.role = newRole
    }
    await loadMembers()
  } catch (e: any) {
    alert(e?.message || '修改失败')
  } finally {
    roleChanging.value = false
  }
}

// ========== 请假配置 ==========
const leaveConfigs = ref<LeaveTypeConfig[]>([])
const configLoading = ref(false)
const configSaving = ref(false)

async function loadLeaveConfig() {
  configLoading.value = true
  try {
    const res = await getAdminLeaveConfig()
    leaveConfigs.value = res?.data || []
  } finally {
    configLoading.value = false
  }
}

async function saveConfig(config: LeaveTypeConfig) {
  configSaving.value = true
  try {
    await updateLeaveConfig(config.id, {
      start_time: config.start_time,
      end_time: config.end_time,
      is_fixed: config.is_fixed,
      reasons: config.reasons,
      enabled: config.enabled,
      sort_order: config.sort_order
    })
    alert('保存成功')
  } catch (e: any) {
    alert(e?.message || '保存失败')
  } finally {
    configSaving.value = false
  }
}

function switchTab(tab: PanelTab) {
  activeTab.value = tab
  if (tab === 'members') loadMembers()
  if (tab === 'leave-config') loadLeaveConfig()
}

function navigate(path: string) {
  router.push(path)
}

// 角色标签
const ROLE_LABELS: Record<number, string> = {
  0: '学员', 1: '区队长', 2: '生活副区', 3: '学习副区', 4: '心理副区',
  5: '团支书', 6: '组织委员', 7: '宣传委员', 8: '系统管理员', 9: '辅导员'
}
</script>

<template>
  <div class="admin-panel">
    <!-- 移动端顶部导航 -->
    <header class="top-nav">
      <div class="top-nav-header">
        <span class="top-brand">🛡️ 超管后台</span>
        <button class="top-logout" @click="doLogout">退出</button>
      </div>
      <div class="top-tabs">
        <button :class="{ active: activeTab === 'overview' }" @click="switchTab('overview')">📊</button>
        <button :class="{ active: activeTab === 'members' }" @click="switchTab('members')">👥</button>
        <button :class="{ active: activeTab === 'leave-config' }" @click="switchTab('leave-config')">📋</button>
      </div>
    </header>

    <!-- 桌面端侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">🛡️</span>
        <span class="brand-text">超管后台</span>
      </div>
      <nav class="sidebar-nav">
        <button
          :class="{ active: activeTab === 'overview' }"
          @click="switchTab('overview')"
        >📊 系统概览</button>
        <button
          :class="{ active: activeTab === 'members' }"
          @click="switchTab('members')"
        >👥 成员管理</button>
        <button
          :class="{ active: activeTab === 'leave-config' }"
          @click="switchTab('leave-config')"
        >📋 请假配置</button>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-name">{{ userStore.displayName }}</span>
          <span class="user-role">系统管理员</span>
        </div>
        <button class="btn-logout" @click="doLogout">退出登录</button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <OverviewSection
        v-if="activeTab === 'overview'"
        :loading="overviewLoading"
        :data="overview"
        @switch-tab="switchTab"
        @navigate="navigate"
      />
      <MembersSection
        v-if="activeTab === 'members'"
        :members="members"
        :loading="memberLoading"
        :search="memberSearch"
        @update:search="memberSearch = $event"
        @search="loadMembers"
        @open-detail="openMemberDetail"
      />
      <LeaveConfigSection
        v-if="activeTab === 'leave-config'"
        :configs="leaveConfigs"
        :loading="configLoading"
        :saving="configSaving"
        @save="saveConfig"
      />
      <MemberDetailModal
        v-if="selectedMember && activeTab === 'members'"
        :member="selectedMember"
        :detail="memberDetail"
        :loading="detailLoading"
        :role-changing="roleChanging"
        @close="closeMemberDetail"
        @change-role="changeRole"
      />
    </main>
  </div>
</template>

<style scoped>
/* ========== Layout ========== */
.admin-panel {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg);
}

/* ========== Top Nav (Mobile) ========== */
.top-nav {
  display: none;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 8px 12px;
}
.top-nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.top-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 15px; color: var(--color-text); }
.top-tabs {
  display: flex; gap: 4px; margin-top: 8px; overflow-x: auto;
}
.top-tabs button {
  flex-shrink: 0; padding: 6px 14px; border: none; border-radius: 6px;
  background: var(--color-surface-2); color: var(--color-text-2);
  font-size: 13px; cursor: pointer; white-space: nowrap;
}
.top-tabs button.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.top-logout {
  background: none; border: 1px solid var(--color-border);
  border-radius: 4px; padding: 4px 8px; font-size: 12px;
  color: var(--color-text-2); cursor: pointer;
}

/* ========== Sidebar (Desktop) ========== */
.sidebar {
  width: 200px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 16px 0;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 8px;
}
.brand-icon { font-size: 24px; }
.brand-text { font-size: 16px; font-weight: 600; color: var(--color-text); }
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}
.sidebar-nav button {
  text-align: left;
  padding: 10px 12px;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--color-text-2);
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
}
.sidebar-nav button:hover { background: var(--color-surface-2); color: var(--color-text); }
.sidebar-nav button.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 500; }
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--color-border);
}
.user-info {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.user-name { font-size: 14px; font-weight: 500; color: var(--color-text); }
.user-role { font-size: 12px; color: var(--color-text-3); }
.btn-logout {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: 13px;
  cursor: pointer;
}
.btn-logout:hover { color: var(--color-error); border-color: var(--color-error); }

/* ========== Main ========== */
.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-width: 0;
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .top-nav { display: block; }
  .admin-panel { flex-direction: column; }
  .main-content { padding: 16px; }
}
</style>
