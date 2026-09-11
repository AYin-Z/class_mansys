<script setup lang="ts">
/**
 * 个人中心
 *
 * 2026-09（B7）修复：
 *  - 角色名此前在本页硬编码 0–8 且 fallback 成「干部(9)」——辅导员（role=9）
 *    会被显示成「干部(9)」。改用 @/types/roles 的 getRoleLabel()，映射只维护一份。
 *  - 角标此前把「未读通知 + 待交作业」相加后挂在「全部功能」入口上（点进去看不到通知），
 *    现在只挂在「通知中心」入口并指向通知列表；数字改由 useBadgeStore() 提供，
 *    与首页/TabBar 共用服务端数据。作业自己的待办数留在「作业管理」入口。
 *  - 角标请求失败此前静默（数字恒为 0，用户以为没有待办）→ 顶部提示 + 重试。
 *  - 原生 confirm() → showConfirm()；emoji 图标 → AppIcon；去掉手写 80px 底部避让。
 */
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useBadgeStore } from '@/stores/badge'
import { getPendingHomeworkCount } from '@/api/homework'
import { getRoleLabel } from '@/types/roles'
import { showConfirm } from '@/utils/ui'
import NavBar from '@/components/ui/NavBar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const router = useRouter()
const userStore = useUserStore()
const badgeStore = useBadgeStore()
const { profile, displayName } = storeToRefs(userStore)

const pendingHomeworkCount = ref(0)
const loading = ref(true)
const error = ref<unknown>(null)

/** 加载角标数据（失败不再静默：显示错误条 + 重试） */
async function load() {
  loading.value = true
  error.value = null
  try {
    // 未读通知 / 待办通知：走全局 badgeStore（与首页、TabBar 同一份数字，避免各页对不上）
    await badgeStore.refresh(true)
    const hw = await getPendingHomeworkCount()
    if (hw?.success) pendingHomeworkCount.value = hw.count || 0
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

function errorText(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  const e = err as { message?: string; code?: string; status?: number }
  if (e.code === 'TIMEOUT') return '请求超时，请检查网络后重试'
  if (e.code === 'NETWORK' || e.status === 0) return '网络连接失败，请检查网络后重试'
  return e.message || '加载失败，请稍后重试'
}

async function handleLogout() {
  const ok = await showConfirm('退出登录', '确定要退出当前账号吗？', {
    danger: true,
    confirmText: '退出登录',
    hint: '退出后需要重新输入学号和密码才能继续使用',
  })
  if (!ok) return
  userStore.logout()
  router.replace('/pages/login/password-login')
}

function formatCount(n: number): string {
  return n > 99 ? '99+' : String(n)
}
</script>
<template>
  <div class="profile-page">
    <NavBar title="个人中心" />

    <!-- 用户信息 -->
    <div class="user-card" @click="router.push('/pages/profile/settings')">
      <div class="avatar">{{ displayName?.charAt(0) || '?' }}</div>
      <div class="user-info">
        <div class="name">{{ displayName || '未知用户' }}</div>
        <div class="detail">{{ profile?.student_id || '' }} · {{ getRoleLabel(profile?.role) }}</div>
      </div>
      <AppIcon class="arrow" name="chevron-right" :size="18" />
    </div>

    <!-- 角标加载失败：不再静默显示 0 -->
    <div v-if="error" class="load-error" role="alert">
      <AppIcon name="alert-circle" :size="15" />
      <span class="load-error-text">{{ errorText(error) }}</span>
      <button class="retry-btn" type="button" :disabled="loading" @click="load">
        <AppIcon name="refresh" :size="14" />
        <span>{{ loading ? '重试中…' : '重试' }}</span>
      </button>
    </div>

    <!-- 常用功能 -->
    <div class="menu-group">
      <div class="menu-item" @click="router.push('/pages/notice/index')">
        <AppIcon class="icon" name="megaphone" :size="19" />
        <span class="label">通知中心</span>
        <BaseBadge v-if="badgeStore.totalUrgent > 0" variant="danger">
          {{ formatCount(badgeStore.totalUrgent) }}
        </BaseBadge>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/leave/index')">
        <AppIcon class="icon" name="calendar" :size="19" />
        <span class="label">我的请假</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/fee/index')">
        <AppIcon class="icon" name="wallet" :size="19" />
        <span class="label">班费记录</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/homework/index')">
        <AppIcon class="icon" name="book" :size="19" />
        <span class="label">作业管理</span>
        <BaseBadge v-if="pendingHomeworkCount > 0" variant="warning">
          {{ formatCount(pendingHomeworkCount) }}
        </BaseBadge>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
    </div>

    <!-- 管理功能（仅管理员可见） -->
    <div v-if="userStore.isAdmin" class="menu-group">
      <div class="menu-item" @click="router.push('/pages/fee/approvals')">
        <AppIcon class="icon" name="check-circle" :size="19" />
        <span class="label">审批管理</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/dashboard/index')">
        <AppIcon class="icon" name="chart" :size="19" />
        <span class="label">管理仪表盘</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
    </div>

    <!-- 更多 -->
    <div class="menu-group">
      <div class="menu-item" @click="router.push('/pages/help/index')">
        <AppIcon class="icon" name="help-circle" :size="19" />
        <span class="label">用户手册</span>
        <BaseBadge variant="info">新</BaseBadge>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/features/index')">
        <AppIcon class="icon" name="grid" :size="19" />
        <span class="label">全部功能</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/profile/settings')">
        <AppIcon class="icon" name="settings" :size="19" />
        <span class="label">设置</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
      <div class="menu-item" @click="router.push('/pages/profile/about')">
        <AppIcon class="icon" name="info" :size="19" />
        <span class="label">关于我们</span>
        <AppIcon class="arrow" name="chevron-right" :size="18" />
      </div>
    </div>

    <!-- 退出 -->
    <div class="menu-group">
      <div class="menu-item logout" @click="handleLogout">
        <AppIcon class="icon" name="logout" :size="19" />
        <span class="label">退出登录</span>
      </div>
    </div>

    <div class="version">class-mansys v3 · 数据警务技术2025级六区队</div>
  </div>
</template>
<style scoped>
/* 底部避让由 App.vue 统一处理（calc(var(--tabbar-h) + safe-area)） */
.profile-page { min-height: 100vh; background: var(--color-bg); }
.user-card {
  display: flex; align-items: center; gap: 16px;
  min-height: 88px;
  padding: 20px; background: var(--color-surface);
  margin: 0 0 16px; cursor: pointer;
}
.user-card:active { background: var(--color-surface-hover); }
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-primary));
  color: var(--color-text-on-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; flex-shrink: 0;
}
.name { font-size: 18px; font-weight: 700; color: var(--color-text); }
.detail { font-size: 13px; color: var(--color-text-2); margin-top: 2px; }
.menu-group {
  background: var(--color-surface); margin: 0 0 12px;
  border-radius: var(--radius-md); overflow: hidden;
}
.menu-item {
  display: flex; align-items: center; padding: 0 16px;
  min-height: 52px;
  cursor: pointer; gap: 12px;
}
.menu-item + .menu-item { border-top: 1px solid var(--color-border); }
.menu-item .icon { color: var(--color-text-2); flex-shrink: 0; }
.menu-item .label { flex: 1; font-size: 15px; color: var(--color-text); }
.menu-item .arrow { color: var(--color-text-3); flex-shrink: 0; }
.menu-item.logout .label { color: var(--color-error); }
.menu-item:active { background: var(--color-surface-hover); }
.user-card .arrow { color: var(--color-text-3); margin-left: auto; }

/* 角标加载失败提示 */
.load-error {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 12px; padding: 10px 12px;
  background: var(--color-error-bg); color: var(--color-error);
  font-size: 13px;
}
.load-error-text { flex: 1; line-height: 1.4; }
.retry-btn {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 44px; padding: 6px 14px;
  border: 1px solid currentColor; border-radius: var(--radius-full);
  background: transparent; color: inherit;
  font-size: 13px; font-weight: 600;
}
.retry-btn:disabled { opacity: 0.6; }

.version { text-align: center; font-size: 12px; color: var(--color-text-3); padding: 16px; }
</style>
