<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getVotes, getVoteStatus, isVoteSingle } from '@/api/vote'
import type { VoteItem } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'

const router = useRouter()
const votes = ref<VoteItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getVotes()
    if (res.success) votes.value = res.votes || []
  } catch (_) { /* ignore */ }
  finally { loading.value = false }
})

function goToDetail(id: number) {
  router.push({ path: '/pages/vote/detail', query: { id: String(id) } })
}

function statusLabel(v: VoteItem): string {
  const s = getVoteStatus(v)
  if (s === 'pending') return '待开始'
  if (s === 'ended') return '已结束'
  return '进行中'
}

function statusClass(v: VoteItem): string {
  const s = getVoteStatus(v)
  if (s === 'pending') return 'status-pending'
  if (s === 'ended') return 'status-ended'
  return 'status-active'
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

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="votes.length === 0" class="state-text">暂无投票</div>

    <div
      v-for="item in votes"
      :key="item.id"
      class="vote-card"
      @click="goToDetail(item.id)"
    >
      <div class="card-top">
        <span class="card-title">{{ item.title }}</span>
        <span :class="['status-badge', statusClass(item)]">{{ statusLabel(item) }}</span>
      </div>
      <div v-if="item.description" class="card-desc">{{ item.description }}</div>
      <div class="card-meta">
        <span class="meta-tag">{{ typeLabel(item) }}</span>
        <span>{{ item.creator_name || '' }}</span>
        <span v-if="item.participant_count !== undefined">{{ item.participant_count }} 人参与</span>
      </div>
      <div class="card-time">{{ formatDateRange(item.start_time, item.end_time) }}</div>
    </div>
  </div>
</template>

<style scoped>
.vote-page {
  padding-bottom: 80px;
}
.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

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
  border-radius: 20px;
  flex-shrink: 0;
}
.status-active {
  background: #dcfce7;
  color: #16a34a;
}
.status-ended {
  background: var(--color-border);
  color: var(--color-text-3);
}
.status-pending {
  background: #fef9c3;
  color: #ca8a04;
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
  gap: 10px;
  flex-wrap: wrap;
}
.meta-tag {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.card-time {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 4px;
}
</style>
