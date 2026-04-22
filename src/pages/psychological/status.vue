<template>
  <view class="status-page">
    <custom-nav-bar title="处理状态" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view v-if="application" class="info-card">
        <text class="title">{{ extractType(application.content) }}</text>
        <text class="desc">{{ extractDetail(application.content) }}</text>
        <view class="meta-row"><text class="label">提交时间</text><text class="value">{{ formatDate(application.created_at) }}</text></view>
        <view class="meta-row"><text class="label">处理状态</text><text :class="['value', statusClass(application.status)]">{{ PSYCH_STATUS_LABEL[application.status] }}</text></view>
        <view v-if="application.handler_name" class="meta-row"><text class="label">处理人</text><text class="value">{{ application.handler_name }}</text></view>
        <view v-if="application.handler_notes" class="desc-section">
          <text class="section-label">处理备注</text>
          <text class="desc-text">{{ application.handler_notes }}</text>
        </view>
      </view>

      <view v-if="isAdminUser && application" class="info-card">
        <text class="section-label">管理员操作</text>
        <view class="btn-row">
          <button v-if="application.status !== 1" class="action-btn" @tap="handleStatus(1)">标记处理中</button>
          <button v-if="application.status !== 2" class="action-btn primary" @tap="handleStatus(2)">标记已完成</button>
        </view>
      </view>

      <view style="height: 40rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getPsychDetail, handlePsychApplication, PSYCH_STATUS_LABEL } from '@/api/psychological'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const id = ref(null)
const application = ref(null)

function extractType(c) {
  if (!c) return '心理干预申请'
  const m = String(c).match(/^\[(.+?)\]/)
  return m ? m[1] : '心理干预申请'
}
function extractDetail(c) {
  if (!c) return ''
  return String(c).replace(/^\[.+?\]\s*/, '')
}
function formatDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function statusClass(s) {
  if (s === 0) return 'pending'
  if (s === 1) return 'processing'
  return 'completed'
}

async function fetch() {
  if (!id.value) return
  try {
    const res = await getPsychDetail(id.value)
    application.value = res.application
  } catch (_) {}
}

async function handleStatus(status) {
  uni.showModal({
    title: '处理',
    editable: true,
    placeholderText: '请输入处理备注（可选）',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await handlePsychApplication(id.value, { status, handler_notes: r.content || '' })
        uni.showToast({ title: '已更新', icon: 'success' })
        fetch()
      } catch (_) {}
    }
  })
}

onLoad((opts) => { id.value = Number(opts?.id) || null })
onShow(() => fetch())
</script>

<style lang="scss" scoped>
.status-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.title { font-size: 32rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 12rpx; }
.desc { font-size: 26rpx; color: #43474f; line-height: 1.6; display: block; margin-bottom: 18rpx; }

.meta-row { display: flex; justify-content: space-between; padding: 12rpx 0; }
.label { font-size: 24rpx; color: #c3c6d1; }
.value { font-size: 24rpx; color: #191c1e; font-weight: 500;
  &.pending { color: #43474f; }
  &.processing { color: #466270; }
  &.completed { color: #001e40; }
}

.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.desc-section { margin-top: 18rpx; }
.desc-text { font-size: 26rpx; color: #191c1e; line-height: 1.6; }

.btn-row { display: flex; gap: 16rpx; }
.action-btn { flex: 1; height: 80rpx; line-height: 80rpx; background: #f2f4f7; color: #001e40; font-size: 26rpx; border-radius: 14rpx; border: none; }
.action-btn.primary { background: #001e40; color: #fff; }
</style>
