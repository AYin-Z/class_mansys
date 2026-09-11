<script setup lang="ts">
/**
 * 抽奖列表
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无抽奖活动」→ error + 重试
 *  - emoji（👥🏆）→ AppIcon；状态标签改用 BaseBadge；字号/颜色令牌化
 *  - 底部避让交给 App.vue（删除页面手写 padding-bottom）
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getLotteries } from '@/api/lottery'
import type { LotteryItem } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const lotteries = ref<LotteryItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

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

function statusVariant(item: LotteryItem): 'success' | 'default' | 'warning' {
  const s = getStatus(item)
  if (s === 'pending') return 'warning'
  if (s === 'ended') return 'default'
  return 'success'
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

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getLotteries()
    if (res.success) lotteries.value = res.lotteries || []
    else error.value = new Error('加载抽奖列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="lottery-page">
    <NavBar title="抽奖" />

    <StateView
      :loading="loading"
      :error="error"
      :empty="lotteries.length === 0"
      loading-text="正在加载抽奖活动…"
      empty-icon="gift"
      empty-title="还没有抽奖活动"
      empty-description="干部发起活动后会显示在这里"
      @retry="load"
    >
      <div
        v-for="item in lotteries"
        :key="item.id"
        class="card"
        @click="goToDetail(item.id)"
      >
        <div class="card-title-row">
          <span class="card-title">{{ item.name }}</span>
          <BaseBadge :variant="statusVariant(item)">{{ statusLabel(item) }}</BaseBadge>
        </div>
        <div v-if="item.description" class="card-desc">{{ item.description }}</div>
        <div class="card-meta">
          <span>{{ item.creator_name || '' }}</span>
          <span>{{ formatTime(item.start_time) }} ~ {{ formatTime(item.end_time) }}</span>
        </div>
        <div class="card-stats">
          <span class="stat">
            <AppIcon name="users" :size="14" />
            {{ item.participant_count ?? 0 }} 人参与
          </span>
          <span class="stat">
            <AppIcon name="trophy" :size="14" />
            {{ item.winner_count ?? 0 }} 个奖项
          </span>
        </div>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.lottery-page { min-height: 100vh; }

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
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  margin-top: 6px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  margin-top: 8px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.card-stats {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  margin-top: 10px;
  display: flex;
  gap: 16px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
.stat { display: inline-flex; align-items: center; gap: 4px; }
</style>
