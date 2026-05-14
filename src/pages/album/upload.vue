<template>
  <view class="upload-page">
    <custom-nav-bar :title="navTitle" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">

      <view v-if="existingPhotos.length" class="section">
        <text class="section-title">已上传 ({{ existingPhotos.length }})</text>
        <view class="photo-grid">
          <view v-for="p in existingPhotos" :key="p.id" class="photo-item">
            <image :src="p.url" mode="aspectFill" class="photo-img" />
            <view v-if="!p.is_approved" class="pending-badge">待审核</view>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">本次上传</text>
        <view class="photo-grid">
          <view v-for="(img, idx) in photos" :key="idx" class="photo-item">
            <image :src="img" mode="aspectFill" class="photo-img" />
            <view class="remove-btn" @tap.stop="removePhoto(idx)"><text class="remove-x">×</text></view>
          </view>
          <view class="add-photo" @tap="choosePhoto"><text class="add-icon">+</text></view>
        </view>
      </view>

      <view style="height: 200rpx;"></view>
    </scroll-view>
    <view class="bottom-action">
      <button class="primary-btn" :disabled="loading || photos.length === 0" @click="submit">
        <text class="btn-text">{{ loading ? '上传中…' : `上传 (${photos.length}张)` }}</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getToken } from '@/utils/request'
import { getAlbumDetail, uploadPhotos } from '@/api/album'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

const albumId = ref(null)
const albumName = ref('')
const photos = ref([])
const existingPhotos = ref([])
const loading = ref(false)

const navTitle = computed(() => albumName.value ? `${albumName.value}` : '上传照片')

onLoad((opts) => {
  albumId.value = Number(opts?.id)
  albumName.value = opts?.name ? decodeURIComponent(opts.name) : ''
  if (albumId.value) fetchAlbum()
})

async function fetchAlbum() {
  try {
    const res = await getAlbumDetail(albumId.value)
    if (res?.success) {
      albumName.value = res.album?.name || albumName.value
      existingPhotos.value = res.photos || []
    }
  } catch (e) {}
}

function choosePhoto() {
  uni.chooseImage({
    count: 9 - photos.value.length,
    success: (res) => { photos.value.push(...res.tempFilePaths) }
  })
}

function removePhoto(idx) { photos.value.splice(idx, 1) }

async function submit() {
  if (!albumId.value) { uni.showToast({ title: '相册 ID 缺失', icon: 'none' }); return }
  if (photos.value.length === 0) { uni.showToast({ title: '请选择照片', icon: 'none' }); return }

  loading.value = true
  uni.showLoading({ title: `上传中 0/${photos.value.length}` })
  try {
    const urls = []
    const token = getToken()
    for (let i = 0; i < photos.value.length; i++) {
      const path = photos.value[i]
      // 上传单张图片到本地后端
      const uploadResult = await new Promise((resolve, reject) => {
        uni.uploadFile({
          url: `${API_BASE_URL}/api/album/photos/upload`,
          filePath: path,
          name: 'file',
          header: token ? { Authorization: `Bearer ${token}` } : {},
          success: (res) => {
            try {
              const data = JSON.parse(res.data)
              if (data.success) {
                resolve(data)
              } else {
                reject(new Error(data.error || '上传失败'))
              }
            } catch (e) {
              reject(new Error('解析响应失败'))
            }
          },
          fail: (err) => {
            reject(new Error(err.errMsg || '网络请求失败'))
          }
        })
      })
      if (uploadResult.url) urls.push(uploadResult.url)
      uni.showLoading({ title: `上传中 ${i + 1}/${photos.value.length}` })
    }
    if (urls.length === 0) throw new Error('无可上传文件')

    const res = await uploadPhotos({ album_id: albumId.value, urls })
    uni.hideLoading()
    if (res?.auto_approved) {
      uni.showToast({ title: `上传 ${urls.length} 张成功`, icon: 'success' })
    } else {
      uni.showToast({ title: '上传成功，等待审核', icon: 'none' })
    }
    photos.value = []
    fetchAlbum()
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.message || '上传失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped
> .upload-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.photo-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12rpx; padding: 24rpx 32rpx;
}
.photo-item { position: relative; width: 100%; aspect-ratio: 1; border-radius: 14rpx; overflow: hidden; }
.photo-img { width: 100%; height: 100%; }
.remove-btn {
  position: absolute; top: 6rpx; right: 6rpx; width: 40rpx; height: 40rpx;
  background: rgba(70,0,2,0.8); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.remove-x { color: #fff; font-size: 28rpx; line-height: 1; }
.add-photo {
  aspect-ratio: 1; border: 2rpx dashed rgba(195,198,209,0.5); border-radius: 14rpx;
  display: flex; align-items: center; justify-content: center;
}
.add-icon { font-size: 56rpx; color: #c3c6d1; }
.section { padding: 24rpx 32rpx 0; }
.section-title { font-size: 24rpx; font-weight: 600; color: #43474f; letter-spacing: 4rpx; text-transform: uppercase; display: block; margin-bottom: 16rpx; }
.pending-badge { position: absolute; top: 6rpx; left: 6rpx; padding: 4rpx 10rpx; background: rgba(70,98,112,0.85); color: #fff; border-radius: 6rpx; font-size: 18rpx; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
