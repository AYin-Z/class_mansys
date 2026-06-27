<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { post } from '@/utils/request'
import { showToast } from '@/utils/ui'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const canLogin = computed(() => email.value.trim().length > 0 && email.value.includes('@') && password.value.length > 0)

async function handleLogin() {
  if (!canLogin.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    const result = await post('/api/auth/login-with-email', {
      email: email.value.trim(),
      password: password.value
    }, false)
    if (!result.success) throw new Error(result.error || '登录失败')
    userStore.setTokenAndProfile(result.token, result.user)
    showToast('登录成功')
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
      <div class="logo">✉️</div>
      <h1>邮箱登录</h1>
      <p>使用绑定邮箱和密码登录</p>
    </div>
    <div class="login-card">
      <div class="form-group">
        <label>邮箱</label>
        <input
          v-model="email"
          type="email"
          placeholder="请输入邮箱"
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
        <router-link to="/pages/login/password-login">学号密码登录 ›</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; background: linear-gradient(160deg, #1a3a5c, #0f2440); }
.login-header { padding: 80px 24px 24px; text-align: center; }
.logo { font-size: 48px; margin-bottom: 12px; }
.login-header h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.login-header p { font-size: 14px; color: rgba(255,255,255,.65); }
.login-card { background: #fff; border-radius: 16px 16px 0 0; padding: 32px 24px 40px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; }
.form-group input { width: 100%; height: 48px; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 0 16px; font-size: 16px; background: #f9fafb; outline: none; box-sizing: border-box; }
.form-group input:focus { border-color: #2d7ff9; }
.password-wrap { position: relative; }
.password-wrap input { padding-right: 44px; }
.toggle-pw { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; }
.error-text { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
.login-btn { width: 100%; height: 48px; background: #1a3a5c; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
.login-btn:disabled { opacity: .5; cursor: not-allowed; }
.login-footer { margin-top: 20px; text-align: center; }
.login-footer a { color: #2d7ff9; font-size: 14px; text-decoration: none; }
</style>
