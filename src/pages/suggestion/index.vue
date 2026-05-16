<template>
  <div class="suggestion-page">
    <custom-nav-bar title="建议箱" />
    <div scroll-y class="main-scroll">
      <div class="intro-card">
        <span class="intro-title">您的声音，我们倾听</span>
        <span class="intro-desc">匿名提交建议和意见，区队干部会认真处理每一条反馈</span>
      </div>

      <button class="submit-entry" @tap="goSubmit"><span class="entry-text">✉️ 提交建议</span></button>

      <div class="tab-row" v-if="canViewAll">
        <div :class="['tab-item', { active: tab === 'mine' }]" @tap="switchTab('mine')">
          <span class="tab-text">我的提交</span>
        </div>
        <div :class="['tab-item', { active: tab === 'all' }]" @tap="switchTab('all')">
          <span class="tab-text">全部</span>
        </div>
      </div>

      <div class="section-header" v-else><span class="section-title">我的提交</span></div>

      <div class="sug-list">
        <div v-for="item in suggestions" :key="item.id" class="sug-card" @tap="goStatus(item)">
          <div :class="['status-bar', statusKey(item.status)]"></div>
          <div class="sug-body">
            <div class="sug-top">
              <span class="sug-cat">{{ item.category }}</span>
              <div :class="['status-tag', statusKey(item.status)]">{{ statusLabel(item.status) }}</div>
            </div>
            <span class="sug-title">{{ item.content }}</span>
            <span class="sug-time">{{ formatTime(item.created_at) }}</span>
          </div>
        </div>

        <div v-if="suggestions.length === 0 && !loading" class="empty-state">
          <span class="empty-text">{{ tab === 'mine' ? '暂无提交记录' : '暂无建议' }}</span>
        </div>
      </div>

      <div style="height: 40rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMineSuggestions, getAllSuggestions, SUGGESTION_STATUS_LABEL } from '@/api/suggestion'
import { isAdmin } from '@/utils/auth'
const suggestions = ref([])
const tab = ref('mine')
const canViewAll = ref(false)
const loading = ref(false)

function statusKey(s) {
  if (s === 0) return 'pending'
  if (s === 1) return 'processing'
  return 'replied'
}

function statusLabel(s) {
  return SUGGESTION_STATUS_LABEL[s] || '未知'
}

function formatTime(ts) {
  if (!ts) return ''
  return String(ts).substring(0, 16).replace('T', ' ')
}

async function fetchData() {
  loading.value = true
  try {
    const res = tab.value === 'all'
      ? await getAllSuggestions()
      : await getMineSuggestions()
    if (res?.success) {
      suggestions.value = res.suggestions || []
    }
  } catch (e) {}
  finally { loading.value = false }
}

function switchTab(t) {
  if (tab.value === t) return
  tab.value = t
  fetchData()
}

function goSubmit() { router.push('/pages/suggestion/submit') }
function goStatus(item) { router.push(`/pages/suggestion/status?id=${item.id}`) }

onShow(() => {
  canViewAll.value = isAdmin()
  fetchData()
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.suggestion-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.intro-card {
  margin: 24rpx 32rpx; padding: 28rpx 24rpx; background: linear-gradient(135deg, rgba(0,30,64,0.04), rgba(0,51,102,0.02));
  border-radius: 20rpx; border-left: 8rpx solid $primary-container;
}
.intro-title { font-family: 'PingFang SC'; font-size: 29rpx; font-weight: 700; color: $on-surface; display: block; margin-bottom: 10rpx; }
.intro-desc { font-size: 25rpx; color: $on-surface-variant; line-height: 1.5; }

.submit-entry {
  margin: 20rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, $primary, $primary-container);
  border-radius: 18rpx; border: none; display: flex; align-items: center; justify-content: center;
  &::after { display: none; } &:active { opacity: 0.9; }
}
.entry-text { font-size: 28rpx; font-weight: 600; color: $on-primary; }

.section-header { padding: 0 32rpx; margin-top: 28rpx; }
.section-title { font-family: 'PingFang SC'; font-size: 30rpx; font-weight: 600; color: $on-surface; }

.tab-row { display: flex; gap: 16rpx; padding: 24rpx 32rpx 12rpx; }
.tab-item { flex: 1; height: 64rpx; border-radius: 32rpx; display: flex; align-items: center; justify-content: center; background: #fff; }
.tab-item.active { background: $primary; }
.tab-item.active .tab-text { color: $on-primary; }
.tab-text { font-size: 26rpx; font-weight: 500; color: $on-surface-variant; }

.sug-list { padding: 0 32rpx; }
.sug-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.status-bar {
  width: 10rpx; flex-shrink: 0;
  &.pending { background: $secondary; }
  &.processing { background: $primary-container; }
  &.replied { background: $primary; }
}
.sug-body { flex: 1; padding: 22rpx 24rpx; }
.sug-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10rpx; }
.sug-cat { font-size: 22rpx; color: $secondary; letter-spacing: 2rpx; text-transform: uppercase; font-weight: 600; }
.sug-title { font-size: 27rpx; font-weight: 500; color: $on-surface; line-height: 1.5; display: block; margin-bottom: 10rpx; }
.sug-time { font-size: 22rpx; color: $outline-variant; }
.status-tag {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.pending { background: rgba(70,98,112,0.08); color: $secondary; }
  &.processing { background: rgba(0,51,102,0.06); color: $primary-container; }
  &.replied { background: rgba(0,30,64,0.06); color: $primary; }
}

.empty-state { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: $outline-variant; }
</style>