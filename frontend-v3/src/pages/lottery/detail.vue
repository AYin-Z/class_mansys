<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLotteryDetail, joinLottery, drawLottery } from '@/api/lottery'
import type { LotteryItem, LotteryParticipant } from '@/api/lottery'
import NavBar from '@/components/ui/NavBar.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const lottery = ref<LotteryItem | null>(null)
const participants = ref<LotteryParticipant[]>([])
const myRecord = ref<{ is_winner: boolean | number; prize?: string | null } | null>(null)
const loading = ref(true)
const joining = ref(false)
const drawing = ref(false)

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

async function loadDetail() {
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
    }
  } catch (_) {
    /* ignore */
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
      await loadDetail()
    }
  } catch (_) {
    /* ignore */
  } finally {
    joining.value = false
  }
}

async function handleDraw() {
  if (!lottery.value || drawing.value) return
  drawing.value = true
  try {
    await drawLottery(lottery.value.id, { winner_count: 1 })
    await loadDetail()
  } catch (_) {
    /* ignore */
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

    <div v-if="loading" class="state-text">加载中...</div>
    <div v-else-if="!lottery" class="state-text">抽奖活动不存在</div>

    <template v-else>
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
        <div v-else-if="hasJoined && isActive" class="joined-badge">已参与</div>
        <button
          v-if="canDraw && isActive"
          class="action-btn danger"
          :disabled="drawing"
          @click="handleDraw"
        >
          {{ drawing ? '开奖中...' : '开奖' }}
        </button>
      </div>

      <!-- Winners / Participants -->
      <div class="participants-section">
        <div class="section-title">
          参与人员
          <span class="count">({{ participants.length }})</span>
        </div>

        <div v-if="participants.length === 0" class="empty-participants">暂无参与记录</div>

        <div
          v-for="p in participants"
          :key="p.id"
          class="participant-item"
          :class="{ winner: p.is_winner }"
        >
          <span class="participant-name">
            <template v-if="p.is_winner">🏆 </template>
            {{ p.user_name || p.student_id || '用户' }}
          </span>
          <span v-if="p.is_winner && p.prize" class="prize-tag">{{ p.prize }}</span>
          <span v-if="p.is_winner" class="winner-tag">中奖</span>
        </div>
      </div>

      <!-- My record -->
      <div v-if="myRecord && myRecord.is_winner" class="celebration">
        🎉 恭喜中奖！
        <span v-if="myRecord.prize">奖品：{{ myRecord.prize }}</span>
      </div>
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

/* Info Section */
.info-section {
  padding: 16px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.4;
  margin: 0 0 12px;
}

.desc {
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.6;
  margin-bottom: 12px;
}

.meta {
  font-size: 12px;
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
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.rules-content {
  font-size: 13px;
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
  height: 44px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--color-accent);
  color: #fff;
}

.action-btn.danger {
  background: var(--color-danger, #ff4d4f);
  color: #fff;
}

.joined-badge {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text-2);
  font-size: 14px;
  font-weight: 500;
}

/* Participants Section */
.participants-section {
  padding: 0 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.count {
  font-size: 13px;
  color: var(--color-text-3);
  font-weight: 400;
}

.empty-participants {
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  color: var(--color-text-3);
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
  background: var(--color-warning-bg, #fff7e6);
}

.participant-name {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
}

.prize-tag {
  font-size: 12px;
  color: var(--color-warning);
  font-weight: 500;
}

.winner-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-warning-bg, #fff7e6);
  color: var(--color-warning);
  font-weight: 500;
}

/* Celebration */
.celebration {
  margin: 16px;
  padding: 20px;
  text-align: center;
  background: var(--color-warning-bg, #fff7e6);
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-warning);
  line-height: 1.6;
}
</style>
