<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { loginWithPassword } from '@/api/auth'
import { USER_ROLES } from '@/types/roles'

const router = useRouter()
const userStore = useUserStore()

const studentId = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function doLogin() {
  error.value = ''
  if (!studentId.value.trim() || !password.value.trim()) {
    error.value = '请输入学号和密码'
    return
  }
  loading.value = true
  try {
    const res = await loginWithPassword({ student_id: studentId.value.trim(), password: password.value })
    if (res?.success && res.user && res.token) {
      // 仅允许超级管理员 (role=8) 进入后台
      if (res.user.role !== USER_ROLES.SUPER_ADMIN) {
        error.value = '仅超级管理员可访问后台，你的角色权限不足'
        loading.value = false
        return
      }
      userStore.setTokenAndProfile(res.token, {
        id: res.user.id,
        name: res.user.name,
        nickName: res.user.nickName,
        student_id: res.user.student_id,
        class_id: res.user.class_id,
        role: res.user.role,
        phone: res.user.phone,
        email: res.user.email,
        avatarUrl: res.user.avatarUrl
      })
      router.replace('/admin/panel')
    } else {
      error.value = '登录失败，请检查学号和密码'
    }
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="login-card">
      <div class="login-header">
        <div class="shield-icon">🛡️</div>
        <h1>超级管理员后台</h1>
        <p class="subtitle">仅系统管理员可登录</p>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div class="form-group">
        <label>学号</label>
        <input
          v-model="studentId"
          type="text"
          placeholder="请输入学号"
          @keyup.enter="doLogin"
          autocomplete="username"
        />
      </div>

      <div class="form-group">
        <label>密码</label>
        <input
          v-model="password"
          type="password"
          placeholder="请输入密码"
          @keyup.enter="doLogin"
          autocomplete="current-password"
        />
      </div>

      <button class="btn-primary" :disabled="loading" @click="doLogin">
        {{ loading ? '登录中...' : '登录后台' }}
      </button>

      <div class="back-link">
        <router-link to="/pages/login/password-login">← 返回普通登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 32px 24px;
  box-shadow: var(--shadow-card);
}
.login-header {
  text-align: center;
  margin-bottom: 24px;
}
.shield-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.login-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px;
}
.subtitle {
  font-size: 14px;
  color: var(--color-text-2);
  margin: 0;
}
.error-msg {
  background: #fef2f2;
  color: var(--color-error);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 6px;
}
.form-group input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0 12px;
  font-size: 15px;
  background: var(--color-surface-2);
  color: var(--color-text);
  box-sizing: border-box;
}
.form-group input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}
.btn-primary {
  width: 100%;
  height: 44px;
  background: var(--color-primary);
  color: var(--color-text-on-primary);
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.back-link {
  text-align: center;
  margin-top: 20px;
}
.back-link a {
  font-size: 14px;
  color: var(--color-text-2);
  text-decoration: none;
}
.back-link a:hover {
  color: var(--color-accent);
}
</style>
