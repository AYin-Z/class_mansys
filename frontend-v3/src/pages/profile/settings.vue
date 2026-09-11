<script setup lang="ts">
/**
 * 设置（个人资料 / 修改密码 / 外观 / 退出 / 检查更新）
 *
 * 2026-09（B7）修复：
 *  - 密码修改失败一律弹「修改失败」（后端已说明是「原密码错误」）→ 字段级错误提示，
 *    并改传 silent:true，避免 request 层 toast 与行内提示重复。
 *  - 资料保存 / 检查更新失败用 toastIfNotNotified()，不再用泛化文案覆盖后端原因。
 *  - 退出登录无二次确认（移动端误触即退出）→ showConfirm，写清后果。
 *  - emoji（🌙/☀️）→ AppIcon；手写 .btn 样式 → BaseButton；字段 → FormField。
 *  - 去掉手写 80px 底部避让（App.vue 已统一 calc(var(--tabbar-h) + safe-area)）。
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { updateUser } from '@/api/user'
import { getLatestVersion } from '@/api/app'
import { post, toastIfNotNotified } from '@/utils/request'
import { APP_VERSION, hasUpdate } from '@/utils/version'
import { currentTheme, toggleTheme } from '@/utils/theme'
import NavBar from '@/components/ui/NavBar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormField from '@/components/ui/FormField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { showConfirm, showToast } from '@/utils/ui'

const router = useRouter()
const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

// 暗色模式（主题状态由 utils/theme.ts 统一管理，main.ts 启动时已应用）
const isDark = ref(currentTheme() === 'dark')
function toggleDark() {
  isDark.value = toggleTheme() === 'dark'
}

// 个人资料
const name = ref('')
const phone = ref('')
const email = ref('')
const saving = ref(false)

onMounted(() => {
  if (profile.value) {
    name.value = profile.value.name || ''
    phone.value = profile.value.phone || ''
    email.value = profile.value.email || ''
  }
})

async function handleSaveProfile() {
  if (saving.value) return
  if (!profile.value?.id) {
    showToast('用户信息异常，请重新登录后再试', 'error')
    return
  }
  saving.value = true
  try {
    const res = await updateUser(profile.value.id, {
      name: name.value,
      phone: phone.value,
      email: email.value,
    })
    if (res.success) {
      userStore.setProfile({ ...profile.value, ...res.user })
      showToast('资料已保存', 'success')
    } else {
      showToast('保存失败，请稍后重试', 'error')
    }
  } catch (e) {
    // 请求层已弹过后端原因（如「手机号已被使用」）时不再覆盖
    toastIfNotNotified(e, '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

// 修改密码
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)
const pwErrors = ref<Record<string, string>>({})

function validatePassword(): boolean {
  const e: Record<string, string> = {}
  if (!oldPassword.value) e.old = '请输入原密码'
  if (!newPassword.value) e.new = '请输入新密码'
  else if (newPassword.value.length < 6) e.new = '新密码至少 6 位'
  if (!confirmPassword.value) e.confirm = '请再次输入新密码'
  else if (newPassword.value && confirmPassword.value !== newPassword.value) e.confirm = '两次输入的密码不一致'
  pwErrors.value = e
  return Object.keys(e).length === 0
}

/** 后端对「原密码错误」的说明要落到原密码字段上，而不是一句泛化的「修改失败」 */
function passwordErrorText(e: unknown): string {
  const err = e as { code?: string; status?: number; message?: string } | null
  const code = err?.code || ''
  const status = Number(err?.status || 0)
  const raw = String(err?.message || '')
  if (code === 'TIMEOUT') return '请求超时，请检查网络后重试'
  if (code === 'NETWORK' || status === 0) return '网络连接失败，请检查网络后重试'
  if (/原密码|旧密码|current\s*password|old\s*password/i.test(raw)) return '原密码不正确，请重新输入'
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw
  return '修改失败，请稍后重试'
}

async function handleChangePassword() {
  if (changing.value) return
  if (!validatePassword()) return
  changing.value = true
  try {
    // 页面级传 silent:true：失败只保留字段级提示，不叠加全局 toast
    const res = await post<{ success: boolean; message?: string }>(
      '/api/auth/change-password',
      { old_password: oldPassword.value, new_password: newPassword.value },
      { silent: true },
    )
    if (res.success) {
      showToast('密码修改成功', 'success')
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      pwErrors.value = {}
    } else {
      pwErrors.value = { old: res.message || '修改失败，请稍后重试' }
    }
  } catch (e) {
    pwErrors.value = { old: passwordErrorText(e) }
  } finally {
    changing.value = false
  }
}

// 检查更新
const checkingUpdate = ref(false)
const updateInfo = ref<{ versionName: string; downloadUrl: string; changelog: string; apkSize: number; forceUpdate: boolean } | null>(null)
// 已是最新版本（避免"点了检查更新永远显示有新版本"的误导）
const upToDate = ref(false)

async function checkUpdate() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  updateInfo.value = null
  upToDate.value = false
  try {
    const res = await getLatestVersion()
    if (res.success && res.data) {
      if (hasUpdate(res.data.versionName)) {
        updateInfo.value = res.data
      } else {
        upToDate.value = true
        showToast(`已是最新版本 v${APP_VERSION}`, 'success')
      }
    } else {
      showToast('获取版本信息失败，请稍后重试', 'error')
    }
  } catch (e) {
    toastIfNotNotified(e, '检查更新失败，请稍后重试')
  } finally {
    checkingUpdate.value = false
  }
}

// APK 下载：Capacitor 把 '_system' 交给系统浏览器打开（App 内 WebView 直接跳转会留在壳里甚至无反应），
// H5 下与普通新开标签页等价。
function downloadApk() {
  const url = updateInfo.value?.downloadUrl
  if (!url) return
  const win = window.open(url, '_system')
  if (!win) window.location.href = url
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 安全退出
async function handleLogout() {
  const ok = await showConfirm('退出登录', '确定要退出当前账号吗？', {
    danger: true,
    confirmText: '退出登录',
    hint: '退出后需要重新输入学号和密码才能继续使用',
  })
  if (!ok) return
  userStore.logout()
  router.push('/pages/login/password-login')
}
</script>

<template>
  <div class="settings-page">
    <NavBar title="设置" show-back />

    <!-- 个人资料 -->
    <div class="section">
      <div class="section-title">个人资料</div>
      <div class="card">
        <FormField label="姓名">
          <input v-model="name" placeholder="请输入姓名" />
        </FormField>
        <FormField label="手机号">
          <input v-model="phone" placeholder="请输入手机号" type="tel" />
        </FormField>
        <FormField label="邮箱">
          <input v-model="email" placeholder="请输入邮箱" type="email" />
        </FormField>
      </div>
      <BaseButton block class="action" :loading="saving" @click="handleSaveProfile">
        {{ saving ? '保存中…' : '保存' }}
      </BaseButton>
    </div>

    <!-- 修改密码 -->
    <div class="section">
      <div class="section-title">修改密码</div>
      <div class="card">
        <FormField label="原密码" required :error="pwErrors.old">
          <input v-model="oldPassword" placeholder="请输入原密码" type="password" autocomplete="current-password" />
        </FormField>
        <FormField label="新密码" required :error="pwErrors.new" hint="至少 6 位">
          <input v-model="newPassword" placeholder="请输入新密码" type="password" autocomplete="new-password" />
        </FormField>
        <FormField label="确认密码" required :error="pwErrors.confirm">
          <input v-model="confirmPassword" placeholder="请再次输入新密码" type="password" autocomplete="new-password" />
        </FormField>
      </div>
      <BaseButton block class="action" :loading="changing" @click="handleChangePassword">
        {{ changing ? '修改中…' : '修改密码' }}
      </BaseButton>
    </div>

    <!-- 外观设置 -->
    <div class="section">
      <div class="section-title">外观设置</div>
      <div class="card card-tight">
        <div class="toggle-row" role="switch" :aria-checked="isDark" @click="toggleDark">
          <span class="toggle-label">
            <AppIcon :name="isDark ? 'moon' : 'sun'" :size="18" />
            {{ isDark ? '暗色模式' : '亮色模式' }}
          </span>
          <span class="toggle" :class="{ on: isDark }"></span>
        </div>
      </div>
    </div>

    <!-- 安全退出 -->
    <div class="section">
      <div class="section-title">安全退出</div>
      <BaseButton block variant="danger" class="action" @click="handleLogout">退出登录</BaseButton>
    </div>

    <!-- 检查更新 -->
    <div class="section">
      <div class="section-title">检查更新</div>
      <div class="card card-tight">
        <div class="update-item">
          <span class="update-label">当前版本</span>
          <span class="update-value">v{{ APP_VERSION }}</span>
        </div>
      </div>
      <BaseButton
        v-if="!updateInfo"
        block
        class="action"
        :loading="checkingUpdate"
        @click="checkUpdate"
      >
        {{ checkingUpdate ? '检查中…' : upToDate ? '已是最新版本' : '检查更新' }}
      </BaseButton>
      <template v-if="updateInfo">
        <div class="card update-card">
          <div class="update-badge">发现新版本 {{ updateInfo.versionName }}</div>
          <div class="update-size">大小：{{ formatSize(updateInfo.apkSize) }}</div>
          <div class="update-changelog-title">更新内容</div>
          <pre class="update-changelog">{{ updateInfo.changelog }}</pre>
          <BaseButton block class="download-btn" @click="downloadApk">下载并安装</BaseButton>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 底部避让由 App.vue 统一处理（calc(var(--tabbar-h) + safe-area)） */
.settings-page {
  min-height: 100vh;
  background: transparent;
}

.section {
  padding: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 10px;
  padding-left: 4px;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-tight { gap: 0; padding: 0 16px; }
.action { margin-top: 12px; }

/* 检查更新 */
.update-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
}
.update-label { font-size: 14px; color: var(--color-text); }
.update-value { font-size: 14px; color: var(--color-text-2); }
.update-card { margin-top: 12px; display: block; }
.update-badge {
  display: inline-block;
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
}
.update-size { font-size: 13px; color: var(--color-text-2); margin-bottom: 12px; }
.update-changelog-title { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.update-changelog {
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  margin-bottom: 12px;
}

.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  min-height: 52px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--color-text);
}
.toggle-label { display: inline-flex; align-items: center; gap: 8px; }
.toggle {
  width: 48px; height: 28px; border-radius: 14px; background: var(--color-border);
  position: relative; transition: background 0.2s; flex-shrink: 0;
}
.toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 22px; height: 22px; border-radius: 50%; background: var(--color-text-on-primary);
  transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.toggle.on { background: var(--color-accent); }
.toggle.on::after { transform: translateX(20px); }
</style>
