<template>
  <view class="detail-page">
    <custom-nav-bar title="擂台详情" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <view v-if="challenge" class="info-card">
        <view :class="['type-badge', typeKey(challenge.type)]">{{ challenge.type }}</view>
        <text class="detail-title">{{ challenge.name }}</text>
        <text class="detail-desc">{{ challenge.description }}</text>
        <view class="info-row">
          <text class="info-label">当前擂主</text>
          <text class="info-value">{{ challenge.champion_name || '虚位以待' }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">挑战记录</text>
          <text class="info-value">{{ records.length }} 次</text>
        </view>
      </view>

      <button class="join-btn" v-if="canApply" @click="applyChallengeNow">申请挑战</button>

      <view v-if="records.length" class="info-card">
        <text class="section-label">挑战记录</text>
        <view v-for="r in records" :key="r.id" class="record-row">
          <text class="record-main">{{ r.challenger_name }} 挑战 {{ r.champion_name }}</text>
          <text :class="['record-result', r.result === '挑战成功' || r.result === 'win' ? 'win' : 'lose']">{{ r.result }}</text>
        </view>
      </view>

      <view v-if="isAdminUser && applications.length" class="info-card">
        <text class="section-label">挑战申请</text>
        <view v-for="a in applications" :key="a.id" class="record-row">
          <view style="flex:1">
            <text class="record-main">{{ a.user_name }}（{{ a.student_id }}）</text>
            <text class="sub-meta">{{ statusLabel(a.status) }}</text>
          </view>
          <view v-if="a.status === 0" class="btn-row">
            <button size="mini" class="reject" @tap.stop="approve(a, 2)">拒绝</button>
            <button size="mini" class="accept" @tap.stop="approve(a, 1)">通过</button>
          </view>
        </view>
      </view>

      <view v-if="isAdminUser" class="info-card">
        <text class="section-label">登记挑战结果</text>
        <input class="solid-input" placeholder="挑战者学号" v-model="recForm.challengerSid" />
        <input class="solid-input" placeholder="擂主学号（默认当前擂主）" v-model="recForm.championSid" style="margin-top:12rpx;" />
        <picker mode="selector" :range="['挑战成功', '挑战失败']" @change="onResultChange">
          <view class="solid-input" style="margin-top:12rpx;">{{ recForm.result || '请选择结果' }}</view>
        </picker>
        <textarea class="solid-textarea" placeholder="备注（可选）" v-model="recForm.notes"></textarea>
        <button class="primary-btn" @tap="submitRecord">提交</button>
      </view>

      <view style="height: 80rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
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
    uni.showToast({ title: '申请已提交', icon: 'success' })
    fetch()
  } catch (_) {}
}

async function approve(a, status) {
  try {
    await approveChallengeApplication(a.id, status)
    uni.showToast({ title: '已处理', icon: 'success' })
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
    uni.showToast({ title: '请填写挑战者学号和结果', icon: 'none' }); return
  }
  uni.showLoading({ title: '提交中...' })
  const challengerId = await findUserBySid(recForm.challengerSid)
  const championSid = recForm.championSid || ''
  let championId = challenge.value?.current_champion_id
  if (championSid) championId = await findUserBySid(championSid)
  uni.hideLoading()
  if (!challengerId) { uni.showToast({ title: '挑战者学号未找到', icon: 'none' }); return }
  if (!championId) { uni.showToast({ title: '擂主未确定，请填写擂主学号', icon: 'none' }); return }
  try {
    await recordChallenge(id.value, {
      challenger_id: challengerId,
      champion_id: championId,
      result: recForm.result,
      notes: recForm.notes
    })
    uni.showToast({ title: '已登记', icon: 'success' })
    recForm.challengerSid = ''; recForm.championSid = ''; recForm.result = ''; recForm.notes = ''
    fetch()
  } catch (_) {}
}

onLoad((opts) => { id.value = Number(opts?.id) || null })
onShow(() => fetch())
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.info-card { margin: 24rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 28rpx 24rpx; }
.type-badge {
  display: inline-block; padding: 6rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600;
  &.study { background: rgba(0,30,64,0.06); color: #001e40; }
  &.discipline { background: rgba(70,98,112,0.08); color: #466270; }
  &.fitness { background: rgba(179,38,30,0.05); color: #b3261e; }
}
.detail-title { font-size: 34rpx; font-weight: 700; color: #191c1e; display: block; margin-top: 16rpx; margin-bottom: 12rpx; }
.detail-desc { font-size: 26rpx; color: #43474f; line-height: 1.5; display: block; margin-bottom: 20rpx; }

.info-row { display: flex; justify-content: space-between; padding: 14rpx 0; }
.info-label { font-size: 25rpx; color: #c3c6d1; }
.info-value { font-size: 25rpx; color: #191c1e; font-weight: 500; }

.section-label { font-size: 25rpx; font-weight: 600; color: #43474f; text-transform: uppercase; letter-spacing: 3rpx; display: block; margin-bottom: 14rpx; }
.record-row { display: flex; justify-content: space-between; align-items: center; padding: 14rpx 0; border-top: 1rpx solid #f2f4f7; }
.record-row:first-of-type { border-top: none; }
.record-main { font-size: 26rpx; color: #191c1e; }
.sub-meta { font-size: 22rpx; color: #c3c6d1; display: block; margin-top: 4rpx; }
.record-result { font-size: 24rpx; font-weight: 700;
  &.win { color: #001e40; }
  &.lose { color: #b3261e; }
}

.btn-row { display: flex; gap: 8rpx; }
.btn-row .accept { background: #001e40; color: #fff; font-size: 22rpx; }
.btn-row .reject { background: #f2f4f7; color: #43474f; font-size: 22rpx; }

.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; }
.solid-textarea { width: 100%; min-height: 120rpx; font-size: 26rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 16rpx; border: none; box-sizing: border-box; margin-top: 12rpx; }
.primary-btn { margin-top: 16rpx; height: 80rpx; background: #001e40; color: #fff; border-radius: 14rpx; font-size: 26rpx; }

.join-btn { margin: 28rpx 32rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; font-size: 29rpx; font-weight: 600; color: #fff; &::after { display: none; } }
</style>
