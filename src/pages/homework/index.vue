<template>
  <view class="homework-page">
    <custom-nav-bar title="作业管理" />
    <scroll-view scroll-y class="main-scroll">
      <view class="hw-list">
        <view v-for="item in homeworks" :key="item.id" class="hw-card" @tap="goDetail(item)">
          <view :class="['status-dot', isExpired(item.deadline) ? 'expired' : 'active']"></view>
          <view class="hw-body">
            <text class="hw-title">{{ item.title }}</text>
            <text class="hw-course" v-if="item.creator_name">发布人：{{ item.creator_name }}</text>
            <view class="hw-meta">
              <text class="meta-deadline">截止：{{ formatDate(item.deadline) }}</text>
              <view :class="['status-tag', isExpired(item.deadline) ? 'expired' : 'active']">{{ isExpired(item.deadline) ? '已截止' : '进行中' }}</view>
            </view>
            <text class="hw-sub" v-if="typeof item.submission_count === 'number'">已提交 {{ item.submission_count }} 人</text>
          </view>
        </view>

        <view v-if="!loading && homeworks.length === 0" class="empty-state">
          <text class="empty-icon">📚</text>
          <text class="empty-title">暂无作业</text>
          <text class="empty-hint">{{ canPublish ? '点击右下角发布第一份作业' : '老师布置作业后会显示在这里' }}</text>
        </view>
      </view>

      <view style="height: 160rpx;"></view>
    </scroll-view>

    <view v-if="canPublish" class="fab" @tap="goPublish">
      <text class="fab-icon">+</text>
    </view>
    <custom-tab-bar current="homework" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getHomeworks } from '@/api/homework'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

const homeworks = ref([])
const loading = ref(false)

const canPublish = computed(() => checkIsAdmin(profile.value?.role))

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isExpired(s) {
  if (!s) return false
  return new Date(s).getTime() < Date.now()
}

async function fetchList() {
  loading.value = true
  try {
    const res = await getHomeworks()
    homeworks.value = res?.homeworks || []
  } catch (_) {
    homeworks.value = []
  } finally {
    loading.value = false
  }
}

function goDetail(item) { uni.navigateTo({ url: `/pages/homework/detail?id=${item.id}` }) }
function goPublish() { uni.navigateTo({ url: '/pages/homework/publish' }) }

onShow(() => { fetchList() })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.homework-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.hw-list { padding: 24rpx 32rpx; }
.hw-card { position: relative; display: flex; background: #fff; border-radius: 18rpx; overflow: hidden; margin-bottom: 14rpx; &:active { opacity: 0.85; } }
.status-dot {
  width: 10rpx; flex-shrink: 0;
  &.active { background: #466270; }
  &.expired { background: #c3c6d1; }
}
.hw-body { flex: 1; padding: 22rpx 24rpx; }
.hw-title { font-size: 28rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 6rpx; }
.hw-course { font-size: 23rpx; color: #c3c6d1; display: block; margin-bottom: 10rpx; }
.hw-meta { display: flex; align-items: center; justify-content: space-between; }
.meta-deadline { font-size: 23rpx; color: #43474f; }
.hw-sub { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 8rpx; }
.status-tag {
  padding: 5rpx 14rpx; border-radius: 999rpx; font-size: 20rpx; font-weight: 600;
  &.active { background: rgba(70,98,112,0.08); color: #466270; }
  &.expired { background: rgba(195,198,209,0.2); color: #43474f; }
}

.empty-state { margin: 80rpx 32rpx 0; padding: 60rpx 32rpx; text-align: center; background: #ffffff; border-radius: 24rpx; display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.empty-icon { font-size: 72rpx; line-height: 1; }
.empty-title { font-size: 30rpx; font-weight: 600; color: #43474f; }
.empty-hint { font-size: 24rpx; color: #c3c6d1; line-height: 1.5; }

.fab { position: fixed; right: 40rpx; bottom: calc(60rpx + env(safe-area-inset-bottom)); width: 112rpx; height: 112rpx; border-radius: 56rpx; background: #001e40; display: flex; align-items: center; justify-content: center; box-shadow: 0 16rpx 32rpx rgba(0,30,64,0.25); z-index: 50; }
.fab-icon { color: #fff; font-size: 56rpx; line-height: 1; }
</style>
