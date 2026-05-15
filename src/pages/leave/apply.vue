<template>
  <div class="apply-page">
    <custom-nav-bar title="申请请假" :showBack="true" />

    <div scroll-y class="main-scroll">
      <div class="hero-strip">
        <span class="hero-title">请假申请</span>
        <span class="hero-sub">请选择类型、事由与起止时间，提交后由干部审批</span>
      </div>

      <div class="form-area">
        <div class="section-label">
          <span class="label-text">请假信息</span>
        </div>

        <div class="form-card">
          <picker mode="selector" :range="leaveTypes" @change="onTypeChange" :value="typeIndex">
            <div class="form-row">
              <span class="row-label">请假类型</span>
              <div class="row-value">
                <span :class="['value-text', { placeholder: !formData.type }]">{{ formData.type || '请选择' }}</span>
                <span class="arrow">›</span>
              </div>
            </div>
          </picker>

          <div class="divider" />

          <picker mode="selector" :range="reasonTypes" @change="onReasonChange" :value="reasonIndex">
            <div class="form-row">
              <span class="row-label">请假事由</span>
              <div class="row-value">
                <span :class="['value-text', { placeholder: !formData.reasonType }]">{{ formData.reasonType || '请选择' }}</span>
                <span class="arrow">›</span>
              </div>
            </div>
          </picker>

          <div class="divider" />

          <div class="form-row group-row">
            <span class="row-label">开始时间</span>
          </div>
          <div class="form-sub-row">
            <picker mode="date" :value="formData.startDateOnly" :start="todayStr" @change="onStartDateChange">
              <div class="sub-pill">
                <span :class="['sub-text', { placeholder: !formData.startDateOnly }]">{{ formData.startDateOnly || '选择日期' }}</span>
                <span class="sub-arrow">▾</span>
              </div>
            </picker>
            <picker mode="time" :value="formData.startTime" @change="onStartTimeChange">
              <div class="sub-pill">
                <span :class="['sub-text', { placeholder: !formData.startTime }]">{{ formData.startTime || '选择时间' }}</span>
                <span class="sub-arrow">▾</span>
              </div>
            </picker>
          </div>

          <div class="divider" />

          <div class="form-row group-row">
            <span class="row-label">结束时间</span>
          </div>
          <div class="form-sub-row">
            <picker mode="date" :value="formData.endDateOnly" :start="formData.startDateOnly || todayStr" @change="onEndDateChange">
              <div class="sub-pill">
                <span :class="['sub-text', { placeholder: !formData.endDateOnly }]">{{ formData.endDateOnly || '选择日期' }}</span>
                <span class="sub-arrow">▾</span>
              </div>
            </picker>
            <picker mode="time" :value="formData.endTime" @change="onEndTimeChange">
              <div class="sub-pill">
                <span :class="['sub-text', { placeholder: !formData.endTime }]">{{ formData.endTime || '选择时间' }}</span>
                <span class="sub-arrow">▾</span>
              </div>
            </picker>
          </div>

          <div class="divider" />

          <div class="textarea-wrap">
            <span class="row-label block">详细说明</span>
            <textarea class="ghost-textarea" v-model="formData.detail" placeholder="请输入详细说明（选填）" />
          </div>
        </div>
      </div>

      <div class="bottom-action">
        <button class="primary-btn" @click="onSubmit">
          <span class="btn-text">提交申请</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { applyLeave } from '@/api/leave'
import { parseLeaveDateTimeMs } from '@/utils/index'
const leaveTypes = ['早操', '早集合', '午集合', '晚自习', '其他']
const reasonTypes = ['事假', '病假', '上课', '公假', '其他']

const typeIndex = ref(0)
const reasonIndex = ref(0)

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

const now = new Date()
const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const formData = reactive({
  type: '',
  reasonType: '',
  startDateOnly: '',
  startTime: '',
  endDateOnly: '',
  endTime: '',
  detail: ''
})

const formData_startDate = computed(() =>
  formData.startDateOnly && formData.startTime ? `${formData.startDateOnly} ${formData.startTime}` : ''
)
const formData_endDate = computed(() =>
  formData.endDateOnly && formData.endTime ? `${formData.endDateOnly} ${formData.endTime}` : ''
)

function onTypeChange(e) {
  formData.type = leaveTypes[e.detail.value]
}

function onReasonChange(e) {
  formData.reasonType = reasonTypes[e.detail.value]
}

function onStartDateChange(e) {
  formData.startDateOnly = e.detail.value
}

function onStartTimeChange(e) {
  formData.startTime = e.detail.value
}

function onEndDateChange(e) {
  formData.endDateOnly = e.detail.value
}

function onEndTimeChange(e) {
  formData.endTime = e.detail.value
}

async function onSubmit() {
  if (!formData.type) {
    showToast('请选择请假类型')
    return
  }
  if (!formData.reasonType) {
    showToast('请选择请假事由')
    return
  }
  if (!formData_startDate.value) {
    showToast('请选择开始时间')
    return
  }
  if (!formData_endDate.value) {
    showToast('请选择结束时间')
    return
  }

  const t0 = parseLeaveDateTimeMs(formData_startDate.value)
  const t1 = parseLeaveDateTimeMs(formData_endDate.value)
  if (Number.isNaN(t0) || Number.isNaN(t1)) {
    showToast('时间格式无效')
    return
  }
  if (t1 < t0) {
    showToast('结束时间不能早于开始时间')
    return
  }

  uni.showLoading({ title: '提交中...' })
  try {
    const res = await applyLeave({
      type: formData.type,
      reason: formData.reasonType + (formData.detail ? ` - ${formData.detail}` : ''),
      start_time: formData_startDate.value,
      end_time: formData_endDate.value
    })
    
    if (res.success) {
      showToast('申请已提交')
      setTimeout(() => {
        router.back()
      }, 1500)
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (error) {
    
    showToast('网络错误，请重试')
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.apply-page {
  min-height: 100vh;
  background: $surface;
}

.hero-strip {
  margin: 24rpx 32rpx 8rpx;
  padding: 28rpx 28rpx 24rpx;
  background: $gradient-primary;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 40rpx rgba(0, 30, 64, 0.22);
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: $on-primary;
  letter-spacing: 2rpx;
}

.hero-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.45;
}

.main-scroll {
  height: 100vh;
  padding-top: calc(env(safe-area-inset-top) + 88rpx);
  padding-bottom: 140rpx;
}

.form-area {
  padding: 16rpx 32rpx 32rpx;
}

.section-label {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.label-text {
  font-size: 22rpx;
  font-weight: 600;
  color: $on-surface-variant;
  letter-spacing: 4rpx;
  text-transform: uppercase;
}

.form-card {
  background: $surface-container-lowest;
  border-radius: 22rpx;
  overflow: hidden;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;

  &:active {
    background: #fafbfc;
  }
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

.row-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
  max-width: 62%;
}

.value-text {
  font-size: 26rpx;
  color: $on-surface;
  text-align: right;

  &.placeholder {
    color: $outline-variant;
  }
}

.arrow {
  font-size: 36rpx;
  color: $outline-variant;
  flex-shrink: 0;
}

.divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

.group-row {
  padding-bottom: 8rpx;
}

.form-sub-row {
  display: flex;
  gap: 16rpx;
  padding: 0 24rpx 24rpx;
}

.sub-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  padding: 18rpx 22rpx;
  background: $surface;
  border-radius: 14rpx;

  &:active {
    background: #eef1f6;
  }
}

.sub-text {
  font-size: 26rpx;
  color: $on-surface;

  &.placeholder {
    color: $outline-variant;
  }
}

.sub-arrow {
  font-size: 22rpx;
  color: $primary;
  flex-shrink: 0;
}

.textarea-wrap {
  padding: 28rpx 24rpx;
}

.ghost-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: $on-surface;
  border: none;
  background: $surface;
  border-radius: 12rpx;
  padding: 18rpx;
  box-sizing: border-box;

  &::placeholder {
    color: $outline-variant;
  }
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
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
  box-shadow: 0 10rpx 36rpx rgba(0, 30, 64, 0.28);

  &:active {
    transform: scale(0.98);
  }
}

.btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: $on-primary;
}
</style>
