<script setup lang="ts">
/**
 * 学号 + 密码登录
 *
 * 2026-09（B7）修复：
 *  - 登录接口此前走 `post(..., false)`：needAuth=false 但 silent 仍是 false，
 *    于是「密码错误」会同时弹 request 层 toast + 行内 errorMsg（同一句话两遍）。
 *    现在传 `{ needAuth: false, silent: true }`，只保留行内错误提示。
 *  - catch 里直接把 `e.message` 显示给用户：后端/浏览器抛英文时用户看不懂。
 *    现在统一翻译成「学号不存在 / 密码错误 / 网络失败」，英文原文不外露。
 *  - 补「忘记密码 / 验证码登录」入口与首次使用说明（初始密码 123456）。
 *  - 硬编码 #fff / #1a3a5c / #2d7ff9 + 浅色文字在暗色主题下卡片是白底白字 → 换设计令牌。
 *  - emoji 图标（🎓👁️🙈）换 AppIcon，按钮换 BaseButton，字段换 FormField。
 */
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { post } from '@/utils/request'
import type { LoginResult } from '@/api/auth'
import { showToast } from '@/utils/ui'
import AppIcon from '@/components/ui/AppIcon.vue'
import FormField from '@/components/ui/FormField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const studentId = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const canLogin = computed(() => studentId.value.trim().length > 0 && password.value.length > 0)

/** 把网络/后端错误翻译成用户看得懂的具体原因（禁止把英文原文抛给用户） */
function friendlyLoginError(e: unknown, accountLabel: string): string {
  const err = e as { code?: string; status?: number; message?: string } | null
  const code = err?.code || ''
  const status = Number(err?.status || 0)
  const raw = String(err?.message || '')
  if (code === 'TIMEOUT') return '请求超时，请检查网络后重试'
  if (code === 'NETWORK' || status === 0) return '网络连接失败，请检查网络后重试'
  if (status === 404 || /不存在|未找到|未注册|not\s*found/i.test(raw)) {
    return `${accountLabel}不存在，请核对后重试`
  }
  // 后端返回中文原因时原样展示（如「学号或密码错误」），其余一律翻译成中文（不暴露英文原文）
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw
  if (status === 401 || status === 403 || /密码|password|凭证|credential/i.test(raw)) {
    return '密码错误，请重新输入'
  }
  return '登录失败，请稍后重试'
}

async function handleLogin() {
  if (!canLogin.value || loading.value) return
  errorMsg.value = ''
  loading.value = true
  try {
    // needAuth:false —— 登录接口不需要 token；silent:true —— 失败只走行内提示，不叠加全局 toast
    const result = await post<LoginResult>(
      '/api/auth/login-with-password',
      { student_id: studentId.value.trim(), password: password.value },
      { needAuth: false, silent: true },
    )
    if (!result?.success || !result.token) {
      errorMsg.value = '登录失败，请稍后重试'
      return
    }
    userStore.setTokenAndProfile(result.token, result.user)
    showToast('登录成功', 'success')
    // 重定向到原本要访问的页面，或首页
    const redirect = (route.query.redirect as string) || '/pages/index/index'
    setTimeout(() => router.replace(redirect), 500)
  } catch (e) {
    errorMsg.value = friendlyLoginError(e, '学号')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo"><AppIcon name="shield" :size="30" /></div>
      <h1>区队管理系统</h1>
      <p>请输入学号和密码登录</p>
    </div>
    <div class="login-card">
      <FormField label="学号" required>
        <input
          v-model="studentId"
          type="text"
          placeholder="请输入学号"
          maxlength="20"
          autocomplete="username"
          @keyup.enter="handleLogin"
        />
      </FormField>
      <FormField label="密码" required>
        <div class="password-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
          <button
            class="toggle-pw"
            type="button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <AppIcon :name="showPassword ? 'eye-off' : 'eye'" :size="20" />
          </button>
        </div>
      </FormField>

      <p v-if="errorMsg" class="error-text" role="alert">
        <AppIcon name="alert-circle" :size="15" />
        <span>{{ errorMsg }}</span>
      </p>

      <BaseButton block size="lg" :loading="loading" :disabled="!canLogin" @click="handleLogin">
        {{ loading ? '登录中…' : '登录' }}
      </BaseButton>

      <div class="login-extra">
        <span class="extra-label">忘记密码 / 验证码登录：</span>
        <router-link to="/pages/login/phone-login">手机号</router-link>
        <span class="divider">·</span>
        <router-link to="/pages/login/email-login">邮箱</router-link>
      </div>

      <p class="first-use">初始密码为 123456，首次登录后请在「我的 → 设置」修改</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--color-hero-from) 0%, var(--color-hero-to) 100%);
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
  background: rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-on-primary);
  margin-bottom: 16px;
}
h1 { font-size: 24px; font-weight: 700; color: var(--color-text-on-primary); margin-bottom: 6px; }
.login-header p { font-size: 14px; color: var(--color-text-on-primary); opacity: 0.7; }

.login-card {
  background: var(--color-surface);
  border-radius: 16px 16px 0 0;
  padding: 32px 24px 40px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.password-wrap { position: relative; }
.password-wrap input { padding-right: 52px; }
.toggle-pw {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-text-3);
  padding: 0;
  line-height: 1;
}

.error-text {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -6px 0 0;
  color: var(--color-error);
  font-size: 13px;
  line-height: 1.4;
}

.login-extra {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-2);
}
.login-extra a { color: var(--color-accent); text-decoration: none; }
.login-extra .divider { margin: 0 6px; color: var(--color-border); }

.first-use {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text-3);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}
</style>
