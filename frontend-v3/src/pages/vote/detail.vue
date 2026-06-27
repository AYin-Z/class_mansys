<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getVoteDetail, castVote, closeVote, getVoteStatus, isVoteSingle } from '@/api/vote'
import type { VoteItem, VoteOption } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const loading = ref(true)
const vote = ref<VoteItem | null>(null)
const options = ref<VoteOption[]>([])
const myChoices = ref<number[]>([])
const totalVotes = ref(0)
const selectedOptions = ref<number[]>([])
const submitting = ref(false)
const closing = ref(false)
const hasVoted = computed(() => myChoices.value.length > 0)
const isSingle = computed(() => vote.value ? isVoteSingle(vote.value) : true)
const isAdmin = computed(() => userStore.isAdmin)

const statusText = computed(() => {
  if (!vote.value) return ''
  const s = getVoteStatus(vote.value)
  if (s === 'pending') return '未开始'
  if (s === 'ended') return '已结束'
  return '进行中'
})

const statusClass = computed(() => {
  if (!vote.value) return ''
  const s = getVoteStatus(vote.value)
  if (s === 'pending') return 'status-pending'
  if (s === 'ended') return 'status-ended'
  return 'status-active'
})

onMounted(async () => {
  try {
    const id = Number(route.query.id)
    if (!id) return
    await loadDetail(id)
  } catch (_) { /* ignore */ }
  finally { loading.value = false }
})

async function loadDetail(id: number) {
  try {
    const res = await getVoteDetail(id)
    if (res.success) {
      vote.value = res.vote
      options.value = res.options || []
      myChoices.value = res.my_choices || []
      totalVotes.value = res.total_votes || 0
      // If already voted, show results; otherwise prepare fresh selection
      if (myChoices.value.length > 0) {
        selectedOptions.value = [...myChoices.value]
      } else {
        selectedOptions.value = []
      }
    }
  } catch (_) { /* ignore */ }
}

function toggleOption(optionId: number) {
  if (hasVoted.value) return
  if (isSingle.value) {
    selectedOptions.value = [optionId]
  } else {
    const idx = selectedOptions.value.indexOf(optionId)
    if (idx >= 0) {
      selectedOptions.value.splice(idx, 1)
    } else {
      selectedOptions.value.push(optionId)
    }
    selectedOptions.value = [...selectedOptions.value]
  }
}

function isSelected(optionId: number): boolean {
  return selectedOptions.value.includes(optionId)
}

async function handleCastVote() {
  if (!vote.value || selectedOptions.value.length === 0) return
  submitting.value = true
  try {
    const res = await castVote(vote.value.id, selectedOptions.value)
    if (res.success) {
      showToast('投票成功')
      await loadDetail(vote.value.id)
    } else {
      showToast('投票失败', 'error')
    }
  } catch (_) {
    showToast('投票失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function handleCloseVote() {
  if (!vote.value) return
  if (!confirm('确定要结束这次投票吗？')) return
  closing.value = true
  try {
    const res = await closeVote(vote.value.id)
    if (res.success) {
      showToast('已结束投票')
      await loadDetail(vote.value.id)
    } else {
      showToast('操作失败', 'error')
    }
  } catch (_) {
    showToast('操作失败', 'error')
  } finally {
    closing.value = false
  }
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
</script>

<template>
  <div class="detail-page">
    <NavBar :title="vote?.title || '投票详情'" show-back />

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="!vote" class="state-text">投票不存在</div>

    <template v-else>
      <!-- Vote Info -->
      <div class="vote-header">
        <h2 class="vote-title">{{ vote.title }}</h2>
        <div v-if="vote.description" class="vote-desc">{{ vote.description }}</div>
        <div class="header-meta">
          <span :class="['big-badge', statusClass]">{{ statusText }}</span>
          <span class="type-tag">{{ isSingle ? '单选' : '多选' }}</span>
        </div>
        <div class="time-info">
          <div class="time-row">
            <span class="time-label">开始</span>
            <span class="time-value">{{ formatTime(vote.start_time) }}</span>
          </div>
          <div class="time-row">
            <span class="time-label">结束</span>
            <span class="time-value">{{ formatTime(vote.end_time) }}</span>
          </div>
        </div>
        <div class="creator-info">发起人：{{ vote.creator_name || '' }}</div>
      </div>

      <!-- Options Area -->
      <div class="options-section">
        <div class="section-title">
          投票选项
          <span v-if="hasVoted || statusText === '已结束'" class="total-label">
            共 {{ totalVotes }} 票
          </span>
        </div>

        <!-- Voting Mode: active and not voted yet -->
        <template v-if="statusText === '进行中' && !hasVoted">
          <div
            v-for="opt in options"
            :key="opt.id"
            class="option-item"
            :class="{ selected: isSelected(opt.id) }"
            @click="toggleOption(opt.id)"
          >
            <div class="option-selector">
              <div v-if="isSingle" class="radio-circle">
                <div v-if="isSelected(opt.id)" class="radio-dot"></div>
              </div>
              <div v-else class="checkbox-square">
                <span v-if="isSelected(opt.id)" class="checkmark">✓</span>
              </div>
            </div>
            <span class="option-text">{{ opt.content }}</span>
          </div>

          <button
            class="vote-btn"
            :disabled="selectedOptions.length === 0 || submitting"
            @click="handleCastVote"
          >
            {{ submitting ? '提交中...' : '提交投票' }}
          </button>
        </template>

        <!-- Results Mode: ended or already voted -->
        <template v-else>
          <div
            v-for="opt in options"
            :key="opt.id"
            class="result-item"
            :class="{ 'my-choice': myChoices.includes(opt.id) }"
          >
            <div class="result-row">
              <span class="result-label">
                {{ opt.content }}
                <span
                  v-if="myChoices.includes(opt.id)"
                  class="my-tag"
                >我的选择</span>
              </span>
              <span class="result-stat">{{ opt.vote_count }}票 · {{ opt.rate ?? 0 }}%</span>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                :style="{ width: (opt.rate ?? 0) + '%' }"
              ></div>
            </div>
          </div>
        </template>
      </div>

      <!-- Admin: Close Vote -->
      <button
        v-if="isAdmin && statusText === '进行中'"
        class="close-btn"
        :disabled="closing"
        @click="handleCloseVote"
      >
        {{ closing ? '处理中...' : '结束投票' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  padding-bottom: 80px;
}
.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
}

/* Vote Header */
.vote-header {
  background: var(--color-surface);
  margin: 0 12px 16px;
  border-radius: var(--radius-md);
  padding: 20px 16px;
  box-shadow: var(--shadow-card);
}
.vote-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
  line-height: 1.3;
}
.vote-desc {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.6;
  margin-bottom: 12px;
}
.header-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.big-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
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
.type-tag {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.time-info {
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
  margin-bottom: 8px;
}
.time-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}
.time-label {
  color: var(--color-text-3);
  width: 40px;
  flex-shrink: 0;
}
.time-value {
  color: var(--color-text);
}
.creator-info {
  font-size: 12px;
  color: var(--color-text-3);
}

/* Options Section */
.options-section {
  margin: 0 12px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.total-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-3);
}

/* Option Items (Voting Mode) */
.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
  background: var(--color-surface);
}
.option-item:active {
  background: var(--color-surface-hover);
}
.option-item.selected {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
}

.option-selector {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
}
.option-item.selected .radio-circle {
  border-color: var(--color-accent);
}
.radio-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--color-accent);
}
.checkbox-square {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
.option-item.selected .checkbox-square {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.option-text {
  font-size: 14px;
  color: var(--color-text);
  flex: 1;
}

.vote-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-top: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.vote-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.vote-btn:not(:disabled):active {
  opacity: 0.8;
}

/* Result Items */
.result-item {
  padding: 12px 14px;
  margin-bottom: 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: background 0.15s;
}
.result-item.my-choice {
  background: var(--color-accent-bg);
}
.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.result-label {
  font-size: 14px;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-tag {
  font-size: 10px;
  color: var(--color-accent);
  font-weight: 500;
  margin-left: 4px;
}
.result-stat {
  font-size: 12px;
  color: var(--color-text-2);
  flex-shrink: 0;
}
.progress-track {
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--color-accent);
  transition: width 0.4s ease;
}
.result-item.my-choice .progress-fill {
  background: var(--color-accent);
}

/* Close Button */
.close-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 20px 12px 0;
  height: 44px;
  border: 1.5px solid var(--color-error);
  color: var(--color-error);
  background: none;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.close-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
