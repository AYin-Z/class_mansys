<template>
  <view class="settings-page">
    <custom-nav-bar title="系统设置" :showBack="true" />
    <scroll-view scroll-y class="main-scroll">
      <!-- 个人资料 -->
      <view class="section">
        <text class="section-title">个人资料</text>
        <view class="form-card">
          <view class="form-row">
            <text class="row-label">姓名</text>
            <input class="row-input" v-model="form.name" placeholder="请输入姓名" />
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label">手机号</text>
            <input class="row-input" v-model="form.phone" placeholder="请输入手机号" type="number" maxlength="11" />
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label">邮箱</text>
            <input class="row-input" v-model="form.email" placeholder="请输入邮箱" type="email" />
          </view>
        </view>
        <button class="save-btn" @click="saveProfile" :disabled="saving">
          {{ saving ? '保存中...' : '保存资料' }}
        </button>
      </view>

      <!-- 修改密码 -->
      <view class="section">
        <text class="section-title">修改密码</text>
        <view class="form-card">
          <view class="form-row">
            <text class="row-label">旧密码</text>
            <input class="row-input" v-model="pwForm.oldPassword" placeholder="输入旧密码" password />
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label">新密码</text>
            <input class="row-input" v-model="pwForm.newPassword" placeholder="至少6位" password />
          </view>
          <view class="divider"></view>
          <view class="form-row">
            <text class="row-label">确认新密码</text>
            <input class="row-input" v-model="pwForm.confirmPassword" placeholder="再次输入新密码" password />
          </view>
        </view>
        <button class="save-btn" @click="changePassword" :disabled="pwSaving">
          {{ pwSaving ? '修改中...' : '修改密码' }}
        </button>
      </view>

      <view style="height: 60rpx;"></view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { put, post } from '@/utils/request'

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

const form = ref({ name: '', phone: '', email: '' })
const saving = ref(false)

const pwForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwSaving = ref(false)

onMounted(() => {
  if (profile.value) {
    form.value.name = profile.value.name || ''
    form.value.phone = profile.value.phone || ''
    form.value.email = profile.value.email || ''
  }
})

async function saveProfile() {
  if (!form.value.name.trim()) {
    return uni.showToast({ title: '姓名不能为空', icon: 'none' })
  }
  saving.value = true
  try {
    const res = await put(`/api/users/${profile.value.id}`, {
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      email: form.value.email.trim()
    })
    if (res.success) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      userStore.hydrate()
    } else {
      uni.showToast({ title: res.error || '保存失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  const { oldPassword, newPassword, confirmPassword } = pwForm.value
  if (!oldPassword) return uni.showToast({ title: '请输入旧密码', icon: 'none' })
  if (newPassword.length < 6) return uni.showToast({ title: '新密码至少6位', icon: 'none' })
  if (newPassword !== confirmPassword) return uni.showToast({ title: '两次密码不一致', icon: 'none' })

  pwSaving.value = true
  try {
    const res = await post('/api/auth/change-password', { oldPassword, newPassword })
    if (res.success) {
      uni.showToast({ title: '密码修改成功', icon: 'success' })
      pwForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    } else {
      uni.showToast({ title: res.error || '修改失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '修改失败', icon: 'none' })
  } finally {
    pwSaving.value = false
  }
}
</script>

<style lang="scss" scoped>
.settings-page { min-height: 100vh; background-color: #f7f9fc; }
.main-scroll { height: 100vh; padding-top: calc(env(safe-area-inset-top) + 88rpx); }

.section { padding: 24rpx 32rpx; }
.section-title { font-size: 26rpx; font-weight: 600; color: #c3c6d1; display: block; margin-bottom: 16rpx; letter-spacing: 2rpx; }

.form-card { background: #fff; border-radius: 20rpx; overflow: hidden; }
.form-row { display: flex; align-items: center; padding: 24rpx; }
.row-label { font-size: 26rpx; color: #191c1e; width: 120rpx; flex-shrink: 0; font-weight: 500; }
.row-input { flex: 1; font-size: 26rpx; color: #191c1e; height: 48rpx; }
.divider { height: 1rpx; background: #f2f4f7; margin: 0 24rpx; }

.save-btn {
  margin-top: 16rpx; width: 100%; height: 80rpx; border-radius: 16rpx;
  background: linear-gradient(135deg, #001e40, #003366); border: none;
  font-size: 28rpx; font-weight: 600; color: #fff;
  display: flex; align-items: center; justify-content: center;
  &[disabled] { opacity: 0.5; }
  &::after { display: none; }
}
</style>
