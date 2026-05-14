<template>
  <view class="upload-page">
    <custom-nav-bar title="上传资源" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="form-card">
          <view class="form-row"><text class="row-label block">资源名称</text><input class="solid-input" placeholder="请输入资源名称" v-model="name" /></view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">分类</text>
            <picker mode="selector" :range="categories" @change="onCategoryChange">
              <view class="row-value">
                <text class="value-text">{{ category || '请选择分类' }}</text>
                <text class="arrow">›</text>
              </view>
            </picker>
          </view>
          <view class="divider"></view>
          <view class="form-row"><text class="row-label block">资源描述</text><input class="solid-input" placeholder="简要描述（选填）" v-model="desc" /></view>
          <view class="divider"></view>
          <view class="upload-section"><text class="row-label block">选择文件</text>
            <view class="upload-area" @tap="chooseFile"><text class="upload-icon">📁</text><text class="upload-text">{{ fileName || '点击选择文件' }}</text></view>
            <text v-if="fileSize" class="hint">大小：{{ formatSize(fileSize) }}</text>
          </view>
        </view>
      </view>
      <view class="bottom-action"><button class="primary-btn" :disabled="loading" @click="submit"><text class="btn-text">{{ loading ? '上传中…' : '上传' }}</text></button></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { getToken } from '@/utils/request'
import { createResource } from '@/api/announcement'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

const categories = ['学习', '生活', '体能', '通知', '其他']
const name = ref('')
const category = ref('')
const desc = ref('')
const fileName = ref('')
const filePath = ref('')
const fileSize = ref(0)
const fileType = ref('')
const loading = ref(false)

function onCategoryChange(e) {
  category.value = categories[e.detail.value]
}

function chooseFile() {
  uni.chooseMessageFile({
    count: 1,
    success: (res) => {
      const f = res.tempFiles[0]
      fileName.value = f.name
      filePath.value = f.path
      fileSize.value = f.size || 0
      fileType.value = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : ''
      if (!name.value) name.value = f.name
    },
    fail: () => {
      // H5 不支持 chooseMessageFile，回退到 chooseImage
      uni.chooseImage({
        count: 1,
        success: (r) => {
          const p = r.tempFilePaths[0]
          fileName.value = p.split('/').pop() || 'image.jpg'
          filePath.value = p
          fileSize.value = (r.tempFiles && r.tempFiles[0]?.size) || 0
          fileType.value = 'image'
          if (!name.value) name.value = fileName.value
        }
      })
    }
  })
}

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + 'KB'
  return n + 'B'
}

async function submit() {
  if (!name.value.trim()) { uni.showToast({ title: '请输入名称', icon: 'none' }); return }
  if (!category.value) { uni.showToast({ title: '请选择分类', icon: 'none' }); return }
  if (!filePath.value) { uni.showToast({ title: '请选择文件', icon: 'none' }); return }

  loading.value = true
  uni.showLoading({ title: '上传中...' })
  try {
    // 1. 上传文件到本地后端
    const uploadResult = await new Promise((resolve, reject) => {
      const token = getToken()
      uni.uploadFile({
        url: `${API_BASE_URL}/api/announcement/resources/upload`,
        filePath: filePath.value,
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

    // 2. 保存资源记录
    await createResource({
      name: name.value.trim(),
      type: uploadResult.type || fileType.value || 'file',
      url: uploadResult.url,
      size: uploadResult.size || fileSize.value,
      category: category.value,
      description: desc.value.trim()
    })

    uni.hideLoading()
    uni.showToast({ title: '上传成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
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
.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; &::placeholder { color: #c3c6d1; } }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.upload-section { padding: 28rpx 24rpx; }
.upload-area { display: flex; align-items: center; gap: 16rpx; padding: 32rpx 20rpx; background: #f7f9fc; border-radius: 14rpx; border: 2rpx dashed rgba(195,198,209,0.4); &:active { background: #fafbfc; } }
.upload-icon { font-size: 40rpx; }
.upload-text { font-size: 27rpx; color: #191c1e; &.placeholder { color: #c3c6d1; } }
.hint { display: block; margin-top: 10rpx; font-size: 22rpx; color: #c3c6d1; }
.row-value { display: flex; align-items: center; justify-content: space-between; padding: 18rpx 20rpx; background: #f7f9fc; border-radius: 12rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 32rpx; color: #c3c6d1; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
