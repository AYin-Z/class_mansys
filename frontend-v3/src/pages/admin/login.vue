<script setup lang="ts">
/**
 * 超管后台登录
 *
 * 2026-09（B7）修复：
 *  - 登录接口 silent:true：401（账号或密码错误）不再叠加 request 层 toast，
 *    只保留行内提示（此接口 needAuth=false，request 层已不会误触发全局登出）。
 *  - catch 直接显示 e.message（可能是英文）→ 统一翻译成「学号不存在 / 密码错误 / 网络失败」。
 *  - emoji 图标 → AppIcon，字段换 FormField，按钮换 BaseButton，错误底色 #fef2f2 换令牌。
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { post } from '@/utils/request'
import type { LoginResult } from '@/api/auth'
import { USER_ROLES } from '@/types/roles'
import AppIcon from '@/components/ui/AppIcon.vue'
import FormField from '@/components/ui/FormField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const userStore = useUserStore()

const studentId = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

/** 把网络/后端错误翻译成用户看得懂的具体原因（禁止把英文原文抛给用户） */
function friendlyLoginError(e: unknown): string {
  const err = e as { code?: string; status?: number; message?: string } | null
  const code = err?.code || ''
  const status = Number(err?.status || 0)
  const raw = String(err?.message || '')
  if (code === 'TIMEOUT') return '请求超时，请检查网络后重试'
  if (code === 'NETWORK' || status === 0) return '网络连接失败，请检查网络后重试'
  if (status === 404 || /不存在|未找到|未注册|not\s*found/i.test(raw)) {
    return '学号不存在，请核对后重试'
  }
  // 后端返回中文原因时原样展示，其余一律翻译成中文（不暴露英文原文）
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw
  if (status === 401 || status === 403 || /密码|password|凭证|credential/i.test(raw)) {
    return '密码错误，请重新输入'
  }
  return '登录失败，请稍后重试'
}

async function doLogin() {
  if (loading.value) return
  error.value = ''
  if (!studentId.value.trim() || !password.value.trim()) {
    error.value = '请输入学号和密码'
    return
  }
  loading.value = true
  try {
    const res = await post<LoginResult>(
      '/api/auth/login-with-password',
      { student_id: studentId.value.trim(), password: password.value },
      { needAuth: false, silent: true },
    )
    if (!res?.success || !res.user || !res.token) {
      error.value = '登录失败，请稍后重试'
      return
    }
    // 仅允许超级管理员 (role=8) 进入后台
    if (res.user.role !== USER_ROLES.SUPER_ADMIN) {
      error.value = '该账号不是超级管理员，无法进入后台'
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
      avatarUrl: res.user.avatarUrl,
    })
    router.replace('/admin/panel')
  } catch (e) {
    error.value = friendlyLoginError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="login-card">
      <div class="login-header">
        <div class="shield-icon"><AppIcon name="shield" :size="40" /></div>
        <h1>超级管理员后台</h1>
        <p class="subtitle">仅系统管理员可登录</p>
      </div>

      <div v-if="error" class="error-msg" role="alert">
        <AppIcon name="alert-circle" :size="15" />
        <span>{{ error }}</span>
      </div>

      <FormField label="学号" required>
        <input
          v-model="studentId"
          type="text"
          placeholder="请输入学号"
          autocomplete="username"
          @keyup.enter="doLogin"
        />
      </FormField>

      <FormField label="密码" required>
        <input
          v-model="password"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          @keyup.enter="doLogin"
        />
      </FormField>

      <BaseButton block size="lg" :loading="loading" class="submit" @click="doLogin">
        {{ loading ? '登录中…' : '登录后台' }}
      </BaseButton>

      <div class="back-link">
        <router-link to="/pages/login/password-login">
          <AppIcon name="arrow-left" :size="14" />
          <span>返回普通登录</span>
        </router-link>
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.login-header {
  text-align: center;
  margin-bottom: 8px;
}
.shield-icon {
  color: var(--color-primary);
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
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-error-bg);
  color: var(--color-error);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.4;
}
.submit { margin-top: 8px; }
.back-link {
  text-align: center;
  margin-top: 4px;
}
.back-link a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  font-size: 14px;
  color: var(--color-text-2);
  text-decoration: none;
}
.back-link a:hover {
  color: var(--color-accent);
}
</style>
