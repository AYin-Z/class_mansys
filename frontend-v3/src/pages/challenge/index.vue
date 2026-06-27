<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getChallenges } from '@/api/challenge'
import type { ChallengeItem } from '@/api/challenge'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const challenges = ref<ChallengeItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getChallenges()
    if (res.success) challenges.value = res.challenges || []
  } catch (_) {
    /* ignore */
  } finally {
    loading.value = false
  }
})

function goDetail(id: number) {
  router.push({ path: '/pages/challenge/detail', query: { id: String(id) } })
}

const TYPE_LABEL: Record<string, string> = {
  academic: '学业',
  sports: '体育',
  talent: '才艺',
  other: '其他',
}

function typeLabel(type: string): string {
  return TYPE_LABEL[type] || type
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr.slice(0, 10)
  }
}
</script>

<template>
  <div class="challenge-page">
    <NavBar title="挑战" />

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="challenges.length === 0" class="state-text empty-state">
      <div class="empty-icon">🏆</div>
      <div class="empty-text">暂无挑战项目</div>
    </div>

    <div v-else class="card-list">
      <div
        v-for="item in challenges"
        :key="item.id"
        class="card"
        @click="goDetail(item.id)"
      >
        <div class="card-top">
          <div class="card-name">{{ item.name }}</div>
          <span class="type-badge">{{ typeLabel(item.type) }}</span>
        </div>
        <div class="card-desc">{{ item.description }}</div>
        <div class="card-meta">
          <span class="champion-info">
            擂主：
            <template v-if="item.champion_name">{{ item.champion_name }}</template>
            <template v-else><span class="no-champion">暂无擂主</span></template>
          </span>
          <span class="record-count">{{ item.record_count || 0 }} 次挑战</span>
          <span class="card-date">{{ formatDate(item.created_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.challenge-page {
  padding-bottom: 24px;
  min-height: 100vh;
  background: var(--color-bg, #f5f5f5);
}

.state-text {
  text-align: center;
  padding: 64px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: var(--color-text-3);
}

.card-list {
  padding: 8px 12px;
}

.card {
  background: var(--color-surface);
  margin-bottom: 10px;
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.card:active {
  background: var(--color-surface-hover);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.type-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-accent-bg, #e8f0fe);
  color: var(--color-accent, #1a73e8);
}

.card-desc {
  font-size: 13px;
  color: var(--color-text-2);
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-3);
}

.champion-info {
  flex: 1;
}

.no-champion {
  color: var(--color-text-3);
  font-style: normal;
}

.record-count {
  flex-shrink: 0;
}

.card-date {
  flex-shrink: 0;
}
</style>
