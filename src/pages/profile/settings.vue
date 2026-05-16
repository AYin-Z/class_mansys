<template>
  <div class="settings-page">
    <custom-nav-bar title="系统设置" :showBack="true" />
    <div scroll-y class="main-scroll">
      <!-- 个人资料 -->
      <div class="section">
        <span class="section-title">个人资料</span>
        <div class="form-card">
          <div class="form-row">
            <span class="row-label">姓名</span>
            <input class="row-input" v-model="form.name" placeholder="请输入姓名" />
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label">手机号</span>
            <input class="row-input" v-model="form.phone" placeholder="请输入手机号" type="number" maxlength="11" />
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label">邮箱</span>
            <input class="row-input" v-model="form.email" placeholder="请输入邮箱" type="email" />
          </div>
        </div>
        <button class="save-btn" @click="saveProfile" :disabled="saving">
          {{ saving ? '保存中...' : '保存资料' }}
        </button>
      </div>

      <!-- 修改密码 -->
      <div class="section">
        <span class="section-title">修改密码</span>
        <div class="form-card">
          <div class="form-row">
            <span class="row-label">旧密码</span>
            <input class="row-input" v-model="pwForm.oldPassword" placeholder="输入旧密码" password />
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label">新密码</span>
            <input class="row-input" v-model="pwForm.newPassword" placeholder="至少6位" password />
          </div>
          <div class="divider"></div>
          <div class="form-row">
            <span class="row-label">确认新密码</span>
            <input class="row-input" v-model="pwForm.confirmPassword" placeholder="再次输入新密码" password />
          </div>
        </div>
        <button class="save-btn" @click="changePassword" :disabled="pwSaving">
          {{ pwSaving ? '修改中...' : '修改密码' }}
        </button>
      </div>

      <div style="height: 60rpx;"></div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { put, post } from '@/utils/request'
import { showToast } from '@/utils/ui'
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
    return showToast('姓名不能为空')
  }
  saving.value = true
  try {
    const res = await put(`/api/users/${profile.value.id}`, {
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      email: form.value.email.trim()
    })
    if (res.success) {
      showToast('保存成功')
      userStore.hydrate()
    } else {
      showToast(res.error || '保存失败', 'error')
    }
  } catch (e) {
    showToast('保存失败')
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  const { oldPassword, newPassword, confirmPassword } = pwForm.value
  if (!oldPassword) return showToast('请输入旧密码')
  if (newPassword.length < 6) return showToast('新密码至少6位')
  if (newPassword !== confirmPassword) return showToast('两次密码不一致')

  pwSaving.value = true
  try {
    const res = await post('/api/auth/change-password', { oldPassword, newPassword })
    if (res.success) {
      showToast('密码修改成功')
      pwForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    } else {
      showToast(res.error || '修改失败', 'error')
    }
  } catch (e) {
    showToast('修改失败')
  } finally {
    pwSaving.value = false
  }
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.settings-page { min-height: 100vh; background-color: #f7f9fc; }
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
