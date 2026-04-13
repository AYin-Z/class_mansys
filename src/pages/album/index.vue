<template>
  <view class="album-page">
    <custom-nav-bar title="区队相册" />
    <scroll-view scroll-y class="main-scroll">
      <view class="album-grid">
        <view v-for="item in albums" :key="item.id" class="album-card" @tap="goAlbum(item)">
          <image :src="item.cover" mode="aspectFill" class="album-cover" />
          <view class="album-info">
            <text class="album-name">{{ item.name }}</text>
            <text class="album-count">{{ item.count }}张</text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>

    <view class="fab-btn" @tap="goCreate">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const albums = ref([
  { id: 1, name: '2026年春游活动', count: 48, cover: '/static/images/avatar.png' },
  { id: 2, name: '区队篮球赛', count: 32, cover: '/static/images/avatar.png' },
  { id: 3, name: '团建聚餐', count: 25, cover: '/static/images/avatar.png' },
  { id: 4, name: '日常训练', count: 67, cover: '/static/images/avatar.png' }
])

function goAlbum(item) { console.log('查看相册', item) }
function goCreate() { uni.navigateTo({ url: '/pages/album/create' }) }
</script>

<style lang="scss" scoped
> .album-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.album-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; padding: 24rpx 32rpx;
}
.album-card { background: #fff; border-radius: 18rpx; overflow: hidden; &:active { opacity: 0.85; } }
.album-cover { width: 100%; height: 280rpx; }
.album-info { padding: 18rpx 20rpx; }
.album-name { font-size: 26rpx; font-weight: 600; color: #191c1e; display: block; margin-bottom: 6rpx; }
.album-count { font-size: 22rpx; color: #c3c6d1; }

.fab-btn {
  position: fixed; right: 32rpx; bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 104rpx; height: 104rpx; background: linear-gradient(135deg, #001e40, #003366);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.3); z-index: 99;
  &:active { transform: scale(0.95); }
}
.fab-icon { font-size: 48rpx; color: #fff; line-height: 1; }
</style>