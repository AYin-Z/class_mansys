<script setup lang="ts">
/**
 * 投票详情
 *
 * 2026-09（体验修复）：
 *  - 三态（loading / error+retry / 投票不存在）：catch (_) {} 不再把失败吞成「投票不存在」
 *  - 原生 confirm() → await showConfirm()，写清对象与后果（结束投票不可再投）
 *  - 投票 / 结束投票加在途锁与 loading；成功 toast、失败 toastIfNotNotified
 *  - #dcfce7/#16a34a/#fef9c3/#ca8a04 → 语义令牌；底部避让交给 App.vue
 */
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getVoteDetail, castVote, closeVote, getVoteStatus, isVoteSingle } from '@/api/vote'
import type { VoteItem, VoteOption } from '@/api/vote'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()
const loading = ref(true)
const error = ref<unknown>(null)
const vote = ref<VoteItem | null>(null)
const options = ref<VoteOption[]>([])
const myChoices = ref<number[]>([])
const totalVotes = ref(0)
const selectedOptions = ref<number[]>([])
const submitting = ref(false)
const closing = ref(false)
const hasVoted = computed(() => myChoices.value.length > 0)
const isSingle = computed(() => vote.value ? isVoteSingle(vote.value) : true)
// 结束投票需要 CLOSE_VOTE 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canCloseVote = computed(() => userStore.hasPermission('CLOSE_VOTE'))

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

async function loadDetail(id: number) {
  try {
    const res = await getVoteDetail(id)
    if (res.success) {
      vote.value = res.vote
      options.value = res.options || []
      myChoices.value = res.my_choices || []
      totalVotes.value = res.total_votes || 0
      // If already voted, show results; otherwise prepare fresh selection
      selectedOptions.value = myChoices.value.length > 0 ? [...myChoices.value] : []
    } else {
      error.value = new Error('加载投票详情失败，请稍后重试')
    }
  } catch (e) {
    error.value = e
  }
}

async function load() {
  loading.value = true
  error.value = null
  const id = Number(route.query.id)
  if (!id) {
    // 无 id：直接进空态，不能停在 loading
    loading.value = false
    return
  }
  await loadDetail(id)
  loading.value = false
}

onMounted(load)

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
  if (!vote.value || submitting.value) return
  if (selectedOptions.value.length === 0) {
    showToast(isSingle.value ? '请选择一个选项' : '请至少选择一个选项', 'error')
    return
  }
  submitting.value = true
  try {
    const res = await castVote(vote.value.id, selectedOptions.value)
    if (res.success) {
      showToast('投票成功', 'success')
      await loadDetail(vote.value.id)
    } else {
      showToast('投票失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '投票失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

async function handleCloseVote() {
  if (!vote.value || closing.value) return
  const ok = await showConfirm('结束投票', `《${vote.value.title}》`, {
    danger: true,
    confirmText: '结束投票',
    hint: `结束后所有人不能再投票，当前已投的 ${totalVotes.value} 票仍计入结果`,
  })
  if (!ok) return
  closing.value = true
  try {
    const res = await closeVote(vote.value.id)
    if (res.success) {
      showToast('已结束投票', 'success')
      await loadDetail(vote.value.id)
    } else {
      showToast('操作失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '操作失败，请稍后重试')
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

    <StateView
      :loading="loading"
      :error="error"
      :empty="!vote"
      loading-text="正在加载投票详情…"
      empty-icon="check-circle"
      empty-title="投票不存在"
      empty-description="投票可能已被删除，请返回列表重新进入"
      @retry="load"
    >
      <template v-if="vote">
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
                  <AppIcon v-if="isSelected(opt.id)" name="check" :size="13" :stroke="3" />
                </div>
              </div>
              <span class="option-text">{{ opt.content }}</span>
            </div>

            <BaseButton
              block
              :loading="submitting"
              :disabled="selectedOptions.length === 0 || submitting"
              @click="handleCastVote"
            >
              {{ submitting ? '提交中…' : '提交投票' }}
            </BaseButton>
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
        <div v-if="canCloseVote && statusText === '进行中'" class="close-wrap">
          <BaseButton
            variant="danger"
            block
            :loading="closing"
            :disabled="closing"
            @click="handleCloseVote"
          >
            <AppIcon name="lock" :size="16" />
            <span>{{ closing ? '处理中…' : '结束投票' }}</span>
          </BaseButton>
        </div>
      </template>
    </StateView>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; }

/* Vote Header */
.vote-header {
  background: var(--color-surface);
  margin: 0 12px 16px;
  border-radius: var(--radius-md);
  padding: 20px 16px;
  box-shadow: var(--shadow-card);
}
.vote-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
  line-height: 1.3;
}
.vote-desc {
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
}
.status-active {
  background: var(--color-success-bg);
  color: var(--color-success);
}
.status-ended {
  background: var(--color-surface-2);
  color: var(--color-text-3);
}
.status-pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}
.type-tag {
  font-size: var(--font-size-xs);
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
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
}

/* Options Section */
.options-section {
  margin: 0 12px;
}
.section-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.total-label {
  font-size: var(--font-size-xs);
  font-weight: 400;
  color: var(--color-text-3);
}

/* Option Items (Voting Mode) */
.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
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
}
.option-item.selected .checkbox-square {
  border-color: var(--color-accent);
  background: var(--color-accent);
}

.option-text {
  font-size: var(--font-size-body);
  color: var(--color-text);
  flex: 1;
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
  font-size: var(--font-size-body);
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-tag {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 500;
  margin-left: 4px;
}
.result-stat {
  font-size: var(--font-size-xs);
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

/* Close Button */
.close-wrap {
  margin: 20px 12px 0;
}
</style>
