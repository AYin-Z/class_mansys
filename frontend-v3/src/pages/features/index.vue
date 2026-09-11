<script setup lang="ts">
/**
 * 全部功能
 *
 * 2026-09（B7）修复：
 *  - 无权限项此前渲染成灰色入口，点击 go() 直接 return —— 点了完全没反应，
 *    用户以为是卡了。现在无权限项**不渲染**（并按权限矩阵分组），
 *    go() 里仍保留兜底提示，防止后续有人把入口放回来。
 *  - 死分支 `ready:false` +「即将上线」角标（永远没有对应实现）已删除。
 *  - 补齐缺失入口：请假审批、积分管理、擂台管理、成员管理、用户手册、通知中心、公告、班费。
 *  - emoji 图标 → AppIcon；去掉手写 80px 底部避让（由 App.vue 统一处理）。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { PermissionKey } from '@/types/roles'
import { showToast } from '@/utils/ui'
import NavBar from '@/components/ui/NavBar.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const userStore = useUserStore()

interface FeatureItem {
  /** AppIcon 名称 */
  icon: string
  label: string
  path: string
  /** 需要的权限：不填 = 所有人可见；填了但无权限则整条不渲染 */
  perm?: PermissionKey
}

/** 所有人可见 */
const COMMON_FEATURES: FeatureItem[] = [
  { icon: 'home', label: '首页', path: '/pages/index/index' },
  { icon: 'megaphone', label: '通知中心', path: '/pages/notice/index' },
  { icon: 'send', label: '公告', path: '/pages/announcement/index' },
  { icon: 'calendar', label: '请假管理', path: '/pages/leave/index' },
  { icon: 'book', label: '作业管理', path: '/pages/homework/index' },
  { icon: 'wallet', label: '班费', path: '/pages/fee/index' },
  { icon: 'check-circle', label: '报销审批', path: '/pages/fee/approvals' },
  { icon: 'image', label: '区队相册', path: '/pages/album/index' },
  { icon: 'thumbsUp', label: '投票', path: '/pages/vote/index' },
  { icon: 'heart', label: '心理', path: '/pages/psychological/index' },
  { icon: 'trophy', label: '擂台', path: '/pages/challenge/index' },
  { icon: 'message-circle', label: '建议箱', path: '/pages/suggestion/index' },
  { icon: 'gift', label: '抽奖', path: '/pages/lottery/index' },
  { icon: 'star', label: '积分', path: '/pages/points/index' },
  { icon: 'help-circle', label: '用户手册', path: '/pages/help/index' },
  { icon: 'user', label: '个人中心', path: '/pages/profile/index' },
  { icon: 'settings', label: '设置', path: '/pages/profile/settings' },
  { icon: 'info', label: '关于我们', path: '/pages/profile/about' },
]

/** 按服务端可配置权限矩阵显隐（无权限 = 不渲染） */
const ADMIN_FEATURES: FeatureItem[] = [
  { icon: 'clipboard', label: '请假审批', path: '/pages/leave/approvals', perm: 'APPROVE_LEAVE' },
  { icon: 'star', label: '积分管理', path: '/pages/points/manage', perm: 'MANAGE_POINTS' },
  { icon: 'trophy', label: '擂台管理', path: '/pages/challenge/manage', perm: 'JUDGE_CHALLENGE' },
  { icon: 'users', label: '成员管理', path: '/pages/admin/members', perm: 'VIEW_ROSTER' },
  { icon: 'megaphone', label: '通知管理', path: '/pages/notice/admin', perm: 'MANAGE_NOTICE' },
  { icon: 'send', label: '公告管理', path: '/pages/announcement/admin', perm: 'PUBLISH_ANNOUNCEMENT' },
  { icon: 'pieChart', label: '投票管理', path: '/pages/vote/manage', perm: 'CREATE_VOTE' },
  { icon: 'gift', label: '抽奖管理', path: '/pages/lottery/manage', perm: 'CREATE_LOTTERY' },
  { icon: 'heart', label: '心理管理', path: '/pages/psychological/manage', perm: 'HANDLE_PSYCHOLOGICAL' },
  { icon: 'inbox', label: '建议处理', path: '/pages/suggestion/inbox', perm: 'HANDLE_SUGGESTION' },
  { icon: 'chart', label: '仪表盘', path: '/pages/dashboard/index', perm: 'ACCESS_DASHBOARD' },
  { icon: 'building', label: '中队视角', path: '/pages/company/index', perm: 'VIEW_COMPANY' },
]

function canOpen(item: FeatureItem): boolean {
  return !item.perm || userStore.hasPermission(item.perm)
}

const commonFeatures = computed(() => COMMON_FEATURES.filter(canOpen))
const adminFeatures = computed(() => ADMIN_FEATURES.filter(canOpen))

function go(item: FeatureItem) {
  if (!canOpen(item)) {
    showToast('该功能仅区队干部可用', 'error')
    return
  }
  router.push(item.path)
}
</script>
<template>
  <div class="features-page">
    <NavBar title="全部功能" show-back @back="router.back()" />

    <div class="group-title">常用功能</div>
    <div class="grid">
      <div v-for="item in commonFeatures" :key="item.path" class="grid-item" @click="go(item)">
        <AppIcon class="icon" :name="item.icon" :size="24" />
        <span class="label">{{ item.label }}</span>
      </div>
    </div>

    <template v-if="adminFeatures.length">
      <div class="group-title">管理功能</div>
      <div class="grid">
        <div v-for="item in adminFeatures" :key="item.path" class="grid-item" @click="go(item)">
          <AppIcon class="icon" :name="item.icon" :size="24" />
          <span class="label">{{ item.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
<style scoped>
/* 底部避让由 App.vue 统一处理（calc(var(--tabbar-h) + safe-area)） */
.features-page { min-height: 100vh; background: var(--color-bg); }
.group-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-3);
  padding: 16px 16px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px 12px 4px;
}
@media (min-width: 768px) { .grid { grid-template-columns: repeat(6, 1fr); } }
@media (min-width: 1100px) { .grid { grid-template-columns: repeat(8, 1fr); } }
.grid-item {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  min-height: 84px;
  padding: 14px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  cursor: pointer;
  transition: transform var(--dur-fast), background var(--dur-base);
  color: var(--color-text-2);
}
.grid-item:active { transform: scale(0.95); background: var(--color-surface-hover); }
.grid-item .label {
  font-size: var(--font-size-2xs);
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.3;
}
</style>
