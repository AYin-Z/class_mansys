<template>
  <div class="login-container">
    <div class="login-header">
      <span class="title">学号密码登录</span>
      <span class="subtitle">请输入学号和密码进行登录</span>
    </div>

    <div class="login-form">
      <!-- 学号输入 -->
      <div class="input-group">
        <span class="label">学号</span>
        <input
          class="input-field"
          type="text"
          placeholder="请输入学号"
          v-model="studentId"
          maxlength="20"
          @input="onStudentIdInput"
        />
        <span v-if="studentIdError" class="error-text">{{ studentIdError }}</span>
      </div>

      <!-- 密码输入 -->
      <div class="input-group">
        <span class="label">密码</span>
        <div class="password-input-container">
          <input
            class="input-field password-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            v-model="password"
          />
          <button class="toggle-password-btn" @click="togglePassword">
            <span>{{ showPassword ? '🙈' : '👁️' }}</span>
          </button>
        </div>
        <span v-if="passwordError" class="error-text">{{ passwordError }}</span>
      </div>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="!canLogin || loading"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <!-- 底部链接 -->
      <div class="bottom-links">
          <span class="link-text" @click="goBack">返回登录方式选择</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '@/utils/request'
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()

// 响应式数据
const studentId = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const studentIdError = ref('')
const passwordError = ref('')
const touched = ref(false)

// 学号正则：4-20 位字母或数字
const STUDENT_ID_REGEX = /^[a-zA-Z0-9]{4,20}$/

// 计算属性
const isStudentIdValid = computed(() => STUDENT_ID_REGEX.test(studentId.value))
const isPasswordValid = computed(() => password.value.length > 0)
const canLogin = computed(() => isStudentIdValid.value && isPasswordValid.value)

// 学号输入时实时校验
const onStudentIdInput = () => {
  if (!touched.value) return
  if (studentId.value.length > 0 && !STUDENT_ID_REGEX.test(studentId.value)) {
    studentIdError.value = '学号格式不正确，请输入4-20位字母或数字'
  } else {
    studentIdError.value = ''
  }
}

// 本地表单校验
const validate = (): boolean => {
  touched.value = true
  let valid = true

  if (!studentId.value.trim()) {
    studentIdError.value = '请输入学号'
    valid = false
  } else if (!STUDENT_ID_REGEX.test(studentId.value.trim())) {
    studentIdError.value = '学号格式不正确，请输入4-20位字母或数字'
    valid = false
  } else {
    studentIdError.value = ''
  }

  if (!password.value) {
    passwordError.value = '请输入密码'
    valid = false
  } else {
    passwordError.value = ''
  }

  return valid
}

// 切换密码显示
const togglePassword = () => {
  showPassword.value = !showPassword.value
}

// 处理登录
const handleLogin = async () => {
  if (!validate()) return

  try {
    loading.value = true
    uni.showLoading({ title: '登录中...' })

    const result = await post(
      '/api/auth/login-with-password',
      { student_id: studentId.value.trim(), password: password.value },
      false
    )

    if (!result.success) {
      throw new Error(result.error || '登录失败')
    }

    userStore.setTokenAndProfile(result.token, result.user)

    
    showToast('登录成功')

    setTimeout(() => {
      router.replace('/pages/index/index')
    }, 800)
  } catch (error: any) {
    
    const message = error.message || '登录失败，请稍后重试'
    uni.showToast({ title: message, icon: 'none', duration: 3000 })
  } finally {
    loading.value = false
  }
}

// 返回登录方式选择
const goBack = () => {
  router.back()
}

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.login-container {
  min-height: 100vh;
  background: $gradient-primary;
  padding: 60rpx 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.login-header {
  text-align: center;
  margin-bottom: 80rpx;
  padding-top: 40rpx;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: $on-primary;
  display: block;
  margin-bottom: 20rpx;
}

.subtitle {
  font-size: 28rpx;
  color: rgba($on-primary, 0.8);
  display: block;
  line-height: 1.4;
}

.login-form {
  background: $surface-container-lowest;
  border-radius: 20rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.15);
}

.input-group {
  margin-bottom: 40rpx;
  position: relative;
}

.label {
  font-size: 28rpx;
  color: $on-surface;
  display: block;
  margin-bottom: 20rpx;
  font-weight: 500;
}

.input-field {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid $surface-container-high;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  box-sizing: border-box;
  background: $surface-container-low;
}

.input-field:focus {
  border-color: $primary-container;
  background: $surface-container-lowest;
  box-shadow: 0 0 0 4rpx rgba($primary-container, 0.08);
}

.error-text {
  font-size: 22rpx;
  color: $error;
  display: block;
  margin-top: 10rpx;
  padding-left: 4rpx;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  flex: 1;
  padding-right: 100rpx;
}

.toggle-password-btn {
  position: absolute;
  right: 20rpx;
  width: 60rpx;
  height: 60rpx;
  background: transparent;
  border: none;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: $gradient-primary;
  color: $on-primary;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.login-btn:disabled {
  background: $on-surface-tertiary;
  color: $on-surface-tertiary;
}

.login-btn:not(:disabled):active {
  opacity: 0.9;
  transform: translateY(2rpx);
}

.bottom-links {
  display: flex;
  justify-content: space-between;
  margin-top: 40rpx;
}

.link-text {
  font-size: 28rpx;
  color: $primary-container;
  text-decoration: underline;
}
</style>
