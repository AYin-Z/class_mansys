<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
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

<style scoped>
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text); padding: 16px 16px 10px; }

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
