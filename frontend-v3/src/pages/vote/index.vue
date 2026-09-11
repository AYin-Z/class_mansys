<script setup lang="ts">
/**
 * 投票列表
 *
 * 2026-09（体验修复）：
 *  - 加载失败不再被 `catch (_) {}` 吞成「暂无投票」→ error + 重试
 *  - 状态标签改 BaseBadge（硬编码 #dcfce7/#16a34a/#fef9c3/#ca8a04 → 语义令牌）
 *  - 底部避让交给 App.vue，删除手写 padding-bottom: 80px
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getVotes, getVoteStatus, isVoteSingle } from '@/api/vote'
import type { VoteItem } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const votes = ref<VoteItem[]>([])
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await getVotes()
    if (res.success) votes.value = res.votes || []
    else error.value = new Error('加载投票列表失败，请稍后重试')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goToDetail(id: number) {
  router.push({ path: '/pages/vote/detail', query: { id: String(id) } })
}

function statusLabel(v: VoteItem): string {
  const s = getVoteStatus(v)
  if (s === 'pending') return '待开始'
  if (s === 'ended') return '已结束'
  return '进行中'
}

function statusVariant(v: VoteItem): 'success' | 'default' | 'warning' {
  const s = getVoteStatus(v)
  if (s === 'pending') return 'warning'
  if (s === 'ended') return 'default'
  return 'success'
}

function typeLabel(v: VoteItem): string {
  return isVoteSingle(v) ? '单选' : '多选'
}

function formatDateRange(start: string, end: string): string {
  const fmt = (t: string) => {
    if (!t) return ''
    const d = new Date(t)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${fmt(start)} ~ ${fmt(end)}`
}
</script>

<template>
  <div class="vote-page">
    <NavBar title="投票" />

    <StateView
      :loading="loading"
      :error="error"
      :empty="votes.length === 0"
      loading-text="正在加载投票…"
      empty-icon="check-circle"
      empty-title="还没有投票"
      empty-description="干部发起投票后会显示在这里"
      @retry="load"
    >
      <div
        v-for="item in votes"
        :key="item.id"
        class="vote-card"
        @click="goToDetail(item.id)"
      >
        <div class="card-top">
          <span class="card-title">{{ item.title }}</span>
          <BaseBadge :variant="statusVariant(item)">{{ statusLabel(item) }}</BaseBadge>
        </div>
        <div v-if="item.description" class="card-desc">{{ item.description }}</div>
        <div class="card-meta">
          <span class="meta-tag">{{ typeLabel(item) }}</span>
          <span>{{ item.creator_name || '' }}</span>
          <span v-if="item.participant_count !== undefined">
            <AppIcon name="users" :size="13" />
            {{ item.participant_count }} 人参与
          </span>
        </div>
        <div class="card-time">{{ formatDateRange(item.start_time, item.end_time) }}</div>
      </div>
    </StateView>
  </div>
</template>

<style scoped>
.vote-page { min-height: 100vh; }

/* Vote Card */
.vote-card {
  background: var(--color-surface);
  margin: 0 12px 10px;
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.vote-card:active {
  background: var(--color-surface-hover);
}

.card-top {
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
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.card-meta > span { display: inline-flex; align-items: center; gap: 3px; }
.meta-tag {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}
.card-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  margin-top: 4px;
}
</style>
