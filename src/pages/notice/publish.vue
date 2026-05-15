<template>
  <view class="publish-page">
    <custom-nav-bar :title="isEdit ? '编辑通知' : '发布通知'" :showBack="true" />

    <scroll-view scroll-y class="main-scroll">
      <view class="form-area">
        <view class="section-label">
          <text class="label-text">通知内容</text>
        </view>

        <view class="form-card">
          <view class="form-row">
            <text class="row-label block">通知标题</text>
            <input class="solid-input" placeholder="请输入通知标题" v-model="formData.title" />
          </view>

          <view class="divider"></view>

          <picker mode="selector" :range="typeOptions" @change="onTypeChange">
            <view class="form-row">
              <text class="row-label">类型</text>
              <view class="row-value">
                <text class="value-text">{{ formData.type || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <picker mode="selector" :range="priorityOptions" @change="onPriorityChange">
            <view class="form-row">
              <text class="row-label">优先级</text>
              <view class="row-value">
                <text class="value-text">{{ formData.priorityLabel || '请选择' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>

          <view class="divider"></view>

          <view class="form-row toggle-row" @tap="formData.is_pinned = !formData.is_pinned">
            <text class="row-label">置顶</text>
            <view :class="['toggle', { on: formData.is_pinned }]">
              <view class="toggle-knob"></view>
            </view>
          </view>

          <view class="divider"></view>

          <view class="form-row toggle-row" @tap="formData.is_todo = !formData.is_todo">
            <text class="row-label">设为待办</text>
            <view class="row-hint"><text class="hint-text">需手动标记完成</text></view>
            <view :class="['toggle', { on: formData.is_todo }]">
              <view class="toggle-knob"></view>
            </view>
          </view>

          <view class="divider"></view>

          <view class="textarea-wrap">
            <text class="row-label block">通知正文</text>
            <textarea class="solid-textarea" v-model="formData.content" placeholder="请输入通知内容..." />
          </view>
        </view>

        <view class="section-label mt-lg">
          <text class="label-text">附件（可选）</text>
        </view>

        <!-- 已选附件列表 -->
        <view class="attach-list" v-if="formData.attachments.length > 0">
          <view class="attach-item" v-for="(item, idx) in formData.attachments" :key="idx">
            <text class="attach-icon">📎</text>
            <view class="attach-info">
              <text class="attach-name">{{ item.name }}</text>
              <text class="attach-size">{{ formatSize(item.size) }}</text>
            </view>
            <text class="attach-del" @click="removeAttachment(idx)">✕</text>
          </view>
        </view>

        <view class="attach-actions">
          <view class="attach-btn" @click="chooseFile">
            <text class="btn-icon">📤</text>
            <text class="btn-label">上传文件</text>
          </view>
          <view class="attach-btn" @click="openResourcePicker">
            <text class="btn-icon">📂</text>
            <text class="btn-label">引用资源</text>
          </view>
        </view>
      </view>

      <!-- 资源引用弹出层 -->
      <view class="overlay" v-if="showResourcePicker" @click="showResourcePicker = false"></view>
      <view class="resource-picker" v-if="showResourcePicker">
        <view class="picker-header">
          <text class="picker-title">选择公共资源</text>
          <text class="picker-close" @click="showResourcePicker = false">关闭</text>
        </view>
        <scroll-view scroll-y class="picker-list">
          <view class="resource-item" v-for="item in resources" :key="item.id" @click="pickResource(item)">
            <text class="res-icon">📄</text>
            <view class="res-info">
              <text class="res-name">{{ item.name }}</text>
              <text class="res-meta">{{ item.type }} · {{ formatSize(item.size) }}</text>
            </view>
            <text class="res-add">+</text>
          </view>
          <view class="empty-hint" v-if="resources.length === 0">暂无可用资源</view>
        </scroll-view>
      </view>

      <view class="bottom-action">
        <button class="primary-btn" @click="onPublish">
          <text class="btn-text">{{ isEdit ? '保存修改' : '发布通知' }}</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getNoticeDetail, createNotice, updateNotice } from '@/api/notice'
import { getResources } from '@/api/announcement'

const priorityOptions = ['日常', '重要', '紧急']
const typeOptions = ['系统通知', '集合通知', '学习通知', '活动通知', '其他']

const isEdit = ref(false)
const noticeId = ref(null)
const showResourcePicker = ref(false)
const resources = ref([])

const formData = reactive({
  title: '',
  type: '',
  priority: 0,
  priorityLabel: '日常',
  is_pinned: false,
  is_todo: false,
  content: '',
  attachments: []
})

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function removeAttachment(idx) {
  formData.attachments.splice(idx, 1)
}

function onPriorityChange(e) {
  const idx = e.detail.value
  formData.priority = idx
  formData.priorityLabel = priorityOptions[idx]
}

function onTypeChange(e) {
  const idx = e.detail.value
  formData.type = typeOptions[idx]
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
            formData.attachments.push({
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
          uni.showToast({ title: '文件上传失败', icon: 'none' })
        }
      }
      uni.hideLoading()
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
  if (formData.attachments.some(a => a.url === item.url)) {
    uni.showToast({ title: '该资源已被引用', icon: 'none' })
    return
  }
  formData.attachments.push({
    name: item.name,
    url: item.url,
    size: item.size,
    type: item.type
  })
  showResourcePicker.value = false
}

async function fetchDetail() {
  if (!noticeId.value) return
  try {
    const res = await getNoticeDetail(noticeId.value)
    if (res.success && res.notice) {
      const notice = res.notice
      formData.title = notice.title || ''
      formData.content = notice.content || ''
      formData.type = notice.type || ''
      formData.priority = notice.priority ?? 0
      formData.priorityLabel = priorityOptions[notice.priority] || '日常'
      formData.is_pinned = notice.is_pinned ?? false
      formData.is_todo = notice.is_todo ?? false
      formData.attachments = notice.attachments || []
    }
  } catch (error) {
    uni.showToast({ title: '加载通知详情失败', icon: 'none' })
  }
}

onLoad((opts) => {
  if (opts?.id) {
    isEdit.value = true
    noticeId.value = Number(opts.id)
    fetchDetail()
  }
})

async function onPublish() {
  if (!formData.title) {
    uni.showToast({ title: '请输入标题', icon: 'none' })
    return
  }
  if (!formData.content) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }

  uni.showLoading({ title: isEdit.value ? '保存中...' : '发布中...' })
  try {
    if (!formData.type) {
      uni.hideLoading()
      uni.showToast({ title: '请选择通知类型', icon: 'none' })
      return
    }
    const payload = {
      title: formData.title,
      content: formData.content,
      type: formData.type,
      priority: formData.priority,
      is_pinned: formData.is_pinned,
      is_todo: formData.is_todo,
      attachments: formData.attachments.length > 0 ? formData.attachments : undefined
    }
    const res = isEdit.value
      ? await updateNotice(noticeId.value, payload)
      : await createNotice(payload)
    uni.hideLoading()
    if (res.success) {
      uni.showToast({ title: isEdit.value ? '修改成功' : '发布成功', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    } else {
      uni.showToast({ title: res.message || '发布失败', icon: 'none' })
    }
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '网络错误，请重试', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.publish-page {
  min-height: 100vh;
  background-color: $surface;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.form-area {
  padding: 32rpx;
}

.section-label {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.label-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $on-surface-variant;
  text-transform: uppercase;
  letter-spacing: 4rpx;
}

.mt-lg {
  margin-top: 48rpx;
}

.form-card {
  background: $surface-container-lowest;
  border-radius: 20rpx;
  overflow: hidden;
}

.form-row {
  padding: 28rpx 24rpx;
}

.row-label {
  font-size: 28rpx;
  font-weight: 500;
  color: $on-surface;

  &.block {
    display: block;
    margin-bottom: 16rpx;
  }
}

.solid-input {
  width: 100%;
  height: 60rpx;
  font-size: 30rpx;
  color: $on-surface;
  background: $surface;
  border-radius: 12rpx;
  padding: 0 20rpx;
  border: none;

  &::placeholder {
    color: $outline-variant;
  }
}

.row-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value-text {
  font-size: 28rpx;
  color: $on-surface;
}

.arrow {
  font-size: 36rpx;
  color: $outline-variant;
}

.divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

.textarea-wrap {
  padding: 28rpx 24rpx;
}

.solid-textarea {
  width: 100%;
  min-height: 280rpx;
  font-size: 28rpx;
  color: $on-surface;
  background: $surface;
  border-radius: 12rpx;
  padding: 20rpx;
  border: none;
  box-sizing: border-box;

  &::placeholder {
    color: $outline-variant;
  }
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle {
  width: 80rpx;
  height: 44rpx;
  border-radius: 999rpx;
  background: #d8dde5;
  position: relative;
  transition: background 0.2s;

  &.on {
    background: $primary;

    .toggle-knob {
      transform: translateX(36rpx);
    }
  }
}

.toggle-knob {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: $surface-container-lowest;
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  transition: transform 0.2s;
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.1);
}

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
.overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: $uni-bg-color-mask; z-index: 200; }
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

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  @include glass-bar;
  z-index: 100;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  background: $gradient-primary;
  border-radius: 20rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25);

  &:active {
    transform: scale(0.98);
  }
}

.btn-text {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: $on-primary;
}
</style>
