<script setup lang="ts">
import { mediaUrl, thumbUrl, onThumbError } from '@/utils/media'
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getLeaveById, cancelLeave } from '@/api/leave'
import type { LeaveItem } from '@/api/leave'
import NavBar from '@/components/ui/NavBar.vue'
import StateView from '@/components/ui/StateView.vue'
import ImageViewer from '@/components/ui/ImageViewer.vue'
import type { ViewerImage } from '@/components/ui/ImageViewer.vue'
import { showConfirm, showToast } from '@/utils/ui'
import { toastIfNotNotified } from '@/utils/request'

const route = useRoute()
const leave = ref<LeaveItem | null>(null)
const loading = ref(true)
const error = ref<unknown>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const id = Number(route.query.id)
    if (!id) { error.value = new Error('缺少记录编号，请从列表重新进入'); return }
    const res = await getLeaveById(id)
    if (res.success) leave.value = res.leave
    else error.value = new Error('请假记录加载失败')
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function handleCancel() {
  if (!leave.value) return
  const ok = await showConfirm('销假', '确认销假这次请假？', {
    confirmText: '确认销假',
    danger: true,
    hint: '销假后本次请假立即失效，如需再休要重新申请',
  })
  if (!ok) return
  try {
    const res = await cancelLeave(leave.value.id)
    if (res.success) {
      showToast('已销假')
      leave.value.is_cancelled = true
    } else {
      showToast(res.message || '销假失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '销假失败，请稍后重试')
  }
}

// 解析方式沿用原实现，仅补返回类型，好让模板里的下标是 number（alt 拼接用）
const attachments = computed<string[]>(() => {
  try {
    const raw = (leave.value as any)?.attachments
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') return JSON.parse(raw)
  } catch {}
  return []
})

/**
 * 证明材料查看器：统一走公共组件 ImageViewer
 * （中图分级加载 + 失败回退原图、左右滑动、键盘、滚动锁都在组件内）
 */
const viewerIndex = ref<number | null>(null)
const viewerOpen = computed({
  get: () => viewerIndex.value !== null,
  set: (open: boolean) => {
    if (!open) viewerIndex.value = null
  },
})
const viewerStart = computed(() => viewerIndex.value ?? 0)
const viewerImages = computed<ViewerImage[]>(() =>
  attachments.value.map((url) => ({ url, title: '证明材料' })),
)

function openViewer(index: number) {
  viewerIndex.value = index
}

const statusLabel = (s: number) => ['待审批', '已通过', '已驳回'][s] || '未知'
const statusClass = (s: number) => ['pending', 'approved', 'rejected'][s] || ''
</script>
<template>
  <div class="detail-page">
    <NavBar title="请假详情" show-back />

    <StateView
      :loading="loading"
      :error="error"
      :empty="!leave"
      empty-title="记录不存在"
      empty-description="该请假记录可能已被删除，或链接已失效"
      @retry="load"
    >
    <div v-if="leave" class="content">
      <div class="status-bar">
        <span :class="['big-badge', statusClass(leave!.status)]">
          {{ leave!.is_cancelled ? '已销假' : statusLabel(leave!.status) }}
        </span>
      </div>

      <div class="info-card">
        <div class="info-row"><span class="label">请假类型</span><span class="value">{{ leave!.leave_type }}</span></div>
        <div class="info-row"><span class="label">开始时间</span><span class="value">{{ leave!.start_time?.slice(0, 16) }}</span></div>
        <div class="info-row"><span class="label">结束时间</span><span class="value">{{ leave!.end_time?.slice(0, 16) }}</span></div>
        <div class="info-row"><span class="label">提交时间</span><span class="value">{{ leave!.created_at?.slice(0, 16) }}</span></div>
      </div>

      <div class="section">
        <h3>请假原因</h3>
        <p class="reason-text">{{ leave!.reason }}</p>
      </div>

      <div v-if="attachments.length > 0" class="section">
        <h3>证明材料</h3>
        <div class="attach-grid">
          <!-- 附件小图只拉 480px 缩略图；派生图缺失时 onThumbError 回退原图 -->
          <img
            v-for="(url, i) in attachments"
            :key="i"
            :src="mediaUrl(thumbUrl(url))"
            class="attach-img"
            :alt="`证明材料 ${i + 1}`"
            loading="lazy"
            decoding="async"
            @error="onThumbError($event, url)"
            @click="openViewer(i)"
          />
        </div>
      </div>

      <div v-if="leave!.approval_notes" class="section">
        <h3>审批意见</h3>
        <p class="reason-text">{{ leave!.approval_notes }}</p>
      </div>

      <button v-if="leave!.status === 0 && !leave!.is_cancelled"
        class="cancel-btn" @click="handleCancel">销假</button>

      <!-- 全屏查看器：公共组件（中图预览 + 滑动切换 + 保存原图） -->
      <ImageViewer v-model="viewerOpen" :images="viewerImages" :start-index="viewerStart" />
    </div>
    </StateView>
  </div>
</template>
<style scoped>
.detail-page { padding-bottom: var(--spacing-lg); }
.loading-state, .empty-state { text-align: center; padding: 48px 16px; font-size: 14px; color: var(--color-text-3); }
.content { padding: 20px 16px; }
.status-bar { text-align: center; margin-bottom: 20px; }
.big-badge {
  display: inline-block; font-size: 14px; font-weight: 700; padding: 8px 24px;
  border-radius: var(--radius-md);
}
.big-badge.pending { background: var(--color-warning-bg); color: var(--color-warning); }
.big-badge.approved { background: var(--color-success-bg); color: var(--color-success); }
.big-badge.rejected { background: var(--color-error-bg); color: var(--color-error); }
.info-card {
  background: var(--color-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-card); padding: 16px; margin-bottom: 16px;
}
.info-row { display: flex; padding: 8px 0; font-size: 14px; }
.info-row + .info-row { border-top: 1px solid var(--color-border); }
.label { color: var(--color-text-3); width: 80px; flex-shrink: 0; }
.value { color: var(--color-text); flex: 1; }
.section { margin-bottom: 20px; }
.section h3 { font-size: 15px; font-weight: 600; color: var(--color-text); margin-bottom: 8px; }
.reason-text { font-size: 14px; line-height: 1.7; color: var(--color-text-2); }
.cancel-btn {
  width: 100%; height: 44px; border: 1.5px solid var(--color-error);
  color: var(--color-error); background: none; border-radius: var(--radius-md);
  font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px;
}

.attach-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.attach-img { width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); cursor: pointer; }
</style>
