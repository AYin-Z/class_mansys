<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { post } from '@/utils/request'
import { showToast } from '@/utils/ui'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const studentId = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const canLogin = computed(() => studentId.value.trim().length > 0 && password.value.length > 0)

async function handleLogin() {
  if (!canLogin.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    const result = await post('/api/auth/login-with-password', {
      student_id: studentId.value.trim(),
      password: password.value
    }, false)
    if (!result.success) throw new Error(result.error || '登录失败')
    userStore.setTokenAndProfile(result.token, result.user)
    showToast('登录成功')
    // 重定向到原本要访问的页面，或首页
    const redirect = (route.query.redirect as string) || '/pages/index/index'
    setTimeout(() => router.replace(redirect), 500)
  } catch (e: any) {
    errorMsg.value = e.message || '登录失败，请稍后重试'
    showToast(errorMsg.value, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo">🎓</div>
      <h1>区队管理系统</h1>
      <p>请输入学号和密码登录</p>
    </div>
    <div class="login-card">
      <div class="form-group">
        <label>学号</label>
        <input
          v-model="studentId"
          type="text"
          placeholder="请输入学号"
          maxlength="20"
          @keyup.enter="handleLogin"
        />
      </div>
      <div class="form-group">
        <label>密码</label>
        <div class="password-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          />
          <button class="toggle-pw" @click="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
      <button class="login-btn" :disabled="!canLogin || loading" @click="handleLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <div class="login-footer">
        <router-link to="/pages/login/phone-login">手机号登录 ›</router-link>
        <span class="divider">|</span>
        <router-link to="/pages/login/email-login">邮箱登录 ›</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #1a3a5c 0%, #0f2440 100%);
}
.login-header {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 48px 24px 24px;
}
.logo {
  width: 64px; height: 64px;
  background: rgba(255,255,255,0.12);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 16px;
}
h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
.login-header p { font-size: 14px; color: rgba(255,255,255,0.65); }

.login-card {
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 32px 24px 40px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
}
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.form-group input {
  width: 100%;
  height: 48px;
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  padding: 0 16px;
  font-size: 16px;
  color: #1f2937;
  background: #f9fafb;
  outline: none;
  transition: all 0.2s;
}
.form-group input:focus {
  border-color: #2d7ff9;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(45,127,249,0.12);
}
.form-group input::placeholder { color: #9ca3af; }

.password-wrap { position: relative; }
.password-wrap input { padding-right: 50px; }
.toggle-pw {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  padding: 4px;
  line-height: 1;
}

.error-text { color: #ef4444; font-size: 13px; margin-top: -12px; margin-bottom: 12px; }
.login-btn {
  width: 100%;
  height: 48px;
  background: #1a3a5c;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.login-btn:active { opacity: 0.85; }
.login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.login-footer { text-align: center; margin-top: 16px; }
.login-footer a { font-size: 14px; color: #6b7280; text-decoration: none; }
.login-footer .divider { margin: 0 8px; color: #d1d5db; }
</style>
