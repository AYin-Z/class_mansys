<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const userStore = useUserStore()

interface FeatureItem {
  icon: string
  label: string
  path: string
  admin?: boolean
  ready?: boolean
}

const features: FeatureItem[] = [
  { icon: '🏠', label: '首页', path: '/pages/index/index', ready: true },
  { icon: '📢', label: '通知中心', path: '/pages/notice/index', ready: true },
  { icon: '📋', label: '通知管理', path: '/pages/notice/admin', admin: true, ready: true },
  { icon: '🏥', label: '请假管理', path: '/pages/leave/index', ready: true },
  { icon: '📝', label: '作业管理', path: '/pages/homework/index', ready: true },
  { icon: '💰', label: '班费', path: '/pages/fee/index', ready: true },
  { icon: '📋', label: '审批管理', path: '/pages/fee/approvals', admin: true, ready: true },
  { icon: '📊', label: '仪表盘', path: '/pages/dashboard/index', admin: true, ready: true },
  { icon: '🖼️', label: '区队相册', path: '/pages/album/index', ready: true },
  { icon: '📣', label: '公告', path: '/pages/announcement/index', ready: true },
  { icon: '🗳️', label: '投票', path: '/pages/vote/index', ready: true },
  { icon: '🧠', label: '心理', path: '/pages/psychological/index', ready: true },
  { icon: '🏆', label: '挑战', path: '/pages/challenge/index', ready: true },
  { icon: '💡', label: '建议', path: '/pages/suggestion/index', ready: true },
  { icon: '🎰', label: '抽奖', path: '/pages/lottery/index', ready: true },
  { icon: '⭐', label: '积分', path: '/pages/points/index', ready: true },
  { icon: '👤', label: '个人中心', path: '/pages/profile/index', ready: true },
  { icon: '⚙️', label: '设置', path: '/pages/profile/settings', ready: true },
  { icon: 'ℹ️', label: '关于我们', path: '/pages/profile/about', ready: true },
]

function canOpen(item: FeatureItem): boolean {
  return !!item.ready && (!item.admin || userStore.isAdmin)
}

function go(item: FeatureItem) {
  if (!canOpen(item)) return
  router.push(item.path)
}
</script>
<template>
  <div class="features-page">
    <NavBar title="全部功能" show-back @back="router.back()" />

    <div class="grid">
      <div v-for="item in features" :key="item.path"
        :class="['grid-item', { disabled: !item.ready || (item.admin && !userStore.isAdmin) }]"
        @click="go(item)">
        <span class="icon">{{ item.icon }}</span>
        <span class="label">{{ item.label }}</span>
        <span v-if="!item.ready" class="coming-badge">即将上线</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.features-page { padding-bottom: 32px; }
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 16px 12px;
}
.grid-item {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 16px 6px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s, background 0.3s;
  position: relative;
}
.grid-item:active { transform: scale(0.95); background: var(--color-surface-hover); }
.grid-item.disabled { opacity: 0.45; cursor: not-allowed; }
.grid-item.disabled:active { transform: none; }
.grid-item .icon { font-size: 24px; display: block; margin-bottom: 6px; }
.grid-item .label { font-size: 11px; font-weight: 500; color: var(--color-text); display: block; }
.coming-badge {
  position: absolute; top: 4px; right: 4px;
  font-size: 8px; padding: 1px 4px; border-radius: 3px;
  background: var(--color-surface-hover); color: var(--color-text-3);
}
</style>
