<template>
  <div class="page">
    <div scroll-y class="scroll-area">
      <!-- 头部 -->
      <div class="header-section">
        <div class="brand-bar"></div>
        <div class="header-content">
          <span class="title">手机号登录</span>
          <span class="subtitle">使用手机号验证码快捷登录或注册</span>
        </div>
      </div>

      <div class="form-container">
        <!-- 手机号 -->
        <div class="form-group">
          <div class="input-wrapper">
            <span class="input-label">手机号码</span>
            <input
              class="ghost-input"
              type="number"
              placeholder="请输入手机号码"
              v-model="phone"
              maxlength="11"
              :disabled="codeSent"
            />
          </div>
        </div>

        <!-- 验证码 -->
        <div class="form-group">
          <div class="input-wrapper">
            <span class="input-label">验证码</span>
            <div class="code-row">
              <input
                class="ghost-input code-input"
                type="number"
                placeholder="请输入 6 位验证码"
                v-model="code"
                maxlength="6"
                :disabled="!codeSent"
              />
              <button
                class="code-btn"
                :disabled="!phoneValid || countdown > 0"
                @click="sendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 新用户补全信息（验证码验证通过后展示） -->
        <div v-if="needProfile" class="form-group">
          <div class="input-wrapper">
            <span class="input-label">真实姓名</span>
            <input
              class="ghost-input"
              placeholder="请输入真实姓名"
              v-model="name"
            />
          </div>
          <div class="input-divider"></div>
          <div class="input-wrapper">
            <span class="input-label">学号</span>
            <input
              class="ghost-input"
              placeholder="请输入学号"
              v-model="studentId"
            />
          </div>
        </div>

        <!-- 提示文字 -->
        <div class="tip-text" v-if="!codeSent && !needProfile">
          验证码将发送至您的手机，请注意查收
        </div>
        <div class="tip-text" v-if="codeSent && !needProfile">
          请输入您收到的 6 位验证码
        </div>
        <div class="tip-text" v-if="needProfile">
          新用户请补全姓名和学号完成注册
        </div>

        <!-- 登录 / 注册 按钮 -->
        <button
          class="primary-btn"
          :disabled="!canSubmit || submitting"
          @click="handleSubmit"
        >
          <span v-if="!submitting">{{ needProfile ? '完成注册' : '登录' }}</span>
          <span v-else>处理中...</span>
        </button>

        <!-- 返回链接 -->
        <div class="back-link">
          <span class="link-text" @click="goBack">返回登录方式选择</span>
        </div>
      </div>
    </div>

    <!-- loading 遮罩 -->
    <div class="loading-mask" v-if="submitting">
      <div class="loading-box">
        <span class="loading-text">{{ loadingText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">


import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { post } from '@/utils/request'
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()

// ---------- data ----------
const phone = ref('')
const code = ref('')
const name = ref('')
const studentId = ref('')

const countdown = ref(0)
const submitting = ref(false)
const loadingText = ref('')
const codeSent = ref(false)       // 验证码已成功发送
const needProfile = ref(false)    // 新用户，需要补全姓名 + 学号

let timer: ReturnType<typeof setInterval> | null = null

// ---------- computed ----------
const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

const canSubmit = computed(() => {
  if (!codeSent && !needProfile.value) {
    // 第一步：手机号有效 + 验证码 6 位
    return phoneValid.value && code.value.length === 6
  }
  if (needProfile.value) {
    // 新用户补全：姓名 + 学号必填
    return name.value.trim() !== '' && studentId.value.trim() !== ''
  }
  return false
})

// ---------- methods ----------
async function sendCode() {
  if (!phoneValid.value) {
    showToast('请输入正确的手机号')
    return
  }

  submitting.value = true
  loadingText.value = '发送验证码...'

  try {
    const res = await post('/api/auth/send-code', { phone: phone.value }, false)
    if (res?.success) {
      showToast('验证码已发送')
      codeSent.value = true
      startCountdown()
    } else {
      uni.showToast({ title: res?.message || res?.error || '发送失败', icon: 'none' })
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '发送失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function startCountdown() {
  countdown.value = 60
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

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true

  if (!needProfile.value) {
    // ---------- 第一步：验证码登录 ----------
    loadingText.value = '登录中...'
    try {
      const res = await post('/api/auth/phone-code-login', {
        phone: phone.value,
        code: code.value
      }, false)

      if (res?.success && res.token && res.user) {
        // 登录成功
        userStore.setTokenAndProfile(res.token, {
          id: res.user.id,
          name: res.user.name || res.user.nickName || '未命名',
          nickName: res.user.nickName,
          student_id: res.user.student_id,
          class_id: res.user.class_id,
          role: typeof res.user.role === 'number' ? res.user.role : 0,
          phone: res.user.phone,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl
        })
        showToast('登录成功')
        setTimeout(() => {
          router.replace('/pages/index/index')
        }, 1000)
      } else if (res?.success === false && res?.code === 404) {
        // 用户未注册，展示补全信息
        needProfile.value = true
        showToast('新用户，请补全信息')
      } else {
        uni.showToast({ title: res?.message || res?.error || '登录失败', icon: 'none' })
      }
    } catch (err: any) {
      uni.showToast({ title: err?.message || '登录失败', icon: 'none' })
    }
  } else {
    // ---------- 第二步：新用户补全信息后注册 ----------
    loadingText.value = '注册中...'
    try {
      const res = await post('/api/auth/phone-code-login', {
        phone: phone.value,
        code: code.value,
        name: name.value.trim(),
        student_id: studentId.value.trim()
      }, false)

      if (res?.success && res.token && res.user) {
        userStore.setTokenAndProfile(res.token, {
          id: res.user.id,
          name: res.user.name || name.value.trim(),
          nickName: res.user.nickName,
          student_id: res.user.student_id || studentId.value.trim(),
          class_id: res.user.class_id,
          role: typeof res.user.role === 'number' ? res.user.role : 0,
          phone: res.user.phone,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl
        })
        showToast('注册成功')
        setTimeout(() => {
          router.replace('/pages/index/index')
        }, 1000)
      } else {
        uni.showToast({ title: res?.message || res?.error || '注册失败', icon: 'none' })
      }
    } catch (err: any) {
      uni.showToast({ title: err?.message || '注册失败', icon: 'none' })
    }
  }

  submitting.value = false
}

function goBack() {
  router.back()
}

// ---------- lifecycle ----------
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})

</script>

<style lang="scss" scoped>
@import "@/uni.scss";.page {
  min-height: 100vh;
  background: $surface;
}

.scroll-area {
  height: 100vh;
}

/* ========== 头部 ========== */
.header-section {
  position: relative;
  padding: 48rpx 32rpx 40rpx;
  background: $gradient-primary;
}

.brand-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 12rpx;
  background: rgba(255, 255, 255, 0.15);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  font-family: 'PingFang SC', sans-serif;
  font-size: 44rpx;
  font-weight: 700;
  color: $on-primary;
  letter-spacing: -0.5rpx;
}

.subtitle {
  font-size: 26rpx;
  color: rgba($on-primary, 0.65);
  font-weight: 400;
}

/* ========== 表单 ========== */
.form-container {
  padding: 32rpx;
}

.form-group {
  background: $surface-container-lowest;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.input-wrapper {
  padding: 28rpx 24rpx;
}

.input-label {
  display: block;
  font-size: 24rpx;
  font-weight: 500;
  color: $on-surface;
  margin-bottom: 12rpx;
}

.ghost-input {
  width: 100%;
  height: 52rpx;
  font-size: 30rpx;
  color: $on-surface;
  border: none;
  border-bottom: 2rpx solid rgba($outline-variant, 0.2);
  background: transparent;
  padding: 0;
  box-sizing: border-box;

  &:focus {
    border-bottom-color: $primary;
  }

  &::placeholder {
    color: $outline-variant;
  }

  &[disabled] {
    opacity: 0.5;
  }
}

.input-divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

/* 验证码行 */
.code-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  flex-shrink: 0;
  width: 180rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  background: $gradient-primary;
  border-radius: 12rpx;
  border: none;
  font-family: 'PingFang SC', sans-serif;
  font-size: 24rpx;
  font-weight: 600;
  color: $on-primary;
  padding: 0;

  &[disabled] {
    background: $outline-variant;
    color: $on-primary;
  }

  &:active:not([disabled]) {
    transform: scale(0.96);
  }
}

/* ========== 提示文字 ========== */
.tip-text {
  font-size: 24rpx;
  color: $on-surface-tertiary;
  margin-bottom: 24rpx;
  padding-left: 8rpx;
}

/* ========== 按钮 ========== */
.primary-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  text-align: center;
  background: $gradient-primary;
  border-radius: 20rpx;
  border: none;
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: $on-primary;
  margin-top: 8rpx;
  box-shadow: 0 8rpx 32rpx rgba($primary, 0.25);

  &[disabled] {
    background: $outline-variant;
    color: rgba($on-primary, 0.6);
    box-shadow: none;
  }

  &:active:not([disabled]) {
    transform: scale(0.98);
  }
}

/* ========== 返回链接 ========== */
.back-link {
  text-align: center;
  margin-top: 40rpx;
  padding-bottom: 48rpx;
}

.link-text {
  font-size: 26rpx;
  color: $primary;
  text-decoration: underline;
}

/* ========== loading 遮罩 ========== */
.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-box {
  background: $surface-container-lowest;
  padding: 40rpx 60rpx;
  border-radius: 16rpx;
}

.loading-text {
  font-size: 28rpx;
  color: $on-surface;
}
</style>
