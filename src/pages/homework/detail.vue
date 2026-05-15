<template>
  <div class="detail-page">
    <custom-nav-bar title="作业详情" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div v-if="hw" class="info-card">
        <span class="hw-title">{{ hw.title }}</span>
        <div class="info-row"><span class="label">发布人</span><span class="value">{{ hw.creator_name || '-' }}</span></div>
        <div class="info-row"><span class="label">截止时间</span><span :class="['value', { urgent: isUrgent }]">{{ formatDate(hw.deadline) }}</span></div>
        <div class="desc-section">
          <span class="section-label">作业要求</span>
          <span class="desc-text">{{ hw.description }}</span>
        </div>

        <!-- 附件 -->
        <div class="desc-section" v-if="hw.attachments && hw.attachments.length">
          <span class="section-label">附件（{{ hw.attachments.length }}）</span>
          <div v-for="(file, idx) in parsedAttachments" :key="idx" class="attachment-item" @tap="openFile(file)">
            <span class="file-icon">📎</span>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
          </div>
        </div>
      </div>

      <div v-if="mySubmission" class="info-card">
        <span class="section-label">我的提交</span>
        <div class="info-row"><span class="label">文件</span><span class="value">{{ mySubmission.file_name }}</span></div>
        <div class="info-row"><span class="label">提交时间</span><span class="value">{{ formatDate(mySubmission.submitted_at) }}</span></div>
        <div class="info-row"><span class="label">状态</span>
          <span class="value">{{ mySubmission.status === 1 ? `已批改 ${mySubmission.score ?? ''}分` : '待批改' }}</span>
        </div>
        <div v-if="mySubmission.feedback" class="desc-section">
          <span class="section-label">老师反馈</span>
          <span class="desc-text">{{ mySubmission.feedback }}</span>
        </div>
      </div>

      <div v-if="isAdminUser && submissions.length" class="info-card">
        <span class="section-label">所有提交（{{ submissions.length }}）</span>
        <div v-for="s in submissions" :key="s.id" class="sub-row">
          <div class="sub-left">
            <span class="sub-name">{{ s.user_name }}</span>
            <span class="sub-meta">{{ s.student_id }} · {{ formatDate(s.submitted_at) }}</span>
          </div>
          <div v-if="s.status === 1" class="score-tag">{{ s.score ?? '-' }}分</div>
          <button v-else class="grade-btn" size="mini" @tap="grade(s)">批改</button>
        </div>
      </div>

      <button class="submit-btn" @click="goSubmit" v-if="!isExpired || mySubmission">{{ mySubmission ? '重新提交' : '提交作业' }}</button>

      <div style="height: 80rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getHomeworkDetail, gradeSubmission, submitHomework } from '@/api/homework'
const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const hwId = ref(null)
const hw = ref(null)
const mySubmission = ref(null)
const submissions = ref([])

const isExpired = computed(() => hw.value && new Date(hw.value.deadline).getTime() < Date.now())
const isUrgent = computed(() => {
  if (!hw.value) return false
  const d = new Date(hw.value.deadline).getTime() - Date.now()
  return d > 0 && d < 86400000 * 2
})

const parsedAttachments = computed(() => {
  if (!hw.value?.attachments) return []
  let list = hw.value.attachments
  if (typeof list === 'string') { try { list = JSON.parse(list) } catch { return [] } }
  return Array.isArray(list) ? list : []
})

function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function fetchDetail() {
  if (!hwId.value) return
  try {
    const res = await getHomeworkDetail(hwId.value)
    hw.value = res.homework
    mySubmission.value = res.mySubmission || null
    submissions.value = res.submissions || []
  } catch (_) {}
}

async function goSubmit() {
  // 简化：选择文件并直接上传到 CloudBase 后提交。
  try {
    const choose = await new Promise((resolve, reject) => {
      uni.chooseMessageFile({
        count: 1,
        type: 'all',
        success: resolve,
        fail: reject
      })
    })
    if (!choose.tempFiles || !choose.tempFiles.length) return
    const file = choose.tempFiles[0]
    uni.showLoading({ title: '上传中...' })
    const { app: cloudbaseApp } = await import('@/utils/cloudbase')
    const cloudPath = `homework/${hwId.value}/${Date.now()}_${file.name}`
    const r = await cloudbaseApp.uploadFile({ cloudPath, filePath: file.path })
    const fileUrl = r?.download_url || r?.fileID || ''
    const res = await submitHomework(hwId.value, { file_url: fileUrl, file_name: file.name })
    
    if (res?.success) {
      showToast('提交成功')
      fetchDetail()
    }
  } catch (e) {
    
    if (e?.errMsg && e.errMsg.includes('cancel')) return
    showToast('提交失败')
  }
}

async function grade(s) {
  uni.showModal({
    title: '批改作业',
    editable: true,
    placeholderText: '请输入分数（0-100）',
    success: async (r) => {
      if (!r.confirm) return
      const score = Number(r.content)
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        showToast('分数无效'); return
      }
      try {
        await gradeSubmission(s.id, { score, feedback: '' })
        showToast('已批改')
        fetchDetail()
      } catch (_) {}
    }
  })
}

onLoad((options) => {
  hwId.value = Number(options?.id) || null
})
onShow(() => { fetchDetail() })

function openFile(file) {
  if (file.url) window.open(file.url, '_blank')
}

function formatSize(bytes) {
  const n = Number(bytes || 0)
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'MB'
  if (n >= 1024) return (n / 1024).toFixed(0) + 'KB'
  return n + 'B'
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.hw-title { font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 20rpx; }

.info-row { display: flex; justify-content: space-between; padding: 14rpx 0; }
.label { font-size: 25rpx; color: #c3c6d1; }
.value { font-size: 25rpx; color: #191c1e; font-weight: 500; &.urgent { color: #b3261e; } }

.desc-section { margin-top: 22rpx; }
.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.desc-text { font-size: 26rpx; color: #191c1e; line-height: 1.6; }

.attachment-item { display: flex; align-items: center; gap: 14rpx; padding: 14rpx 16rpx; background: #f2f4f7; border-radius: 12rpx; margin-bottom: 10rpx; &:active { opacity: 0.75; } }
.file-icon { font-size: 28rpx; }
.file-name { flex: 1; font-size: 24rpx; color: #191c1e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 20rpx; color: #c3c6d1; flex-shrink: 0; }

.sub-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-top: 1rpx solid #f2f4f7; }
.sub-row:first-of-type { border-top: none; }
.sub-name { font-size: 26rpx; color: #191c1e; font-weight: 500; }
.sub-meta { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.score-tag { padding: 6rpx 16rpx; background: rgba(0,30,64,0.08); color: #001e40; border-radius: 999rpx; font-size: 22rpx; }
.grade-btn { background: #001e40; color: #fff; font-size: 22rpx; }

.submit-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
</style>
