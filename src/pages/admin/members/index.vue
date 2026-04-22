<template>
  <view class="admin-members-page">
    <view class="header-section">
      <view class="brand-bar"></view>
      <view class="header-content">
        <text class="title">成员管理</text>
        <text class="subtitle">查看区队成员、请假状态与系统内操作</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <picker
        mode="selector"
        :range="classes"
        range-key="name"
        :value="classIndex"
        @change="onClassChange"
      >
        <view class="filter-item">
          <text class="filter-label">班级</text>
          <view class="filter-value">
            <text class="filter-text">{{ classes[classIndex]?.name || '全部' }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </picker>
      <view class="search-wrap">
        <input
          class="search-input"
          placeholder="搜索姓名/学号/手机号"
          confirm-type="search"
          v-model="keyword"
          @confirm="load"
        />
      </view>
    </view>

    <view class="summary-row">
      <text class="summary-text">共 {{ total }} 名成员 · 当前 {{ members.length }} 条</text>
      <text class="refresh-btn" @tap="load">刷新</text>
    </view>

    <scroll-view scroll-y class="list-scroll">
      <view v-if="!members.length && !loading" class="empty-state">
        <text class="empty-text">暂无数据</text>
      </view>

      <view
        v-for="m in members"
        :key="m.id"
        class="member-card"
        @tap="goDetail(m.id)"
      >
        <view class="avatar-wrap">
          <image v-if="m.avatarUrl" :src="m.avatarUrl" mode="aspectFill" class="avatar" />
          <view v-else class="avatar avatar-fallback">
            <text class="avatar-initial">{{ (m.name || '?').slice(0, 1) }}</text>
          </view>
        </view>
        <view class="info-col">
          <view class="name-row">
            <text class="name">{{ m.name }}</text>
            <text class="role-tag">{{ roleLabel(m.role) }}</text>
          </view>
          <text class="sub">学号 {{ m.student_id }} · {{ m.class_name || m.class_id || '未分班' }}</text>
          <view class="status-row">
            <text
              :class="['status-chip', m.active_leave_count ? 'chip-warn' : 'chip-ok']"
            >{{ m.active_leave_count ? '请假中' : '在岗' }}</text>
            <text class="muted">最近操作 · {{ formatDate(m.last_action_at) }}</text>
          </view>
        </view>
        <text class="arrow big">›</text>
      </view>

      <view v-if="hasMore" class="load-more" @tap="loadMore">
        <text class="load-more-text">{{ loading ? '加载中…' : '加载更多' }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { listMembers } from '@/api/admin'
import { getClasses } from '@/api/classes'
import { getRoleLabel } from '@/constants/roles'

const DEFAULT_CLASS_LIST = [
  { id: '', name: '全部' },
  { id: 'class001', name: '一区队' },
  { id: 'class002', name: '二区队' },
  { id: 'class003', name: '三区队' },
  { id: 'class004', name: '四区队' },
  { id: 'class005', name: '五区队' },
  { id: 'class006', name: '六区队' }
]

const classes = ref(DEFAULT_CLASS_LIST)
const classIndex = ref(0)
const keyword = ref('')

const members = ref([])
const page = ref(1)
const pageSize = 30
const total = ref(0)
const loading = ref(false)
const hasMore = ref(false)

function roleLabel(r) {
  return getRoleLabel(r)
}

function formatDate(iso) {
  if (!iso) return '无'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ')
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadClasses() {
  try {
    const res = await getClasses()
    if (res?.success && Array.isArray(res.classes)) {
      classes.value = [{ id: '', name: '全部' }, ...res.classes]
    }
  } catch (_) { /* 使用默认值 */ }
}

function onClassChange(e) {
  classIndex.value = Number(e.detail.value) || 0
  load()
}

async function load() {
  loading.value = true
  try {
    const selected = classes.value[classIndex.value]
    const res = await listMembers({
      class_id: selected?.id || undefined,
      keyword: keyword.value?.trim() || undefined,
      page: 1,
      pageSize
    })
    if (res?.success) {
      members.value = res.members || []
      total.value = res.total || 0
      page.value = 1
      hasMore.value = members.value.length < total.value
    }
  } catch (e) {
    console.error('成员列表加载失败:', e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const selected = classes.value[classIndex.value]
    const res = await listMembers({
      class_id: selected?.id || undefined,
      keyword: keyword.value?.trim() || undefined,
      page: page.value + 1,
      pageSize
    })
    if (res?.success) {
      members.value = members.value.concat(res.members || [])
      page.value += 1
      total.value = res.total || total.value
      hasMore.value = members.value.length < total.value
    }
  } catch (e) {
    console.error('加载更多失败:', e)
  } finally {
    loading.value = false
  }
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/admin/members/detail?id=${id}` })
}

onMounted(async () => {
  await loadClasses()
  await load()
})
</script>

<style lang="scss" scoped>
.admin-members-page {
  min-height: 100vh;
  background: #f7f9fc;
  display: flex;
  flex-direction: column;
}

.header-section {
  position: relative;
  padding: 48rpx 32rpx 32rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
}

.brand-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 12rpx;
  background: rgba(255, 255, 255, 0.15);
}

.header-content { display: flex; flex-direction: column; gap: 8rpx; }

.title {
  font-size: 44rpx;
  font-weight: 700;
  color: #ffffff;
}

.subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.filter-bar {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx 8rpx;
}

.filter-item {
  min-width: 180rpx;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.filter-label { font-size: 22rpx; color: #8c909a; }
.filter-value { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; }
.filter-text { font-size: 28rpx; color: #001e40; font-weight: 600; }
.arrow { color: #c3c6d1; font-size: 32rpx; }
.arrow.big { font-size: 40rpx; flex-shrink: 0; }

.search-wrap {
  flex: 1;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  height: 44rpx;
  font-size: 26rpx;
  color: #191c1e;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 32rpx 8rpx;
}
.summary-text { font-size: 24rpx; color: #8c909a; }
.refresh-btn { font-size: 24rpx; color: #001e40; font-weight: 600; }

.list-scroll {
  flex: 1;
  padding: 8rpx 32rpx 32rpx;
}

.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text { font-size: 28rpx; color: #8c909a; }

.member-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  &:active { opacity: 0.85; }
}

.avatar-wrap { flex-shrink: 0; }
.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #e8ebf3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-fallback { background: linear-gradient(135deg, #001e40, #003366); }
.avatar-initial { color: #fff; font-size: 34rpx; font-weight: 700; }

.info-col { flex: 1; display: flex; flex-direction: column; gap: 10rpx; min-width: 0; }

.name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.name { font-size: 30rpx; font-weight: 700; color: #191c1e; }
.role-tag {
  padding: 2rpx 14rpx;
  background: rgba(0, 30, 64, 0.06);
  color: #001e40;
  border-radius: 20rpx;
  font-size: 20rpx;
  font-weight: 500;
}

.sub { font-size: 24rpx; color: #8c909a; }

.status-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.status-chip {
  padding: 2rpx 14rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}
.chip-ok {
  background: rgba(52, 168, 83, 0.1);
  color: #1f7a3b;
}
.chip-warn {
  background: rgba(231, 147, 23, 0.15);
  color: #b05e00;
}
.muted { font-size: 22rpx; color: #b0b4bd; }

.load-more {
  padding: 40rpx;
  text-align: center;
}
.load-more-text { font-size: 26rpx; color: #8c909a; }
</style>
