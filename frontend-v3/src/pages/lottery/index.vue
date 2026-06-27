<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getLotteries } from '@/api/lottery'
import type { LotteryItem } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const lotteries = ref<LotteryItem[]>([])
const loading = ref(true)

function getStatus(item: LotteryItem): 'active' | 'ended' | 'pending' {
  if (!item.is_active) return 'ended'
  const now = Date.now()
  const start = new Date(item.start_time).getTime()
  const end = new Date(item.end_time).getTime()
  if (now < start) return 'pending'
  if (now > end) return 'ended'
  return 'active'
}

function statusLabel(item: LotteryItem): string {
  const s = getStatus(item)
  if (s === 'pending') return '待开始'
  if (s === 'ended') return '已结束'
  return '进行中'
}

function statusClass(item: LotteryItem): string {
  const s = getStatus(item)
  if (s === 'pending') return 'status-pending'
  if (s === 'ended') return 'status-ended'
  return 'status-active'
}

function goToDetail(id: number) {
  router.push({ path: '/pages/lottery/detail', query: { id: String(id) } })
}

function formatTime(t: string): string {
  if (!t) return ''
  const d = new Date(t)
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

onMounted(async () => {
  try {
    const res = await getLotteries()
    if (res.success) lotteries.value = res.lotteries || []
  } catch (_) {
    /* ignore */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="lottery-page">
    <NavBar title="抽奖" />

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="lotteries.length === 0" class="state-text">暂无抽奖活动</div>

    <div
      v-for="item in lotteries"
      :key="item.id"
      class="card"
      @click="goToDetail(item.id)"
    >
      <div class="card-title-row">
        <span class="card-title">{{ item.name }}</span>
        <span class="status-badge" :class="statusClass(item)">{{ statusLabel(item) }}</span>
      </div>
      <div v-if="item.description" class="card-desc">{{ item.description }}</div>
      <div class="card-meta">
        <span>{{ item.creator_name || '' }}</span>
        <span>{{ formatTime(item.start_time) }} ~ {{ formatTime(item.end_time) }}</span>
      </div>
      <div class="card-stats">
        <span>👥 {{ item.participant_count ?? 0 }} 人参与</span>
        <span>🏆 {{ item.winner_count ?? 0 }} 个奖项</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lottery-page {
  padding-bottom: 24px;
}

.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

.card {
  background: var(--color-surface);
  margin: 0 12px 10px;
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

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-ended {
  background: var(--color-border);
  color: var(--color-text-3);
}

.status-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.card-desc {
  font-size: 13px;
  color: var(--color-text-2);
  margin-top: 6px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

.card-stats {
  font-size: 12px;
  color: var(--color-text-2);
  margin-top: 10px;
  display: flex;
  gap: 16px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
</style>
