<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getAdminLeaveConfig, updateLeaveConfig } from '@/api/admin'
import type { LeaveTypeConfig } from '@/api/leave-config'
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
import { showToast } from '@/utils/ui'

const router = useRouter()
const userStore = useUserStore()

type TabKey = 'overview' | 'todos' | 'members' | 'roster' | 'classes' | 'leave' | 'audit' | 'agent' | 'system' | 'permissions'

interface TabDef {
  key: TabKey
  label: string
  icon: string
  /** 需要的权限键（任一即可见） */
  perms: string[]
  group: string
}

const TABS: TabDef[] = [
  { key: 'overview', label: '总览', icon: '📊', perms: ['VIEW_ROSTER'], group: '运行' },
  { key: 'todos', label: '内容与待办', icon: '✅', perms: ['VIEW_ROSTER'], group: '运行' },
  { key: 'members', label: '成员管理', icon: '👥', perms: ['VIEW_ROSTER'], group: '组织' },
  { key: 'roster', label: '名册导入', icon: '📥', perms: ['MANAGE_MEMBERS'], group: '组织' },
  { key: 'classes', label: '区队与中队', icon: '🏢', perms: ['VIEW_ROSTER'], group: '组织' },
  { key: 'leave', label: '请假配置', icon: '🏥', perms: ['MANAGE_LEAVE_CONFIG'], group: '组织' },
  { key: 'audit', label: '审计日志', icon: '📜', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'agent', label: '助手与渠道', icon: '🤖', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'system', label: '系统运维', icon: '🛠️', perms: ['VIEW_SYSTEM'], group: '系统' },
  { key: 'permissions', label: '权限矩阵', icon: '🔐', perms: ['MANAGE_PERMISSIONS'], group: '系统' }
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

async function loadLeaveConfig() {
  leaveLoading.value = true
  try {
    const res = await getAdminLeaveConfig()
    if (res?.success) leaveConfigs.value = res.data || []
  } catch (e: any) {
    showToast(e?.message || '加载请假配置失败', 'error')
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
    showToast('已保存')
    await loadLeaveConfig()
  } catch (e: any) {
    showToast(e?.message || '保存失败', 'error')
  } finally {
    leaveSaving.value = false
  }
}

async function doLogout() {
  await userStore.logout()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="admin-console">
    <header class="top">
      <div class="brand">🛡️ 中队管理后台</div>
      <div class="top-right">
        <span class="who">{{ userStore.displayName }} · {{ userStore.roleLabel }}</span>
        <button class="t-btn" @click="router.push('/pages/index/index')">返回前台</button>
        <button class="t-btn danger" @click="doLogout">退出登录</button>
      </div>
    </header>

    <div class="body">
      <nav class="side">
        <template v-for="g in groups" :key="g.name">
          <div class="group-label">{{ g.name }}</div>
          <button
            v-for="t in g.items"
            :key="t.key"
            class="nav-item"
            :class="{ active: activeTab === t.key }"
            @click="activeTab = t.key"
          >
            <span class="nav-icon">{{ t.icon }}</span>{{ t.label }}
          </button>
        </template>
      </nav>

      <main class="content">
        <OverviewSection
          v-if="activeTab === 'overview'"
          @switch-tab="(tab: string) => (activeTab = tab as TabKey)"
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
          @save="saveLeaveConfig"
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
.top {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 18px; background: var(--color-surface); border-bottom: 1px solid var(--color-border);
  position: sticky; top: 0; z-index: 30;
}
.brand { font-size: 16px; font-weight: 700; color: var(--color-text); }
.top-right { display: flex; align-items: center; gap: 8px; }
.who { font-size: 12px; color: var(--color-text-3); }
.t-btn {
  font-size: 12px; padding: 6px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-2);
}
.t-btn.danger { color: #e5484d; border-color: rgba(229, 72, 77, .4); }
.body { display: flex; flex: 1; min-height: 0; align-items: flex-start; }
.side {
  width: 190px; flex: 0 0 190px; padding: 12px 10px; border-right: 1px solid var(--color-border);
  background: var(--color-surface); position: sticky; top: 57px; max-height: calc(100vh - 57px); overflow-y: auto;
}
.group-label { font-size: 11px; color: var(--color-text-3); padding: 10px 8px 4px; }
.nav-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; margin-bottom: 2px;
  font-size: 13px; text-align: left; cursor: pointer; border: none; border-radius: 8px;
  background: transparent; color: var(--color-text-2);
}
.nav-item:hover { background: var(--color-surface-hover); }
.nav-item.active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.nav-icon { font-size: 14px; }
.content { flex: 1; min-width: 0; padding: 18px 20px 60px; }

@media (max-width: 860px) {
  .body { flex-direction: column; }
  .side {
    width: 100%; flex: none; position: static; max-height: none; border-right: none; border-bottom: 1px solid var(--color-border);
    display: flex; gap: 6px; overflow-x: auto; padding: 8px;
  }
  .group-label { display: none; }
  .nav-item { width: auto; white-space: nowrap; margin-bottom: 0; }
  .content { padding: 14px 12px 50px; }
}
</style>
