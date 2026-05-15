<template>
  <!-- 加载中 -->
  <view v-if="!loaded" class="dash-page">
    <view class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
  <!-- 仪表盘内容 -->
  <view v-else class="dash-page">
    <custom-nav-bar title="班级仪表盘" />

    <scroll-view scroll-y class="main-scroll">
      <!-- Header -->
      <view class="hero-strip">
        <text class="hero-title">📊 班级仪表盘</text>
        <text class="hero-sub">{{ roleLabel }} · 管理班级事务</text>
      </view>

      <!-- 通知管理 入口 -->
      <view class="entry-card" @tap="goPage('/pages/dashboard/notice-manage')">
        <view class="entry-left">
          <text class="entry-icon">📋</text>
          <view class="entry-info">
            <text class="entry-title">通知管理</text>
            <text class="entry-desc">查看/编辑/删除通知 · 待办完成追踪</text>
          </view>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <!-- 管理入口 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">⚙️ 快捷管理</text>
        </view>
        <view class="grid-3col">
          <view class="grid-item" @tap="goPage('/pages/leave/approve')">
            <text class="gi-icon">✅</text>
            <text class="gi-label">待办审批</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/fee/index')">
            <text class="gi-icon">💰</text>
            <text class="gi-label">班费管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/admin/members')">
            <text class="gi-icon">👥</text>
            <text class="gi-label">成员管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/vote/index')">
            <text class="gi-icon">🗳️</text>
            <text class="gi-label">投票管理</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/notice/publish')">
            <text class="gi-icon">📢</text>
            <text class="gi-label">发布通知</text>
          </view>
          <view class="grid-item" @tap="goPage('/pages/album/index')">
            <text class="gi-icon">📷</text>
            <text class="gi-label">相册管理</text>
          </view>
        </view>
      </view>

      <view class="page-spacer"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getRoleLabel } from '@/constants/roles'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const loaded = ref(false)
let redirecting = false

// 非干部直接退回首页
onLoad(() => {
  try {
    if (redirecting) return
    if (!store.isAdmin) {
      redirecting = true
      console.log('[dashboard] not admin, redirecting to index')
      uni.reLaunch({ url: '/pages/index/index' })
      return
    }
    console.log('[dashboard] admin confirmed, rendering')
    loaded.value = true
  } catch (e) {
    console.error('[dashboard] onLoad error:', e)
    loaded.value = true  // 出错仍尝试渲染
  }
})
const roleLabel = computed(() => getRoleLabel(store.user?.role))

function goPage(url: string) {
  uni.navigateTo({ url })
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.dash-page {
  min-height: 100vh;
  background: $surface;
}

.loading-box {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-text {
  font-size: 28rpx;
  color: $on-surface-tertiary;
}

.main-scroll {
  height: calc(100vh - 110rpx);
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
}

.hero-strip {
  margin: 24rpx 32rpx 20rpx;
  padding: 32rpx 28rpx;
  background: $gradient-primary;
  border-radius: 24rpx;

  .hero-title {
    font-size: 40rpx;
    font-weight: 800;
    color: #fff;
    letter-spacing: 2rpx;
  }
  .hero-sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

/* 入口卡片 */
.entry-card {
  margin: 0 28rpx 28rpx;
  padding: 28rpx 24rpx;
  background: #fff;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.entry-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex: 1;
}
.entry-icon {
  font-size: 48rpx;
  width: 56rpx;
  text-align: center;
}
.entry-info {
  flex: 1;
}
.entry-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $on-surface;
}
.entry-desc {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $on-surface-tertiary;
}
.entry-arrow {
  font-size: 40rpx;
  color: $on-surface-tertiary;
  padding-left: 16rpx;
}

.section {
  margin: 0 28rpx 28rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: 700;
      color: $on-surface;
    }
  }
}

.grid-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;

  .grid-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);

    .gi-icon { font-size: 48rpx; }
    .gi-label {
      font-size: 24rpx;
      font-weight: 600;
      color: $on-surface;
    }
  }
}

.page-spacer { height: 32rpx; }
</style>
