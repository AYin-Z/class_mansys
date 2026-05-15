<template>
  <view class="psy-page">
    <custom-nav-bar title="心理干预" />
    <scroll-view scroll-y class="main-scroll">
      <view class="intro-card">
        <view class="accent-bar"></view>
        <text class="intro-title">私密保护</text>
        <text class="intro-desc">所有申请均匿名处理，仅指定人员可查看，严格保护您的隐私</text>
      </view>

      <button class="apply-entry" @tap="goApply">
        <text class="entry-icon">🧠</text>
        <text class="entry-text">申请新的心理干预</text>
      </button>

      <view v-if="isAdminUser" class="tab-row">
        <view :class="['tab-item', { active: tab === 'mine' }]" @tap="setTab('mine')"><text class="tab-text">我的</text></view>
        <view :class="['tab-item', { active: tab === 'all' }]" @tap="setTab('all')"><text class="tab-text">全部待处理</text></view>
      </view>

      <view class="section-header"><text class="section-title">{{ tab === 'all' ? '全部申请' : '我的申请记录' }}</text></view>

      <view class="app-list">
        <view v-for="item in apps" :key="item.id" class="app-card" @tap="goDetail(item)">
          <view :class="['status-bar', statusClass(item.status)]"></view>
          <view class="app-body">
            <text class="app-type">{{ extractType(item.content) }}</text>
            <text class="app-time">{{ formatDate(item.created_at) }}</text>
            <view :class="['status-tag', statusClass(item.status)]">{{ PSYCH_STATUS_LABEL[item.status] }}</view>
          </view>
        </view>

        <view v-if="!loading && apps.length === 0" class="empty-state">
          <text class="empty-text">暂无申请记录</text>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getMyPsychApplications, getAllPsychApplications, PSYCH_STATUS_LABEL } from '@/api/psychological'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const tab = ref('mine')
const apps = ref([])
const loading = ref(false)

function statusClass(s) {
  if (s === 0) return 'pending'
  if (s === 1) return 'processing'
  return 'completed'
}

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function extractType(content) {
  if (!content) return '心理干预申请'
  const m = String(content).match(/^\[(.+?)\]/)
  return m ? m[1] : '心理干预申请'
}

function setTab(t) { tab.value = t; fetchList() }

async function fetchList() {
  loading.value = true
  try {
    const res = tab.value === 'all'
      ? await getAllPsychApplications({ status: 0 })
      : await getMyPsychApplications()
    apps.value = res?.applications || []
  } catch (_) { apps.value = [] }
  finally { loading.value = false }
}

function goApply() { uni.navigateTo({ url: '/pages/psychological/apply' }) }
function goDetail(item) { uni.navigateTo({ url: `/pages/psychological/status?id=${item.id}` }) }

onShow(() => { fetchList() })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.psy-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.intro-card { position: relative; margin: 24rpx 32rpx; background: linear-gradient(135deg, rgba(0,30,64,0.03), rgba(0,51,102,0.02)); border-radius: 20rpx; padding: 28rpx 24rpx; overflow: hidden; }
.accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 10rpx; background: #003366; }
.intro-title { font-size: 30rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 10rpx; }
.intro-desc { font-size: 25rpx; color: #43474f; line-height: 1.5; }

.apply-entry { display: flex; align-items: center; gap: 16rpx; margin: 24rpx 32rpx; padding: 28rpx 24rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; &::after { display: none; } &:active { opacity: 0.9; } }
.entry-icon { font-size: 40rpx; }
.entry-text { font-size: 29rpx; font-weight: 600; color: #fff; }

.tab-row { display: flex; gap: 12rpx; padding: 0 32rpx; margin-top: 24rpx; }
.tab-item { flex: 1; height: 64rpx; border-radius: 32rpx; background: #fff; display: flex; align-items: center; justify-content: center; &.active { background: #001e40; .tab-text { color: #fff; } } }
.tab-text { font-size: 26rpx; color: #43474f; font-weight: 500; }

.section-header { padding: 0 32rpx; margin-top: 32rpx; }
.section-title { font-size: 30rpx; font-weight: 600; color: #191c1e; }

.app-list { padding: 16rpx 32rpx 32rpx; }
.app-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; }
.status-bar { width: 10rpx; flex-shrink: 0;
  &.pending { background: #c3c6d1; }
  &.processing { background: #466270; }
  &.completed { background: #003366; }
}
.app-body { flex: 1; padding: 22rpx 24rpx; display: flex; align-items: center; gap: 12rpx; }
.app-type { flex: 1; font-size: 27rpx; font-weight: 500; color: #191c1e; }
.app-time { font-size: 23rpx; color: #c3c6d1; }
.status-tag { padding: 6rpx 16rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.pending { background: rgba(195,198,209,0.2); color: #43474f; }
  &.processing { background: rgba(70,98,112,0.08); color: #466270; }
  &.completed { background: rgba(0,30,64,0.06); color: #001e40; }
}

.empty-state { padding: 60rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
</style>
