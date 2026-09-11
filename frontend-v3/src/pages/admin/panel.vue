<script setup lang="ts">
/**
 * 超管后台外壳
 *
 * 2026-09 对齐新规范：
 *  - 自建顶栏（57px）→ NavBar（48px 令牌高度），操作按钮收进 #right 插槽
 *  - emoji 图标 → AppIcon
 *  - 硬编码色值 → 设计令牌；按钮 → BaseButton
 *  - 退出登录走 showConfirm（对象 + 动作 + 后果）
 *  - 请假配置加载失败不再只弹 toast：error 交给 section 渲染错误态 + 重试
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getAdminLeaveConfig, updateLeaveConfig } from '@/api/admin'
import type { LeaveTypeConfig } from '@/api/leave-config'
import NavBar from '@/components/ui/NavBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import OverviewSection from './panel/OverviewSection.vue'
import MembersSection from './panel/MembersSection.vue'
import RosterImportSection from './panel/RosterImportSection.vue'
import ClassesSection from './panel/ClassesSection.vue'
import LeaveConfigSection from './panel/LeaveConfigSection.vue'
import TodosSection from './panel/TodosSection.vue'
import AuditSection from './panel/AuditSection.vue'
import AgentOpsSection from './panel/AgentOpsSection.vue'
import SystemSection from './panel/SystemSection.vue'
import PermissionsSection from './panel/PermissionsSection.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const router = useRouter()
const userStore = useUserStore()

type TabKey = 'overview' | 'todos' | 'members' | 'roster' | 'classes' | 'leave' | 'audit' | 'agent' | 'system' | 'permissions'

interface TabDef {
  key: TabKey
  label: string
  /** AppIcon 图标名 */
  icon: string
  /** 需要的权限键（任一即可见） */
  perms: string[]
  group: string
}

const TABS: TabDef[] = [
  { key: 'overview', label: '总览', icon: 'dashboard', perms: ['VIEW_ROSTER'], group: '运行' },
  { key: 'todos', label: '内容与待办', icon: 'check-circle', perms: ['VIEW_ROSTER'], group: '运行' },
  { key: 'members', label: '成员管理', icon: 'users', perms: ['VIEW_ROSTER'], group: '组织' },
  { key: 'roster', label: '名册导入', icon: 'upload', perms: ['MANAGE_MEMBERS'], group: '组织' },
  { key: 'classes', label: '区队与中队', icon: 'building', perms: ['VIEW_ROSTER'], group: '组织' },
  { key: 'leave', label: '请假配置', icon: 'calendar', perms: ['MANAGE_LEAVE_CONFIG'], group: '组织' },
  { key: 'audit', label: '审计日志', icon: 'clipboard', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'agent', label: '助手与渠道', icon: 'robot', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'system', label: '系统运维', icon: 'settings', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'permissions', label: '权限矩阵', icon: 'shield', perms: ['MANAGE_PERMISSIONS'], group: '系统' }
]

const visibleTabs = computed(() => TABS.filter((t) => t.perms.some((p) => userStore.hasPermission(p as never))))
const groups = computed(() => {
  const map = new Map<string, TabDef[]>()
  for (const t of visibleTabs.value) {
    if (!map.has(t.group)) map.set(t.group, [])
    map.get(t.group)!.push(t)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
})

const activeTab = ref<TabKey>('overview')

function canEnter(): boolean {
  return visibleTabs.value.length > 0
}

function switchTab(key: TabKey) {
  activeTab.value = key
}

onMounted(async () => {
  await userStore.refresh()
  if (!canEnter()) {
    router.replace('/admin/login')
    return
  }
  if (!visibleTabs.value.some((t) => t.key === activeTab.value)) {
    activeTab.value = visibleTabs.value[0].key
  }
  if (visibleTabs.value.some((t) => t.key === 'leave')) loadLeaveConfig()
})

// ---- 请假配置（LeaveConfigSection 需要 props） ----
const leaveConfigs = ref<LeaveTypeConfig[]>([])
const leaveLoading = ref(false)
const leaveSaving = ref(false)
const leaveError = ref<unknown>(null)

async function loadLeaveConfig() {
  leaveLoading.value = true
  leaveError.value = null
  try {
    const res = await getAdminLeaveConfig()
    if (res?.success) leaveConfigs.value = res.data || []
    else leaveError.value = new Error('未获取到请假配置数据')
  } catch (e: any) {
    leaveConfigs.value = []
    leaveError.value = e
  } finally {
    leaveLoading.value = false
  }
}

async function saveLeaveConfig(config: LeaveTypeConfig) {
  leaveSaving.value = true
  try {
    await updateLeaveConfig(config.id, {
      type_name: config.type_name,
      start_time: config.start_time,
      end_time: config.end_time,
      is_fixed: config.is_fixed,
      reasons: config.reasons,
      enabled: config.enabled,
      sort_order: config.sort_order
    })
    showToast('已保存', 'success')
    await loadLeaveConfig()
  } catch (e: any) {
    toastIfNotNotified(e, '保存失败，请稍后重试')
  } finally {
    leaveSaving.value = false
  }
}

async function doLogout() {
  const ok = await showConfirm('退出登录', `确定退出「${userStore.displayName || '当前账号'}」的后台登录？`, {
    confirmText: '退出登录',
    hint: '退出后需要重新输入账号与密码才能进入后台，未保存的编辑内容会丢失。'
  })
  if (!ok) return
  await userStore.logout()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="admin-console">
    <NavBar title="中队管理后台" show-back fallback="/pages/index/index">
      <template #right>
        <span class="who">{{ userStore.displayName }} · {{ userStore.roleLabel }}</span>
        <BaseButton variant="ghost" size="sm" @click="doLogout">退出</BaseButton>
      </template>
    </NavBar>

    <div class="body">
      <nav class="side">
        <template v-for="g in groups" :key="g.name">
          <div class="group-label">{{ g.name }}</div>
          <BaseButton
            v-for="t in g.items"
            :key="t.key"
            variant="text"
            size="sm"
            block
            class="nav-item"
            :class="{ active: activeTab === t.key }"
            :aria-current="activeTab === t.key ? 'page' : undefined"
            @click="switchTab(t.key)"
          >
            <AppIcon :name="t.icon" :size="16" />
            <span class="nav-label">{{ t.label }}</span>
          </BaseButton>
        </template>
      </nav>

      <main class="content">
        <OverviewSection
          v-if="activeTab === 'overview'"
          @switch-tab="(tab: string) => switchTab(tab as TabKey)"
          @navigate="(path: string) => router.push(path)"
        />
        <TodosSection v-else-if="activeTab === 'todos'" @navigate="(path: string) => router.push(path)" />
        <MembersSection v-else-if="activeTab === 'members'" />
        <RosterImportSection v-else-if="activeTab === 'roster'" />
        <ClassesSection v-else-if="activeTab === 'classes'" />
        <LeaveConfigSection
          v-else-if="activeTab === 'leave'"
          :configs="leaveConfigs"
          :loading="leaveLoading"
          :saving="leaveSaving"
          :error="leaveError"
          @save="saveLeaveConfig"
          @retry="loadLeaveConfig"
        />
        <AuditSection v-else-if="activeTab === 'audit'" />
        <AgentOpsSection v-else-if="activeTab === 'agent'" />
        <SystemSection v-else-if="activeTab === 'system'" />
        <PermissionsSection v-else-if="activeTab === 'permissions'" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-console { min-height: 100vh; background: var(--color-bg); display: flex; flex-direction: column; }
.who {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.body { display: flex; flex: 1; min-height: 0; align-items: flex-start; }
.side {
  width: 190px; flex: 0 0 190px; padding: 12px 10px; border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  position: sticky; top: var(--navbar-h, 48px);
  max-height: calc(100vh - var(--navbar-h, 48px)); overflow-y: auto;
}
.group-label { font-size: var(--font-size-2xs); color: var(--color-text-3); padding: 10px 8px 4px; }
/* 侧栏导航项：BaseButton(text) 的居中布局在这里被局部覆盖（多类选择器优先级高于 .btn / .btn.block） */
.admin-console .side .nav-item {
  justify-content: flex-start;
  gap: 8px;
  margin-bottom: 2px;
  color: var(--color-text-2);
  font-weight: 500;
}
.admin-console .side .nav-item.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.nav-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content { flex: 1; min-width: 0; padding: 18px 20px 60px; }

@media (max-width: 860px) {
  .body { flex-direction: column; }
  .side {
    width: 100%; flex: none; position: static; max-height: none; border-right: none;
    border-bottom: 1px solid var(--color-border);
    display: flex; gap: 6px; overflow-x: auto; padding: 8px;
    -webkit-overflow-scrolling: touch;
  }
  .group-label { display: none; }
  .admin-console .side .nav-item { width: auto; flex: 0 0 auto; margin-bottom: 0; white-space: nowrap; }
  .content { padding: 14px 12px 50px; }
}

@media (max-width: 560px) {
  .who { display: none; }
}
</style>
