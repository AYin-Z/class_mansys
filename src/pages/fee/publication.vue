<template>
  <view class="publication-page">
    <custom-nav-bar title="财务公示" :showBack="true" />
    <scroll-view scroll-y class="main-scroll" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="loadData">
      <view class="pub-list">
        <view v-for="item in publications" :key="item.id" class="pub-card">
          <view class="card-accent"></view>
          <view class="card-body">
            <view class="card-header">
              <text class="pub-title">{{ item.title }}</text>
              <text class="pub-period">{{ item.period || '' }}</text>
            </view>

            <view class="finance-grid">
              <view class="finance-item">
                <text class="finance-label">收入</text>
                <text class="finance-value income">+¥{{ Number(item.total_income || 0).toFixed(2) }}</text>
              </view>
              <view class="finance-item">
                <text class="finance-label">支出</text>
                <text class="finance-value expense">-¥{{ Number(item.total_expense || 0).toFixed(2) }}</text>
              </view>
              <view class="finance-item accent">
                <text class="finance-label">结余</text>
                <text class="finance-value balance">¥{{ Number(item.balance || 0).toFixed(2) }}</text>
              </view>
            </view>

            <view class="pub-desc" v-if="item.details_json">
              <text class="desc-title">明细</text>
              <text class="desc-content">{{ typeof item.details_json === 'string' ? item.details_json : JSON.stringify(item.details_json) }}</text>
            </view>

            <view class="pub-footer">
              <text class="pub-time">发布者：{{ item.publisher_name || '未知' }} · {{ formatTime(item.published_at) }}</text>
            </view>
          </view>
        </view>

        <view v-if="publications.length === 0" class="empty-state">
          <text class="empty-text">暂无财务公示</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getPublications } from '@/api/fee'

const publications = ref([])
const refreshing = ref(false)

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

async function loadData() {
  refreshing.value = true
  try {
    const res = await getPublications()
    if (res.success) {
      publications.value = res.publications || []
    }
  } catch (e) {
    console.error('加载公示失败:', e)
  } finally {
    refreshing.value = false
  }
}

onMounted(() => loadData())
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.publication-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.pub-list { padding: 24rpx 32rpx; }

.pub-card { position: relative; display: flex; background: #fff; border-radius: 20rpx; overflow: hidden; margin-bottom: 16rpx; }
.card-accent { width: 10rpx; background: #001e40; flex-shrink: 0; }
.card-body { flex: 1; padding: 24rpx; }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.pub-title { font-family: 'PingFang SC'; font-size: 28rpx; font-weight: 600; color: #191c1e; flex: 1; }
.pub-period { font-size: 22rpx; color: #c3c6d1; margin-left: 12rpx; }

.finance-grid { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.finance-item {
  flex: 1; background: #f7f9fc; border-radius: 12rpx; padding: 16rpx; display: flex; flex-direction: column; gap: 6rpx;
  &.accent { background: rgba(0,30,64,0.04); }
}
.finance-label { font-size: 22rpx; color: #c3c6d1; }
.finance-value {
  font-size: 30rpx; font-weight: 700; font-family: 'PingFang SC';
  &.income { color: #003366; }
  &.expense { color: #800020; }
  &.balance { color: #001e40; }
}

.pub-desc { margin-bottom: 16rpx; padding: 12rpx; background: #f7f9fc; border-radius: 8rpx; }
.desc-title { display: block; font-size: 22rpx; color: #c3c6d1; margin-bottom: 6rpx; }
.desc-content { font-size: 24rpx; color: #43474f; line-height: 1.5; display: block; }

.pub-footer { display: flex; align-items: center; justify-content: flex-end; }
.pub-time { font-size: 22rpx; color: #c3c6d1; }

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
