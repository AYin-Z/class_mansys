<template>
  <div class="publish-page">
    <custom-nav-bar title="发布作业" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="form-card">
          <div class="form-row"><span class="row-label block">作业标题</span><input class="solid-input" placeholder="请输入标题" v-model="form.title" /></div>
          <div class="textarea-wrap"><span class="row-label block">作业要求</span><textarea class="solid-textarea" v-model="form.description" placeholder="详细描述作业要求..." /></div>
          <div class="form-row">
            <span class="row-label block">截止日期</span>
            <picker mode="date" :value="form.deadlineDate" @change="onDateChange">
              <div class="solid-input picker-display">{{ form.deadlineDate || '请选择日期' }}</div>
            </picker>
          </div>
          <div class="form-row">
            <span class="row-label block">截止时间</span>
            <picker mode="time" :value="form.deadlineTime" @change="onTimeChange">
              <div class="solid-input picker-display">{{ form.deadlineTime || '请选择时间' }}</div>
            </picker>
          </div>
        </div>

        <!-- 附件区域 -->
        <div class="section-label mt-lg">
          <span class="label-text">附件（可选）</span>
        </div>

        <!-- 已选附件列表 -->
        <div class="attach-list" v-if="form.attachments.length > 0">
          <div class="attach-item" v-for="(item, idx) in form.attachments" :key="idx">
            <span class="attach-icon">📎</span>
            <div class="attach-info">
              <span class="attach-name">{{ item.name }}</span>
              <span class="attach-size">{{ formatSize(item.size) }}</span>
            </div>
            <span class="attach-del" @click="removeAttachment(idx)">✕</span>
          </div>
        </div>

        <div class="attach-actions">
          <div class="attach-btn" @click="chooseFile">
            <span class="btn-icon">📤</span>
            <span class="btn-label">上传文件</span>
          </div>
          <div class="attach-btn" @click="showResourcePicker = true">
            <span class="btn-icon">📂</span>
            <span class="btn-label">引用资源</span>
          </div>
        </div>
      </div>

      <!-- 资源引用弹出层 -->
      <div class="overlay" v-if="showResourcePicker" @click="showResourcePicker = false"></div>
      <div class="resource-picker" v-if="showResourcePicker">
        <div class="picker-header">
          <span class="picker-title">选择公共资源</span>
          <span class="picker-close" @click="showResourcePicker = false">关闭</span>
        </div>
        <div scroll-y class="picker-list">
          <div class="resource-item" v-for="item in resources" :key="item.id" @click="pickResource(item)">
            <span class="res-icon">📄</span>
            <div class="res-info">
              <span class="res-name">{{ item.name }}</span>
              <span class="res-meta">{{ item.type }} · {{ formatSize(item.size) }}</span>
            </div>
            <span class="res-add">+</span>
          </div>
          <div class="empty-hint" v-if="resources.length === 0">暂无可用资源</div>
        </div>
      </div>

      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">发布作业</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createHomework } from '@/api/homework'
import { getResources } from '@/api/announcement'
const form = reactive({ title: '', description: '', deadlineDate: '', deadlineTime: '23:59', attachments: [] })
const showResourcePicker = ref(false)
const resources = ref([])

function onDateChange(e) { form.deadlineDate = e.detail.value }
function onTimeChange(e) { form.deadlineTime = e.detail.value }

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function removeAttachment(idx) {
  form.attachments.splice(idx, 1)
}

async function chooseFile() {
  const BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  const token = (() => {
    try { return localStorage.getItem('backend_token') || '' } catch { return '' }
  })()

  uni.chooseMessageFile({
    count: 5,
    success: async (res) => {
      uni.showLoading({ title: '上传中...' })
      for (const file of res.tempFiles) {
        try {
          const uploadResult = await new Promise((resolve, reject) => {
            uni.uploadFile({
              url: `${BASE}/api/announcement/resources/upload`,
              filePath: file.path,
              name: 'file',
              header: { Authorization: `Bearer ${token}` },
              success: (r) => {
                try { resolve(JSON.parse(r.data)) } catch { reject(new Error('解析上传结果失败')) }
              },
              fail: reject
            })
          })
          if (uploadResult.success) {
            form.attachments.push({
              name: uploadResult.filename || file.name,
              url: uploadResult.url,
              size: uploadResult.size || file.size,
              type: uploadResult.type || 'file'
            })
          } else {
            uni.showToast({ title: uploadResult.error || '上传失败', icon: 'none' })
          }
        } catch (e) {
          console.error('文件上传失败:', e)
          showToast('文件上传失败')
        }
      }
      
    }
  })
}

async function openResourcePicker() {
  showResourcePicker.value = true
  if (resources.value.length === 0) {
    try {
      const res = await getResources()
      if (res.success) {
        resources.value = res.resources || []
      }
    } catch (e) {
      console.error('获取资源列表失败:', e)
    }
  }
}

function pickResource(item) {
  // 避免重复引用
  if (form.attachments.some(a => a.url === item.url)) {
    showToast('该资源已被引用')
    return
  }
  form.attachments.push({
    name: item.name,
    url: item.url,
    size: item.size,
    type: item.type
  })
  showResourcePicker.value = false
}

async function submit() {
  if (!form.title) { showToast('请输入标题'); return }
  if (!form.description) { showToast('请输入要求'); return }
  if (!form.deadlineDate) { showToast('请选择截止日期'); return }

  const deadline = `${form.deadlineDate} ${form.deadlineTime || '23:59'}:00`
  uni.showLoading({ title: '发布中...' })
  try {
    const res = await createHomework({
      title: form.title,
      description: form.description,
      deadline,
      attachments: form.attachments.length > 0 ? form.attachments : undefined
    })
    
    if (res?.success) {
      showToast('发布成功')
      setTimeout(() => router.back(), 1200)
    }
  } catch (e) {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.publish-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: $surface-container-lowest; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 28rpx 24rpx; }
.row-label { font-size: 28rpx; font-weight: 500; color: $on-surface; &.block { display: block; margin-bottom: 16rpx; } }
.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 30rpx; color: $on-surface; background: $surface; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: $outline-variant; } }
.picker-display { color: $on-surface; }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 200rpx; font-size: 28rpx; color: $on-surface; background: $surface; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &::placeholder { color: $outline-variant; } }

.section-label { margin-bottom: 20rpx; padding-left: 4rpx; }
.label-text { font-size: 22rpx; font-weight: 600; color: $on-surface-variant; text-transform: uppercase; letter-spacing: 4rpx; }
.mt-lg { margin-top: 48rpx; }

/* 附件列表 */
.attach-list { background: $surface-container-lowest; border-radius: 20rpx; margin-top: 20rpx; overflow: hidden; }
.attach-item { display: flex; align-items: center; gap: 20rpx; padding: 24rpx; border-bottom: 1rpx solid #f0f2f5; }
.attach-item:last-child { border-bottom: none; }
.attach-icon { font-size: 36rpx; flex-shrink: 0; }
.attach-info { flex: 1; min-width: 0; }
.attach-name { display: block; font-size: 26rpx; color: $on-surface; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-size { display: block; font-size: 22rpx; color: #8e93a6; margin-top: 4rpx; }
.attach-del { font-size: 28rpx; color: #e84c3d; padding: 8rpx; flex-shrink: 0; }

/* 附件操作按钮 */
.attach-actions { display: flex; gap: 20rpx; margin-top: 20rpx; }
.attach-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 32rpx 24rpx; background: $surface-container-lowest; border-radius: 20rpx; border: 2rpx dashed rgba(195,198,209,0.4); &:active { background: #fafbfc; } }
.btn-icon { font-size: 40rpx; }
.btn-label { font-size: 26rpx; color: $on-surface; font-weight: 500; }

/* 资源选择弹出层 */
.overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 200; }
.resource-picker { position: fixed; bottom: 0; left: 0; right: 0; max-height: 70vh; background: $surface-container-lowest; border-radius: 32rpx 32rpx 0 0; z-index: 201; display: flex; flex-direction: column; }
.picker-header { display: flex; align-items: center; justify-content: space-between; padding: 32rpx; border-bottom: 1rpx solid #f0f2f5; }
.picker-title { font-size: 30rpx; font-weight: 600; color: $on-surface; }
.picker-close { font-size: 26rpx; color: #8e93a6; }
.picker-list { flex: 1; overflow-y: auto; padding-bottom: env(safe-area-inset-bottom); }
.resource-item { display: flex; align-items: center; gap: 20rpx; padding: 24rpx 32rpx; &:active { background: $surface; } }
.res-icon { font-size: 36rpx; flex-shrink: 0; }
.res-info { flex: 1; min-width: 0; }
.res-name { display: block; font-size: 26rpx; color: $on-surface; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-meta { display: block; font-size: 22rpx; color: #8e93a6; margin-top: 4rpx; }
.res-add { font-size: 32rpx; color: $primary; font-weight: 700; flex-shrink: 0; padding: 8rpx; }
.empty-hint { text-align: center; padding: 60rpx 0; color: $outline-variant; font-size: 26rpx; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: $gradient-primary; border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-size: 32rpx; font-weight: 700; color: $on-primary; }
</style>
