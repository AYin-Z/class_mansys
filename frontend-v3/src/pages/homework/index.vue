<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHomeworks } from '@/api/homework'
import type { HomeworkItem } from '@/api/homework'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const homeworks = ref<HomeworkItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getHomeworks()
    if (res.success) homeworks.value = res.homeworks || []
  } catch (_) {}
  finally { loading.value = false }
})

function goDetail(id: number) {
  router.push({ path: '/pages/homework/detail', query: { id: String(id) } })
}

function isOverdue(deadline: string) {
  return new Date(deadline) < new Date()
}
</script>
<template>
  <div class="hw-page">
    <NavBar title="作业管理" />

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="homeworks.length === 0" class="empty-state">暂无作业</div>

    <div v-for="item in homeworks" :key="item.id" class="hw-card" @click="goDetail(item.id)">
      <div class="card-header">
        <div class="title">{{ item.title }}</div>
        <span :class="['status-tag', isOverdue(item.deadline) ? 'overdue' : 'active']">
          {{ isOverdue(item.deadline) ? '已截止' : '进行中' }}
        </span>
      </div>
      <div class="desc">{{ item.description?.replace(/<[^>]*>/g, '').slice(0, 100) }}</div>
      <div class="meta">
        <span>{{ item.creator_name || '' }}</span>
        <span>截止 {{ item.deadline?.slice(0, 10) }}</span>
        <span v-if="item.submission_count !== undefined">{{ item.submission_count }} 人已交</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.hw-page { padding-bottom: 80px; }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.hw-card {
  margin: 8px 12px; border-radius: var(--radius-md);
  background: var(--color-surface); box-shadow: var(--shadow-card);
  padding: 16px; cursor: pointer;
}
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 8px; }
.title { font-size: 15px; font-weight: 600; color: var(--color-text); flex: 1; }
.status-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.status-tag.active { background: var(--color-accent-bg); color: var(--color-accent); }
.status-tag.overdue { background: var(--color-error-bg); color: var(--color-error); }
.desc { font-size: 13px; color: var(--color-text-2); line-height: 1.5; margin-bottom: 8px; }
.meta { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-3); }
</style>
