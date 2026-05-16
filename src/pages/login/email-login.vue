<template>
  <div class="login-container">
    <div class="login-header">
      <span class="title">邮箱登录</span>
      <span class="subtitle">请输入邮箱地址获取验证码</span>
    </div>

    <div class="login-form">
      <!-- 邮箱输入 -->
      <div class="input-group">
        <span class="label">邮箱地址</span>
        <input
          class="input-field"
          type="text"
          placeholder="请输入邮箱地址"
          v-model="email"
          @input="onEmailInput"
        />
      </div>

      <!-- 验证码输入 -->
      <div class="input-group">
        <span class="label">验证码</span>
        <div class="verification-row">
          <input
            class="input-field verification-input"
            type="number"
            placeholder="请输入验证码"
            v-model="code"
            maxlength="6"
          />
          <button
            class="get-code-btn"
            :disabled="!isEmailValid || countdown > 0 || sending"
            @click="sendCode"
          >
            {{ sending ? '发送中...' : countdown > 0 ? `${countdown}s后重试` : '获取验证码' }}
          </button>
        </div>
      </div>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :disabled="!canLogin || logging"
        @click="handleLogin"
      >
        {{ logging ? '登录中...' : '登录' }}
      </button>

      <!-- 返回链接 -->
      <div class="back-login">
        <span @click="goBack" class="link-text">返回登录方式选择</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '@/utils/request'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/ui'
const userStore = useUserStore()

// 表单数据
const email = ref('')
const code = ref('')
const countdown = ref(0)
const sending = ref(false)
const logging = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

// 邮箱格式校验
const isEmailValid = computed(() => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
})

const canLogin = computed(() => {
  return isEmailValid.value && code.value.length >= 4
})

// 输入时清除多余空格
const onEmailInput = () => {
  email.value = email.value.trim()
}

// 发送验证码
const sendCode = async () => {
  if (!isEmailValid.value) {
    showToast('请输入正确的邮箱地址')
    return
  }

  sending.value = true
  try {
    const res = await post<{ success: boolean; code: string; message: string }>(
      '/api/auth/send-code',
      { email: email.value },
      false
    )
    if (res.success) {
      showToast('验证码已发送')
      startCountdown()
    } else {
      showToast(res.message || '发送失败', 'error')
    }
  } catch (err: any) {
    showToast(err.message || '发送验证码失败', 'error')
  } finally {
    sending.value = false
  }
}

// 倒计时
const startCountdown = () => {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }, 1000)
}

// 登录
const handleLogin = async () => {
  if (!canLogin.value) {
    showToast('请完善登录信息')
    return
  }

  logging.value = true
  try {
    const res = await post<{
      success: boolean
      token: string
      user: {
        id: number
        name: string
        student_id?: string
        role: number
        phone?: string
        email?: string
        avatarUrl?: string
        class_id?: string
      }
    }>(
      '/api/auth/email-code-login',
      { email: email.value, code: code.value },
      false
    )

    if (res.success && res.token && res.user) {
      userStore.setTokenAndProfile(res.token, {
        id: res.user.id,
        name: res.user.name,
        student_id: res.user.student_id,
        role: res.user.role,
        phone: res.user.phone,
        email: res.user.email,
        avatarUrl: res.user.avatarUrl,
        class_id: res.user.class_id
      })

      showToast('登录成功')

      setTimeout(() => {
        router.replace('/pages/index/index')
      }, 800)
    } else {
      showToast('登录失败，请重试')
    }
  } catch (err: any) {
    showToast(err.message || '登录失败', 'error')
  } finally {
    logging.value = false
  }
}

// 返回登录方式选择
const goBack = () => {
  router.back()
}

// 清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.login-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  padding: 100rpx 48rpx 60rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.login-header {
  text-align: center;
  margin-bottom: 80rpx;
  padding-top: 60rpx;
}

.title {
  font-size: 52rpx;
  font-weight: 700;
  color: #ffffff;
  display: block;
  margin-bottom: 16rpx;
  letter-spacing: 4rpx;
}

.subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.6);
  display: block;
}

.login-form {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.input-group {
  margin-bottom: 40rpx;
}

.label {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.input-field {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  box-sizing: border-box;
  background: #f7f8fa;
  color: #333;
  transition: border-color 0.2s;
}

.input-field:focus {
  border-color: #302b63;
  background: #ffffff;
}

.verification-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.verification-input {
  flex: 1;
}

.get-code-btn {
  width: 210rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #302b63, #0f0c29);
  color: #ffffff;
  border: none;
  border-radius: 12rpx;
  font-size: 24rpx;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;
}

.get-code-btn:disabled {
  background: #c0c0c0;
  color: #888;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #302b63, #0f0c29);
  color: #ffffff;
  border: none;
  border-radius: 12rpx;
  font-size: 34rpx;
  font-weight: 600;
  margin-top: 20rpx;
  letter-spacing: 6rpx;
}

.login-btn:disabled {
  background: #c0c0c0;
  color: #888;
}

.back-login {
  text-align: center;
  margin-top: 48rpx;
}

.link-text {
  font-size: 28rpx;
  color: #302b63;
  text-decoration: underline;
}
</style>
