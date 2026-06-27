<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getUnreadCount } from '@/api/notice'
import { getPendingHomeworkCount } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const userStore = useUserStore()
const { profile, displayName } = storeToRefs(userStore)

// 角标数据
const unreadNoticeCount = ref(0)
const pendingHomeworkCount = ref(0)

onMounted(async () => {
  // 并行拉取角标数据（静默失败，不阻塞页面渲染）
  const [noticeRes, hwRes] = await Promise.allSettled([
    getUnreadCount(),
    getPendingHomeworkCount(),
  ])
  if (noticeRes.status === 'fulfilled' && noticeRes.value.success) {
    unreadNoticeCount.value = noticeRes.value.count || 0
  }
  if (hwRes.status === 'fulfilled' && hwRes.value.success) {
    pendingHomeworkCount.value = hwRes.value.count || 0
  }
})

function handleLogout() {
  if (!confirm('确定退出登录？')) return
  userStore.logout()
  router.replace('/pages/login/password-login')
}

const roleLabel = (role?: number) => {
  const roles: Record<number, string> = {
    0: '学员', 1: '区队长', 2: '生活副区', 3: '学习副区',
    4: '心理副区', 5: '团支书', 6: '组织委员', 7: '宣传委员', 8: '系统管理员',
  }
  return role !== undefined ? roles[role] ?? `干部(${role})` : '学员'
}

const totalBadge = () => unreadNoticeCount.value + pendingHomeworkCount.value
</script>
<template>
  <div class="profile-page">
    <NavBar title="个人中心" />

    <!-- 用户信息 -->
    <div class="user-card" @click="router.push('/pages/profile/settings')">
      <div class="avatar">{{ displayName?.charAt(0) || '?' }}</div>
      <div class="user-info">
        <div class="name">{{ displayName || '未知用户' }}</div>
        <div class="detail">{{ profile?.student_id || '' }} · {{ roleLabel(profile?.role) }}</div>
      </div>
      <span class="arrow">›</span>
    </div>

    <!-- 常用功能 -->
    <div class="menu-group">
      <div class="menu-item" @click="router.push('/pages/notice/index')">
        <span class="icon">📢</span>
        <span class="label">通知中心</span>
        <span v-if="unreadNoticeCount > 0" class="badge">{{ unreadNoticeCount > 99 ? '99+' : unreadNoticeCount }}</span>
        <span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/leave/index')">
        <span class="icon">🏥</span><span class="label">我的请假</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/fee/index')">
        <span class="icon">💰</span><span class="label">班费记录</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/homework/index')">
        <span class="icon">📝</span>
        <span class="label">作业管理</span>
        <span v-if="pendingHomeworkCount > 0" class="badge">{{ pendingHomeworkCount > 99 ? '99+' : pendingHomeworkCount }}</span>
        <span class="arrow">›</span>
      </div>
    </div>

    <!-- 管理功能（仅管理员可见） -->
    <div v-if="userStore.isAdmin" class="menu-group">
      <div class="menu-item" @click="router.push('/pages/fee/approvals')">
        <span class="icon">📋</span><span class="label">审批管理</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/dashboard/index')">
        <span class="icon">📊</span><span class="label">管理仪表盘</span><span class="arrow">›</span>
      </div>
    </div>

    <!-- 更多 -->
    <div class="menu-group">
      <div class="menu-item" @click="router.push('/pages/features/index')">
        <span class="icon">📱</span>
        <span class="label">全部功能</span>
        <span v-if="totalBadge() > 0" class="badge badge-count">{{ totalBadge() > 99 ? '99+' : totalBadge() }}</span>
        <span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/profile/settings')">
        <span class="icon">⚙️</span><span class="label">设置</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" @click="router.push('/pages/profile/about')">
        <span class="icon">ℹ️</span><span class="label">关于我们</span><span class="arrow">›</span>
      </div>
    </div>

    <!-- 退出 -->
    <div class="menu-group">
      <div class="menu-item logout" @click="handleLogout">
        <span class="icon">🚪</span><span class="label">退出登录</span>
      </div>
    </div>

    <div class="version">class-mansys v3 · 数据警务技术2025级六区队</div>
  </div>
</template>
<style scoped>
.profile-page { padding-bottom: 80px; }
.user-card {
  display: flex; align-items: center; gap: 16px;
  padding: 24px 20px; background: var(--color-surface);
  margin: 0 0 16px; cursor: pointer;
}
.user-card:active { background: var(--color-surface-hover); }
.avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), #4f8cff);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; flex-shrink: 0;
}
.name { font-size: 18px; font-weight: 700; color: var(--color-text); }
.detail { font-size: 13px; color: var(--color-text-2); margin-top: 2px; }
.menu-group {
  background: var(--color-surface); margin: 0 0 12px;
  border-radius: var(--radius-md); overflow: hidden;
}
.menu-item {
  display: flex; align-items: center; padding: 14px 16px;
  cursor: pointer; gap: 10px;
}
.menu-item + .menu-item { border-top: 1px solid var(--color-border); }
.menu-item .icon { font-size: 18px; width: 24px; text-align: center; }
.menu-item .label { flex: 1; font-size: 15px; color: var(--color-text); }
.menu-item .arrow { font-size: 18px; color: var(--color-text-3); }
.menu-item.logout .label { color: var(--color-error); }
.menu-item:active { background: var(--color-surface-hover); }
.user-card .arrow { font-size: 20px; color: var(--color-text-3); margin-left: auto; }

/* 角标 */
.badge {
  min-width: 20px; height: 20px; border-radius: 10px;
  background: var(--color-error); color: #fff;
  font-size: 11px; font-weight: 700; line-height: 20px;
  text-align: center; padding: 0 5px;
}
.badge-count {
  background: var(--color-accent);
}

.version { text-align: center; font-size: 12px; color: var(--color-text-3); padding: 16px; }
</style>
