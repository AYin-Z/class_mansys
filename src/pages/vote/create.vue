<template>
  <div class="create-page">
    <custom-nav-bar title="创建投票" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div class="form-area">
        <div class="form-card">
          <div class="form-row"><span class="row-label block">投票标题</span><input class="solid-input" placeholder="请输入标题" v-model="form.title" /></div>
          <div class="divider"></div>
          <div class="textarea-wrap"><span class="row-label block">投票描述</span><textarea class="solid-textarea small" v-model="form.desc" placeholder="简要说明（选填）" /></div>
          <div class="divider"></div>
          <picker mode="selector" :range="['单选', '多选']" @change="(e) => form.type = e.detail.value === 0 ? 'single' : 'multiple'">
            <div class="form-row"><span class="row-label">投票类型</span><div class="row-value"><span class="value-text">{{ form.type === 'single' ? '单选' : '多选' }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>

          <picker mode="date" :value="form.startDate" @change="(e) => form.startDate = e.detail.value">
            <div class="form-row"><span class="row-label">开始日期</span><div class="row-value"><span class="value-text">{{ form.startDate }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>
          <picker mode="time" :value="form.startTime" @change="(e) => form.startTime = e.detail.value">
            <div class="form-row"><span class="row-label">开始时间</span><div class="row-value"><span class="value-text">{{ form.startTime }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>
          <picker mode="date" :value="form.endDate" @change="(e) => form.endDate = e.detail.value">
            <div class="form-row"><span class="row-label">结束日期</span><div class="row-value"><span class="value-text">{{ form.endDate }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>
          <picker mode="time" :value="form.endTime" @change="(e) => form.endTime = e.detail.value">
            <div class="form-row"><span class="row-label">结束时间</span><div class="row-value"><span class="value-text">{{ form.endTime }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>

          <!-- 可见范围 -->
          <picker mode="selector" :range="['全部可见', '仅班干部']" @change="(e) => form.visible_scope = e.detail.value === 0 ? 'all' : 'admin'">
            <div class="form-row"><span class="row-label">可见范围</span><div class="row-value"><span class="value-text">{{ form.visible_scope === 'all' ? '全部可见' : '仅班干部' }}</span><span class="arrow">›</span></div></div>
          </picker>
          <div class="divider"></div>

          <!-- 可投范围 -->
          <picker mode="selector" :range="['全部可投', '仅班干部']" @change="(e) => form.vote_scope = e.detail.value === 0 ? 'all' : 'admin'">
            <div class="form-row"><span class="row-label">可投范围</span><div class="row-value"><span class="value-text">{{ form.vote_scope === 'all' ? '全部可投' : '仅班干部' }}</span><span class="arrow">›</span></div></div>
          </picker>

          <!-- Options -->
          <div class="options-area">
            <span class="section-sub">选项列表</span>
            <div v-for="(opt, idx) in options" :key="idx" class="option-row">
              <input class="opt-input" :placeholder="'选项' + (idx + 1)" v-model="options[idx]" />
              <span class="remove-opt" @tap="removeOption(idx)" v-if="options.length > 2">×</span>
            </div>
            <button class="add-option-btn" @click="addOption"><span class="add-opt-text">+ 添加选项</span></button>
          </div>
        </div>
      </div>
      <div class="bottom-action"><button class="primary-btn" @click="submit"><span class="btn-text">发布投票</span></button></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { createVote } from '@/api/vote'
function pad(n) { return String(n).padStart(2, '0') }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const form = reactive({
  title: '',
  desc: '',
  type: 'single',
  startDate: todayStr(),
  startTime: '09:00',
  endDate: tomorrowStr(),
  endTime: '23:59',
  visible_scope: 'all',
  vote_scope: 'all'
})
const options = reactive(['', ''])

function addOption() { if (options.length < 8) options.push('') }
function removeOption(idx) { if (options.length > 2) options.splice(idx, 1) }

function buildDateTime(date, time) {
  return `${date} ${time}:00`
}

async function submit() {
  if (!form.title.trim()) { showToast('请输入标题'); return }
  const validOpts = options.filter(o => o.trim())
  if (validOpts.length < 2) { showToast('至少需要 2 个选项'); return }
  const start = buildDateTime(form.startDate, form.startTime)
  const end = buildDateTime(form.endDate, form.endTime)
  if (new Date(end) <= new Date(start)) {
    showToast('结束时间需晚于开始时间')
    return
  }
  uni.showLoading({ title: '发布中...' })
  try {
    await createVote({
      title: form.title.trim(),
      description: form.desc.trim(),
      type: form.type,
      start_time: start,
      end_time: end,
      visible_scope: form.visible_scope,
      vote_scope: form.vote_scope,
      options: validOpts
    })
    
    showToast('发布成功')
    setTimeout(() => router.back(), 800)
  } catch (e) {
    
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.create-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); padding-bottom: 140rpx; }

.form-area { padding: 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 24px; &:active { background: #fafbfc; } }
.row-label { font-size: 28rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 16rpx; } }
.row-value { display: flex; align-items: center; gap: 8rpx; }
.value-text { font-size: 28rpx; color: #191c1e; }
.arrow { font-size: 36rpx; color: #c3c6d1; }
.divider { height: 1rpx; margin-left: 24rpx; margin-right: 24rpx; background: transparent; }
.solid-input { width: 100%; height: 60rpx; font-size: 30rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; &::placeholder { color: #c3c6d1; } }
.textarea-wrap { padding: 28rpx 24rpx; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 20rpx; border: none; box-sizing: border-box; &.small { min-height: 100rpx; } &::placeholder { color: #c3c6d1; } }

.options-area { padding: 24rpx; background: #fafbfc; margin-top: 12rpx; border-radius: 14rpx; }
.section-sub { font-size: 24rpx; font-weight: 600; color: #43474f; display: block; margin-bottom: 16rpx; }
.option-row { display: flex; align-items: center; gap: 10rpx; margin-bottom: 12rpx; }
.opt-input { flex: 1; height: 64rpx; font-size: 27rpx; background: #fff; border-radius: 12rpx; padding: 0 18rpx; border: none; &::placeholder { color: #c3c6d1; } }
.remove-opt { width: 48rpx; height: 48rpx; text-align: center; line-height: 48rpx; font-size: 32rpx; color: #460002; }
.add-option-btn { background: transparent; border: 2rpx dashed rgba(195,198,209,0.5); border-radius: 14rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; &::after { display: none; } &:active { background: rgba(195,198,209,0.15); } }
.add-opt-text { font-size: 26rpx; color: #43474f; }

.bottom-action { position: fixed; bottom: 0; left: 0; right: 0; padding: 24rpx 32rpx; padding-bottom: calc(24rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.85); backdrop-filter: blur(40rpx); z-index: 100; }
.primary-btn { width: 100%; height: 96rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 20rpx; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(0,30,64,0.25); &:active { transform: scale(0.98); } }
.btn-text { font-family: 'PingFang SC'; font-size: 32rpx; font-weight: 700; color: #fff; }
</style>
