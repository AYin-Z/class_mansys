<script setup lang="ts">
/**
 * 抽奖详情
 *
 * 2026-09（体验修复）：
 *  - 开奖是终态写操作：原实现无确认、无成功反馈、失败静默（catch (_) {}）
 *    → showConfirm('开奖', '开奖后结果不可更改', { danger, hint }) + 成功 toast + 刷新 + 失败 toastIfNotNotified
 *  - winner_count 不再写死 1：沿用管理页的可选人数（默认 1，上限为参与人数）
 *  - 三态（loading / error+retry / 活动不存在）；参与抽奖失败不再静默
 *  - emoji（🏆🎉）→ AppIcon；--color-danger 兜底 #ff4d4f → var(--color-error)
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLotteryDetail, joinLottery, drawLottery } from '@/api/lottery'
import type { LotteryItem, LotteryParticipant } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showToast, showConfirm } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const lottery = ref<LotteryItem | null>(null)
const participants = ref<LotteryParticipant[]>([])
const myRecord = ref<{ is_winner: boolean | number; prize?: string | null } | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)
const joining = ref(false)
const drawing = ref(false)
/** 开奖人数（默认 1，可调整，上限 = 当前参与人数） */
const drawCount = ref(1)

function getStatus(): 'active' | 'ended' | 'pending' {
  if (!lottery.value) return 'ended'
  if (!lottery.value.is_active) return 'ended'
  const now = Date.now()
  const start = new Date(lottery.value.start_time).getTime()
  const end = new Date(lottery.value.end_time).getTime()
  if (now < start) return 'pending'
  if (now > end) return 'ended'
  return 'active'
}

const isActive = computed(() => getStatus() === 'active')
const hasJoined = computed(() => myRecord.value !== null)
// 开奖需要 DRAW_LOTTERY 权限（矩阵可在超管后台配置，故以服务端权限快照为准）
const canDraw = computed(() => userStore.hasPermission('DRAW_LOTTERY'))
const maxDrawCount = computed(() => Math.max(1, participants.value.length))

async function loadDetail() {
  loading.value = true
  error.value = null
  const id = Number(route.query.id)
  if (!id) {
    loading.value = false
    return
  }
  try {
    const res = await getLotteryDetail(id)
    if (res.success) {
      lottery.value = res.lottery
      participants.value = res.participants || []
      myRecord.value = res.myRecord ?? null
      drawCount.value = Math.min(Math.max(1, drawCount.value), Math.max(1, participants.value.length))
    } else {
      error.value = new Error('加载抽奖详情失败，请稍后重试')
    }
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

async function handleJoin() {
  if (!lottery.value || joining.value) return
  joining.value = true
  try {
    const res = await joinLottery(lottery.value.id)
    if (res.success) {
      myRecord.value = { is_winner: false, prize: null }
      showToast('参与成功', 'success')
      await loadDetail()
    } else {
      showToast('参与失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '参与失败，请稍后重试')
  } finally {
    joining.value = false
  }
}

async function handleDraw() {
  if (!lottery.value || drawing.value) return
  const count = Math.min(Math.max(1, Number(drawCount.value) || 1), maxDrawCount.value)
  const ok = await showConfirm('开奖', '开奖后结果不可更改', {
    danger: true,
    hint: `将按当前参与名单随机抽取 ${count} 名中奖者`,
    confirmText: '确认开奖',
  })
  if (!ok) return
  drawing.value = true
  try {
    const res = await drawLottery(lottery.value.id, { winner_count: count })
    if (res.success) {
      const winners = res.winner_participant_ids || []
      showToast(winners.length ? `开奖成功，共 ${winners.length} 名中奖者` : '开奖成功', 'success')
      await loadDetail()
    } else {
      showToast('开奖失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '开奖失败，请稍后重试')
  } finally {
    drawing.value = false
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

onMounted(loadDetail)
</script>

<template>
  <div class="detail-page">
    <NavBar title="抽奖详情" show-back @back="router.back()" />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!lottery"
      loading-text="正在加载抽奖详情…"
      empty-icon="gift"
      empty-title="抽奖活动不存在"
      empty-description="活动可能已被删除，请返回列表重新进入"
      @retry="loadDetail"
    >
      <template v-if="lottery">
        <!-- Info Section -->
        <div class="info-section">
          <h1 class="title">{{ lottery.name }}</h1>
          <div v-if="lottery.description" class="desc">{{ lottery.description }}</div>
          <div class="meta">
            <span>创建者: {{ lottery.creator_name || '' }}</span>
            <span>{{ formatTime(lottery.start_time) }} ~ {{ formatTime(lottery.end_time) }}</span>
          </div>
          <div v-if="lottery.rules" class="rules">
            <div class="rules-label">规则说明</div>
            <div class="rules-content">{{ lottery.rules }}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="action-section">
          <button
            v-if="isActive && !hasJoined"
            class="action-btn primary"
            :disabled="joining"
            @click="handleJoin"
          >
            {{ joining ? '参与中...' : '参与抽奖' }}
          </button>
          <div v-else-if="hasJoined && isActive" class="joined-badge">
            <AppIcon name="check-circle" :size="16" />
            <span>已参与</span>
          </div>
        </div>

        <!-- 开奖（需 DRAW_LOTTERY 权限） -->
        <div v-if="canDraw && isActive" class="draw-section">
          <div class="draw-count-row">
            <label class="draw-label" for="draw-count">开奖人数</label>
            <input
              id="draw-count"
              v-model.number="drawCount"
              class="draw-input"
              type="number"
              min="1"
              :max="maxDrawCount"
            />
            <span class="draw-hint">共 {{ participants.length }} 人参与</span>
          </div>
          <BaseButton
            variant="danger"
            block
            :loading="drawing"
            :disabled="drawing || participants.length === 0"
            @click="handleDraw"
          >
            <AppIcon name="gift" :size="16" />
            <span>{{ drawing ? '开奖中…' : '开奖' }}</span>
          </BaseButton>
        </div>

        <!-- Winners / Participants -->
        <div class="participants-section">
          <div class="section-title">
            参与人员
            <span class="count">({{ participants.length }})</span>
          </div>

          <EmptyState
            v-if="participants.length === 0"
            icon="users"
            title="还没有人参与"
            :description="isActive ? '参与抽奖后会显示在这里' : '活动期间没有人参与'"
          />

          <div
            v-for="p in participants"
            :key="p.id"
            class="participant-item"
            :class="{ winner: p.is_winner }"
          >
            <span class="participant-name">
              <AppIcon v-if="p.is_winner" name="trophy" :size="15" />
              {{ p.user_name || p.student_id || '用户' }}
            </span>
            <span v-if="p.is_winner && p.prize" class="prize-tag">{{ p.prize }}</span>
            <span v-if="p.is_winner" class="winner-tag">中奖</span>
          </div>
        </div>

        <!-- My record -->
        <div v-if="myRecord && myRecord.is_winner" class="celebration">
          <AppIcon name="sparkles" :size="18" />
          <span>恭喜中奖！</span>
          <span v-if="myRecord.prize">奖品：{{ myRecord.prize }}</span>
        </div>
      </template>
    </StateView>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; }

/* Info Section */
.info-section {
  padding: 16px;
}

.title {
  font-size: var(--font-size-title);
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.4;
  margin: 0 0 12px;
}

.desc {
  font-size: var(--font-size-body);
  color: var(--color-text-2);
  line-height: 1.6;
  margin-bottom: 12px;
}

.meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.rules {
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
  padding: 12px 16px;
}

.rules-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.rules-content {
  font-size: var(--font-size-sm);
  color: var(--color-text-2);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Action Section */
.action-section {
  padding: 0 16px 16px;
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  min-height: 44px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
  font-family: inherit;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--color-accent);
  color: #fff;
}

.joined-badge {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--radius-md);
  background: var(--color-success-bg);
  color: var(--color-success);
  font-size: var(--font-size-body);
  font-weight: 600;
}

/* 开奖区 */
.draw-section { padding: 0 16px 16px; }
.draw-count-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.draw-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-2); }
.draw-input {
  width: 76px; min-height: 44px; padding: 8px 10px; text-align: center;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface); color: var(--color-text); outline: none;
  font-family: inherit; font-size: var(--font-size-body);
}
.draw-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-bg); }
.draw-hint { font-size: var(--font-size-xs); color: var(--color-text-3); }

/* Participants Section */
.participants-section {
  padding: 0 16px;
}

.section-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.count {
  font-size: var(--font-size-sm);
  color: var(--color-text-3);
  font-weight: 400;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  transition: background 0.15s;
}

.participant-item.winner {
  background: var(--color-warning-bg);
}

.participant-name {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-body);
  color: var(--color-text);
}

.prize-tag {
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  font-weight: 500;
}

.winner-tag {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-weight: 500;
}

/* Celebration */
.celebration {
  margin: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  text-align: center;
  background: var(--color-warning-bg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-warning);
  line-height: 1.6;
}
</style>
