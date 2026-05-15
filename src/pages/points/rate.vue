<template>
  <view class="rate-page">
    <custom-nav-bar :title="adminMode ? '加扣分' : '评分标准'" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <!-- 管理员加扣分模式 -->
      <view v-if="adminMode && isAdminUser" class="form-area">
        <view class="form-card">
          <view class="form-row">
            <text class="row-label block">选择对象（学号）</text>
            <input class="solid-input" placeholder="输入学号" v-model="form.studentId" />
          </view>
          <view class="form-row">
            <text class="row-label block">分值（正数为加分、负数为扣分）</text>
            <input class="solid-input" type="digit" placeholder="例如 5 或 -3" v-model="form.score" />
          </view>
          <view class="textarea-wrap">
            <text class="row-label block">原因</text>
            <textarea class="solid-textarea" v-model="form.reason" placeholder="说明加扣分原因..." />
          </view>
        </view>
        <button class="primary-btn" @tap="submit"><text class="btn-text">提交</text></button>
      </view>

      <!-- 评分标准展示 -->
      <view v-else>
        <view v-for="cat in categories" :key="cat.key" class="category-card">
          <text class="cat-title">{{ cat.title }}</text>
          <view v-for="item in cat.items" :key="item.name" class="rate-row">
            <text class="rate-name">{{ item.name }}</text>
            <text :class="['rate-val', item.type]">{{ item.type === 'add' ? '+' : '' }}{{ item.points }}</text>
          </view>
        </view>
      </view>

      <view style="height: 60rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { isAdmin as checkIsAdmin } from '@/constants/roles'
import { addPointRecord } from '@/api/points'
import { post } from '@/utils/request'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)
const isAdminUser = computed(() => checkIsAdmin(profile.value?.role))

const adminMode = ref(false)

const categories = ref([
  { key: 'discipline', title: '纪律表现', items: [
    { name: '全勤打卡', points: 10, type: 'add' },
    { name: '迟到/早退', points: 3, type: 'minus' },
    { name: '旷课', points: 10, type: 'minus' }
  ]},
  { key: 'activity', title: '活动参与', items: [
    { name: '参加区队活动', points: 5, type: 'add' },
    { name: '组织活动', points: 8, type: 'add' },
    { name: '无故缺席', points: 3, type: 'minus' }
  ]},
  { key: 'study', title: '学习表现', items: [
    { name: '作业全交', points: 5, type: 'add' },
    { name: '考试进步', points: 10, type: 'add' },
    { name: '作业缺交', points: 2, type: 'minus' }
  ]}
])

const form = reactive({ studentId: '', score: '', reason: '' })

async function submit() {
  if (!form.studentId) { uni.showToast({ title: '请输入学号', icon: 'none' }); return }
  const score = Number(form.score)
  if (!Number.isFinite(score) || score === 0) { uni.showToast({ title: '请输入有效分数', icon: 'none' }); return }
  if (!form.reason) { uni.showToast({ title: '请填写原因', icon: 'none' }); return }

  try {
    // 先按学号查 user_id
    const userRes = await post('/api/auth/find-by-student', { student_id: form.studentId }, { silent: true }).catch(() => null)
    let targetId = userRes?.user?.id
    if (!targetId) {
      uni.showToast({ title: '未找到该学号用户', icon: 'none' })
      return
    }
    await addPointRecord({ user_id: targetId, score, reason: form.reason })
    uni.showToast({ title: '已提交', icon: 'success' })
    form.studentId = ''; form.score = ''; form.reason = ''
  } catch (_) {}
}

onLoad((opts) => { adminMode.value = opts?.admin === '1' })
</script>

<style lang="scss" scoped>
@import "@/uni.scss";
.rate-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.form-area { padding: 24rpx 32rpx; }
.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { padding: 24rpx; }
.row-label { font-size: 26rpx; font-weight: 500; color: #191c1e; &.block { display: block; margin-bottom: 12rpx; } }
.solid-input { width: 100%; height: 60rpx; line-height: 60rpx; font-size: 28rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 0 20rpx; border: none; box-sizing: border-box; }
.textarea-wrap { padding: 24rpx; }
.solid-textarea { width: 100%; min-height: 180rpx; font-size: 26rpx; color: #191c1e; background: #f7f9fc; border-radius: 12rpx; padding: 16rpx; border: none; box-sizing: border-box; }
.primary-btn { margin-top: 24rpx; height: 88rpx; background: linear-gradient(135deg, #001e40, #003366); border-radius: 18rpx; border: none; color: #fff; }
.btn-text { font-size: 30rpx; font-weight: 700; color: #fff; }

.category-card { margin: 20rpx 32rpx; background: #fff; border-radius: 20rpx; padding: 24rpx; }
.cat-title { font-size: 28rpx; font-weight: 700; color: #191c1e; display: block; margin-bottom: 16rpx; padding-bottom: 14rpx; border-bottom: 2rpx solid #f2f4f7; }
.rate-row { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.rate-name { font-size: 26rpx; color: #191c1e; }
.rate-val { font-size: 28rpx; font-weight: 700;
  &.add { color: #001e40; }
  &.minus { color: #b3261e; }
}
</style>
