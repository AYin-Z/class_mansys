<script setup lang="ts">
/**
 * 挑战擂台列表
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无挑战项目」→ error + 重试
 *  - 空态 emoji 🏆 → AppIcon；硬编码色值兜底 → 令牌；字号阶梯收敛
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getChallenges } from '@/api/challenge'
import type { ChallengeItem } from '@/api/challenge'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

const router = useRouter()
const challenges = ref<ChallengeItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getChallenges()
    if (res.success) challenges.value = res.challenges || []
    else error.value = new Error('加载挑战列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

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

    <StateView
      :loading="loading"
      :error="error"
      :empty="challenges.length === 0"
      loading-text="正在加载挑战…"
      empty-icon="trophy"
      empty-title="还没有挑战项目"
      empty-description="干部创建擂台后会显示在这里"
      @retry="load"
    >
      <div class="card-list">
        <div
          v-for="item in challenges"
          :key="item.id"
          class="card"
          @click="goDetail(item.id)"
        >
          <div class="card-top">
            <div class="card-name">{{ item.name }}</div>
            <BaseBadge variant="info">{{ typeLabel(item.type) }}</BaseBadge>
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
    </StateView>
  </div>
</template>

<style scoped>
.challenge-page {
  min-height: 100vh;
  background: var(--color-bg);
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
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
}

.card-desc {
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-xs);
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
