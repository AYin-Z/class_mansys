<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMyPoints, getPointsRanking } from '@/api/points'
import type { PointRecord, RankingItem } from '@/api/points'
import NavBar from '@/components/ui/NavBar.vue'

const loading = ref(true)
const activeTab = ref<'mine' | 'ranking'>('mine')

// My points
const totalPoints = ref(0)
const history = ref<PointRecord[]>([])

// Ranking
const ranking = ref<RankingItem[]>([])

onMounted(async () => {
  try {
    const [myRes, rankRes] = await Promise.all([
      getMyPoints(),
      getPointsRanking(50),
    ])
    if (myRes.success) {
      totalPoints.value = myRes.total || 0
      history.value = myRes.records || []
    }
    if (rankRes.success) {
      ranking.value = rankRes.ranking || []
    }
  } catch (_) {
    /* ignore */
  } finally {
    loading.value = false
  }
})

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

    <div v-if="loading" class="state-text">加载中...</div>

    <!-- 我的积分 Tab -->
    <template v-else-if="activeTab === 'mine'">
      <div class="points-card">
        <div class="points-label">我的积分</div>
        <div class="points-value">{{ totalPoints }}</div>
      </div>

      <div class="section">
        <div class="section-title">积分记录</div>
        <div v-if="history.length === 0" class="state-text">暂无积分记录</div>
        <div v-else class="history-list">
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
        <div v-if="ranking.length === 0" class="state-text">暂无排行数据</div>
        <div v-else class="ranking-list">
          <div
            v-for="(item, index) in ranking"
            :key="item.id"
            class="ranking-item"
          >
            <div class="rank-badge" :class="{ top3: index < 3 }">
              <template v-if="index === 0">🥇</template>
              <template v-else-if="index === 1">🥈</template>
              <template v-else-if="index === 2">🥉</template>
              <template v-else>{{ index + 1 }}</template>
            </div>
            <div class="rank-avatar">
              <img
                v-if="item.avatarUrl"
                :src="item.avatarUrl"
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
  </div>
</template>

<style scoped>
.points-page {
  padding-bottom: 24px;
  min-height: 100vh;
  background: var(--color-bg, #f5f5f5);
}

.state-text {
  text-align: center;
  padding: 48px 16px;
  font-size: 14px;
  color: var(--color-text-3);
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
  text-align: center;
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
  padding: 14px 16px;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.ranking-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border, #f0f0f0);
}

.ranking-item:active {
  background: var(--color-surface-hover, #fafafa);
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

.rank-badge.top3 {
  font-size: 20px;
}

.rank-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-bg-secondary, #f0f0f0);
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
  border-bottom: 1px solid var(--color-border, #f0f0f0);
}

.history-item:active {
  background: var(--color-surface-hover, #fafafa);
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
  color: var(--color-success, #52c41a);
}

.history-score.negative {
  color: var(--color-error, #ff4d4f);
}
</style>
