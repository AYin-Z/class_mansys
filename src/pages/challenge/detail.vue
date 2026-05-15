<template>
  <div class="detail-page">
    <custom-nav-bar title="擂台详情" :showBack="true" />
    <div scroll-y class="main-scroll">
      <div v-if="challenge" class="info-card">
        <div :class="['type-badge', typeKey(challenge.type)]">{{ challenge.type }}</div>
        <span class="detail-title">{{ challenge.name }}</span>
        <span class="detail-desc">{{ challenge.description }}</span>
        <div class="info-row">
          <span class="info-label">当前擂主</span>
          <span class="info-value">{{ challenge.champion_name || '虚位以待' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">挑战记录</span>
          <span class="info-value">{{ records.length }} 次</span>
        </div>
      </div>

      <button class="join-btn" v-if="canApply" @click="applyChallengeNow">申请挑战</button>

      <div v-if="records.length" class="info-card">
        <span class="section-label">挑战记录</span>
        <div v-for="r in records" :key="r.id" class="record-row">
          <span class="record-main">{{ r.challenger_name }} 挑战 {{ r.champion_name }}</span>
          <span :class="['record-result', r.result === '挑战成功' || r.result === 'win' ? 'win' : 'lose']">{{ r.result }}</span>
        </div>
      </div>

      <div v-if="isAdminUser && applications.length" class="info-card">
        <span class="section-label">挑战申请</span>
        <div v-for="a in applications" :key="a.id" class="record-row">
          <div style="flex:1">
            <span class="record-main">{{ a.user_name }}（{{ a.student_id }}）</span>
            <span class="sub-meta">{{ statusLabel(a.status) }}</span>
          </div>
          <div v-if="a.status === 0" class="btn-row">
            <button size="mini" class="reject" @tap.stop="approve(a, 2)">拒绝</button>
            <button size="mini" class="accept" @tap.stop="approve(a, 1)">通过</button>
          </div>
        </div>
      </div>

      <div v-if="isAdminUser" class="info-card">
        <span class="section-label">登记挑战结果</span>
        <input class="solid-input" placeholder="挑战者学号" v-model="recForm.challengerSid" />
        <input class="solid-input" placeholder="擂主学号（默认当前擂主）" v-model="recForm.championSid" style="margin-top:12rpx;" />
        <picker mode="selector" :range="['挑战成功', '挑战失败']" @change="onResultChange">
          <div class="solid-input" style="margin-top:12rpx;">{{ recForm.result || '请选择结果' }}</div>
        </picker>
        <textarea class="solid-textarea" placeholder="备注（可选）" v-model="recForm.notes"></textarea>
        <button class="primary-btn" @tap="submitRecord">提交</button>
      </div>

      <div style="height: 80rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onActivated, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { getChallengeDetail, applyChallenge, approveChallengeApplication, recordChallenge, CHALLENGE_APP_STATUS_LABEL } from '@/api/challenge'
import { post } from '@/utils/request'
const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const id = ref(null)
const challenge = ref(null)
const records = ref([])
const applications = ref([])
const canApply = computed(() => !!profile.value?.id)

const recForm = reactive({ challengerSid: '', championSid: '', result: '', notes: '' })

function typeKey(t) {
  if (t === '学习') return 'study'
  if (t === '体能') return 'fitness'
  return 'discipline'
}

function statusLabel(s) { return CHALLENGE_APP_STATUS_LABEL[s] }

function onResultChange(e) { recForm.result = ['挑战成功', '挑战失败'][e.detail.value] }

async function fetch() {
  if (!id.value) return
  try {
    const res = await getChallengeDetail(id.value)
    challenge.value = res.challenge
    records.value = res.records || []
    applications.value = res.applications || []
  } catch (_) {}
}

async function applyChallengeNow() {
  try {
    await applyChallenge(id.value)
    showToast('申请已提交')
    fetch()
  } catch (_) {}
}

async function approve(a, status) {
  try {
    await approveChallengeApplication(a.id, status)
    showToast('已处理')
    fetch()
  } catch (_) {}
}

async function findUserBySid(sid) {
  try {
    const res = await post('/api/auth/find-by-student', { student_id: sid }, { silent: true })
    return res?.user?.id
  } catch (_) { return null }
}

async function submitRecord() {
  if (!recForm.challengerSid || !recForm.result) {
    showToast('请填写挑战者学号和结果'); return
  }
  uni.showLoading({ title: '提交中...' })
  const challengerId = await findUserBySid(recForm.challengerSid)
  const championSid = recForm.championSid || ''
  let championId = challenge.value?.current_champion_id
  if (championSid) championId = await findUserBySid(championSid)
  
  if (!challengerId) { showToast('挑战者学号未找到'); return }
  if (!championId) { showToast('擂主未确定，请填写擂主学号'); return }
  try {
    await recordChallenge(id.value, {
      challenger_id: challengerId,
      champion_id: championId,
      result: recForm.result,
      notes: recForm.notes
    })
    showToast('已登记')
    recForm.challengerSid = ''; recForm.championSid = ''; recForm.result = ''; recForm.notes = ''
    fetch()
  } catch (_) {}
}

onLoad((opts) => { id.value = Number(opts?.id) || null })
onShow(() => fetch())

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.detail-page { min-height: 100vh; background-color: $surface; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.type-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.study { background: rgba(0,30,64,0.06); color: $primary; }
  &.discipline { background: rgba(70,98,112,0.08); color: $secondary; }
  &.fitness { background: rgba(179,38,30,0.05); color: #b3261e; }
}
.detail-title { font-size: 34rpx; font-weight: 700; color: $on-surface; display: block; margin-top: 16rpx; margin-bottom: 12rpx; }
.detail-desc { font-size: 26rpx; color: $on-surface-variant; line-height: 1.5; display: block; margin-bottom: 20rpx; }

.info-row { display: flex; justify-content: space-between; padding: 14rpx 0; }
.info-label { font-size: 25rpx; color: $outline-variant; }
.info-value { font-size: 25rpx; color: $on-surface; font-weight: 500; }

.section-label { font-size: 25rpx; font-weight: 600; color: $on-surface-variant; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.record-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-top: 1rpx solid $surface-container-low; }
.record-row:first-of-type { border-top: none; }
.record-main { font-size: 26rpx; color: $on-surface; }
.sub-meta { font-size: 22rpx; color: $outline-variant; display: block; margin-top: 4rpx; }
.record-result { font-size: 24rpx; font-weight: 700;
  &.win { color: $primary; }
  &.lose { color: #b3261e; }
}

.btn-row { display: flex; gap: 8rpx; }
.btn-row .accept { background: $primary; color: $on-primary; font-size: 22rpx; }
.btn-row .reject { background: $surface-container-low; color: $on-surface-variant; font-size: 22rpx; }

.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 28rpx; color: $on-surface; background: $surface; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 26rpx; color: $on-surface; background: $surface; border-radius: 12rpx; padding: 16rpx; border: none; box-sizing: border-box; margin-top: 12rpx; }
.primary-btn { margin-top: 16rpx; height: 80rpx; background: $primary; color: $on-primary; border-radius: 14rpx; font-size: 26rpx; }

.join-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, $primary, $primary-container); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: $on-primary; &::after { display: none; } }
</style>
