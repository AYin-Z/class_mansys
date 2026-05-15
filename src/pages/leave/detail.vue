<template>
  <div class="detail-page">
    <custom-nav-bar title="请假详情" :showBack="true" />

    <div v-if="leave" scroll-y class="main-scroll">
      <div class="hero-strip">
        <span class="hero-type">{{ leaveTypeLabel }}</span>
        <div :class="['hero-badge', statusClass]">{{ statusLabel }}</div>
      </div>

      <div class="block card">
        <span class="block-title">时间与事由</span>
        <div class="row">
          <span class="k">开始</span>
          <span class="v">{{ formatLeaveDateTime(leave.start_time) }}</span>
        </div>
        <div class="row">
          <span class="k">结束</span>
          <span class="v">{{ formatLeaveDateTime(leave.end_time) }}</span>
        </div>
        <div class="row block-reason">
          <span class="k">事由</span>
          <span class="v reason">{{ leave.reason || '—' }}</span>
        </div>
      </div>

      <div class="block card" v-if="leave.approval_time || leave.approval_notes">
        <span class="block-title">审批信息</span>
        <div class="row" v-if="leave.approver_name">
          <span class="k">审批人</span>
          <span class="v">{{ leave.approver_name }}</span>
        </div>
        <div class="row" v-if="leave.approval_time">
          <span class="k">时间</span>
          <span class="v">{{ formatLeaveDateTime(leave.approval_time) }}</span>
        </div>
        <div class="row block-reason" v-if="leave.approval_notes">
          <span class="k">意见</span>
          <span class="v reason">{{ leave.approval_notes }}</span>
        </div>
      </div>

      <div class="block card muted">
        <span class="hint">申请编号 {{ leave.id }} · 提交于 {{ formatLeaveDateTime(leave.created_at) }}</span>
      </div>

      <div class="page-spacer"></div>
    </div>

    <div v-else class="loading-wrap">
      <span class="loading-text">{{ loadError || '加载中…' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getLeaveById } from '@/api/leave'
import { formatLeaveDateTime } from '@/utils/index'
const leave = ref(null)
const loadError = ref('')

const leaveTypeLabel = computed(() => {
  const l = leave.value
  if (!l) return ''
  return l.leave_type || l.type || '—'
})

function isCancelled() {
  const l = leave.value
  if (!l) return false
  return l.is_cancelled === 1 || l.is_cancelled === true
}

const statusClass = computed(() => {
  const l = leave.value
  if (!l) return ''
  if (isCancelled()) return 'cancelled'
  if (l.status === 0) return 'pending'
  if (l.status === 1) return 'approved'
  return 'rejected'
})

const statusLabel = computed(() => {
  const l = leave.value
  if (!l) return ''
  if (isCancelled()) return '已销假'
  if (l.status === 0) return '待审批'
  if (l.status === 1) return '已通过'
  return '已驳回'
})

onLoad(async (options) => {
  const id = parseInt(options.id || '', 10)
  if (Number.isNaN(id)) {
    loadError.value = '无效的申请'
    return
  }
  try {
    const res = await getLeaveById(id)
    if (res.success && res.leave) {
      leave.value = res.leave
    } else {
      loadError.value = '记录不存在'
    }
  } catch (e) {
    loadError.value = '加载失败'
  }
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.detail-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #e8eef5 0%, #f4f6f9 100%);
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-left: 32rpx;
  padding-right: 32rpx;
}

.hero-strip {
  margin-bottom: 24rpx;
  padding: 32rpx 28rpx;
  background: linear-gradient(135deg, #102a43 0%, #1e4d7b 100%);
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  box-shadow: 0 12rpx 40rpx rgba(16, 42, 67, 0.2);
}

.hero-type {
  flex: 1;
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
}

.hero-badge {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;

  &.pending {
    background: rgba(255, 200, 80, 0.25);
  }
  &.approved {
    background: rgba(120, 220, 180, 0.25);
  }
  &.rejected {
    background: rgba(255, 140, 140, 0.25);
  }
  &.cancelled {
    background: rgba(220, 220, 230, 0.3);
  }
}

.block {
  margin-bottom: 20rpx;
}

.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 8rpx 28rpx rgba(16, 42, 67, 0.06);
}

.block-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #5c6570;
  margin-bottom: 20rpx;
  letter-spacing: 2rpx;
}

.row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 16rpx;
  align-items: flex-start;

  &:last-child {
    margin-bottom: 0;
  }
}

.k {
  width: 100rpx;
  flex-shrink: 0;
  font-size: 24rpx;
  color: #8b95a1;
}

.v {
  flex: 1;
  font-size: 28rpx;
  color: #1a2332;
  line-height: 1.45;
}

.reason {
  white-space: pre-wrap;
}

.block-reason {
  flex-direction: column;
  gap: 8rpx;

  .k {
    width: auto;
  }
}

.muted {
  background: rgba(255, 255, 255, 0.65);
}

.hint {
  font-size: 22rpx;
  color: #8b95a1;
  line-height: 1.5;
}

.loading-wrap {
  padding-top: 200rpx;
  text-align: center;
}

.loading-text {
  font-size: 28rpx;
  color: #8b95a1;
}

.page-spacer {
  height: 48rpx;
}
</style>
