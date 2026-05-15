<template>
  <view class="album-page">
    <custom-nav-bar title="区队相册" />
    <scroll-view scroll-y class="main-scroll">
      <view v-if="albums.length === 0 && !loading" class="empty">
        <text class="empty-text">还没有相册，点击右下角创建</text>
      </view>

      <view class="album-grid">
        <view v-for="item in albums" :key="item.id" class="album-card" @tap="goAlbum(item)">
          <image v-if="item.cover" :src="item.cover" mode="aspectFill" class="album-cover" />
          <view v-else class="album-cover placeholder-cover">
            <text class="placeholder-text">{{ item.name.substring(0, 1) }}</text>
          </view>
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
import { onShow } from '@dcloudio/uni-app'
import { getAlbums } from '@/api/album'

const albums = ref([])
const loading = ref(false)

async function fetchAlbums() {
  loading.value = true
  try {
    const res = await getAlbums()
    if (res?.success) {
      albums.value = (res.albums || []).map(a => ({
        id: a.id,
        name: a.name,
        count: Number(a.photo_count || 0),
        cover: a.cover_url || ''
      }))
    }
  } catch (e) { /* request 已 toast */ }
  finally { loading.value = false }
}

function goAlbum(item) {
  uni.navigateTo({ url: `/pages/album/upload?id=${item.id}&name=${encodeURIComponent(item.name)}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/album/create' })
}

onShow(() => fetchAlbums())
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.album-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.album-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; padding: 24rpx 32rpx;
}
.album-card { background: #fff; border-radius: 18rpx; overflow: hidden; &:active { opacity: 0.85; } }
.album-cover { width: 100%; height: 280rpx; }
.placeholder-cover { background: linear-gradient(135deg, #001e40, #003366); display: flex; align-items: center; justify-content: center; }
.placeholder-text { color: #fff; font-size: 64rpx; font-weight: 700; }
.empty { padding: 80rpx 32rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: #c3c6d1; }
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
