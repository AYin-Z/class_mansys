<script setup lang="ts">
/**
 * 积分（我的积分 / 积分排行）
 *
 * 2026-09（B7）修复：
 *  - `catch (_) { /* ignore *\/ }` 把加载失败吞成「暂无积分记录」，
 *    积分总分还会静默显示 0 → 现在按 Tab 分别记录错误，StateView 显示原因 + 重试。
 *  - 两个 Tab 的空态改用 EmptyState（说清「为什么是空的」），不再是一行灰字。
 *  - 🥇🥈🥉 换 AppIcon(trophy)，硬编码色值兜底（#f0f0f0 / #52c41a / #ff4d4f）换令牌。
 *  - 去掉手写 80px 底部避让（由 App.vue 统一处理）。
 */
import { mediaUrl } from '@/utils/media'
import { ref, computed, onMounted } from 'vue'
import { getMyPoints, getPointsRanking } from '@/api/points'
import type { PointRecord, RankingItem } from '@/api/points'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const loading = ref(true)
const activeTab = ref<'mine' | 'ranking'>('mine')

// My points
const totalPoints = ref(0)
const history = ref<PointRecord[]>([])
const mineError = ref<unknown>(null)

// Ranking
const ranking = ref<RankingItem[]>([])
const rankError = ref<unknown>(null)

/** 两个接口分别容错：一个挂了不影响另一个 Tab 的内容 */
async function load() {
  loading.value = true
  mineError.value = null
  rankError.value = null
  const [my, rank] = await Promise.allSettled([getMyPoints(), getPointsRanking(50)])
  if (my.status === 'fulfilled' && my.value?.success) {
    totalPoints.value = my.value.total || 0
    history.value = my.value.records || []
  } else if (my.status === 'rejected') {
    mineError.value = my.reason
  }
  if (rank.status === 'fulfilled' && rank.value?.success) {
    ranking.value = rank.value.ranking || []
  } else if (rank.status === 'rejected') {
    rankError.value = rank.reason
  }
  loading.value = false
}

onMounted(load)

/** 当前 Tab 的错误：重试只针对看得到的那部分 */
const activeError = computed(() => (activeTab.value === 'mine' ? mineError.value : rankError.value))

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}
</script>

<template>
  <div class="points-page">
    <NavBar title="积分" />

    <!-- Tabs -->
    <div class="tabs">
      <div
        class="tab-item"
        :class="{ active: activeTab === 'mine' }"
        @click="activeTab = 'mine'"
      >
        我的积分
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'ranking' }"
        @click="activeTab = 'ranking'"
      >
        积分排行
      </div>
    </div>

    <StateView :loading="loading" :error="activeError" @retry="load">
      <!-- 我的积分 Tab -->
      <template v-if="activeTab === 'mine'">
        <div class="points-card">
          <div class="points-label">我的积分</div>
          <div class="points-value">{{ totalPoints }}</div>
        </div>

        <div class="section">
          <div class="section-title">积分记录</div>
          <StateView
            :empty="history.length === 0"
            empty-icon="star"
            empty-title="还没有积分记录"
            empty-description="干部加减分后，这里会显示每一条明细"
          />
          <div v-if="history.length" class="history-list">
            <div
              v-for="item in history"
              :key="item.id"
              class="history-item"
            >
              <div class="history-reason">{{ item.reason }}</div>
              <div class="history-meta">
                <span>{{ item.creator_name || '' }}</span>
                <span>{{ formatDate(item.created_at) }}</span>
              </div>
              <div class="history-score" :class="item.score >= 0 ? 'positive' : 'negative'">
                {{ item.score >= 0 ? '+' : '' }}{{ item.score }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 积分排行 Tab -->
      <template v-else>
        <div class="section">
          <StateView
            :empty="ranking.length === 0"
            empty-icon="trophy"
            empty-title="还没有排行数据"
            empty-description="全班有积分记录后，这里会按总分排序"
          />
          <div v-if="ranking.length" class="ranking-list">
            <div
              v-for="(item, index) in ranking"
              :key="item.id"
              class="ranking-item"
            >
              <div class="rank-badge" :class="{ top3: index < 3 }">
                <AppIcon
                  v-if="index < 3"
                  name="trophy"
                  :size="16"
                  :class="['trophy', `trophy-${index + 1}`]"
                />
                <template v-else>{{ index + 1 }}</template>
              </div>
              <div class="rank-avatar">
                <img
                  v-if="item.avatarUrl"
                  :src="mediaUrl(item.avatarUrl)"
                  alt="avatar"
                  class="avatar-img"
                />
                <div v-else class="avatar-placeholder">
                  {{ item.name?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="rank-info">
                <div class="rank-name">{{ item.name }}</div>
                <div class="rank-meta">{{ item.student_id }} · {{ item.records }} 条记录</div>
              </div>
              <div class="rank-score">{{ item.total_score }}</div>
            </div>
          </div>
        </div>
      </template>
    </StateView>
  </div>
</template>

<style scoped>
.points-page {
  padding-bottom: 8px;
  min-height: 100vh;
  background: var(--color-bg);
}

/* Tabs */
.tabs {
  display: flex;
  margin: 0 12px 12px;
  gap: 0;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 12px 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.tab-item.active {
  color: var(--color-accent);
  background: var(--color-accent-bg);
  font-weight: 600;
}

/* Top Card */
.points-card {
  margin: 0 12px 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 32px 20px;
  text-align: center;
}

.points-label {
  font-size: 14px;
  color: var(--color-text-3);
  margin-bottom: 8px;
}

.points-value {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1.2;
}

/* Section */
.section {
  margin: 0 12px 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  padding: 0 0 8px;
}

/* Ranking List */
.ranking-list {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 14px 16px;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.ranking-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.ranking-item:active {
  background: var(--color-surface-hover);
}

.rank-badge {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-3);
  flex-shrink: 0;
}

.trophy-1 { color: var(--color-warning); }
.trophy-2 { color: var(--color-text-2); }
.trophy-3 { color: var(--color-text-3); }

.rank-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-3);
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-meta {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
}

.rank-score {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent);
  flex-shrink: 0;
}

/* History Log */
.history-list {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.history-item {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  padding: 14px 16px;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.history-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.history-item:active {
  background: var(--color-surface-hover);
}

.history-reason {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
  padding-right: 60px;
}

.history-meta {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 4px;
  display: flex;
  gap: 12px;
}

.history-score {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 16px;
  font-weight: 700;
}

.history-score.positive {
  color: var(--color-success);
}

.history-score.negative {
  color: var(--color-error);
}
</style>
