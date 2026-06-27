<script setup lang="ts">
import { useRoute } from 'vue-router'
import NavBar from '@/components/ui/NavBar.vue'

const route = useRoute()

const moduleNames: Record<string, string> = {
  '/pages/album/index': '区队相册',
  '/pages/announcement/index': '公告',
  '/pages/vote/index': '投票',
  '/pages/psychological/index': '心理',
  '/pages/challenge/index': '挑战',
  '/pages/suggestion/index': '建议',
  '/pages/lottery/index': '抽奖',
  '/pages/points/index': '积分',
  '/pages/points/manage': '积分管理',
  '/pages/vote/manage': '投票管理',
  '/pages/challenge/manage': '擂台管理',
  '/pages/lottery/manage': '抽奖管理',
}
const name = moduleNames[route.path] || '功能'
</script>
<template>
  <div class="stub-page">
    <NavBar :title="name" show-back />
    <div class="stub-content">
      <div class="stub-icon">🚧</div>
      <div class="stub-title">{{ name }}</div>
      <div class="stub-desc">该模块正在开发中，敬请期待</div>
    </div>
  </div>
</template>
<style scoped>
.stub-page { padding-bottom: 80px; }
.stub-content {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 24px;
}
.stub-icon { font-size: 48px; margin-bottom: 16px; }
.stub-title { font-size: 18px; font-weight: 700; color: var(--color-text); margin-bottom: 8px; }
.stub-desc { font-size: 14px; color: var(--color-text-3); }
</style>
