<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'
import { updateUser } from '@/api/user'
import { changePassword } from '@/api/auth'
import { getLatestVersion } from '@/api/app'
import { APP_VERSION, hasUpdate } from '@/utils/version'
import NavBar from '@/components/ui/NavBar.vue'
import { showToast } from '@/utils/ui'

const router = useRouter()
const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

// 暗色模式
const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')
function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
// 初始化时读取
const saved = localStorage.getItem('theme')
if (saved) {
  isDark.value = saved === 'dark'
  document.documentElement.setAttribute('data-theme', saved)
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
  if (!profile.value?.id) {
    showToast('用户信息异常', 'error')
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
      showToast('保存成功', 'success')
    } else {
      showToast('保存失败', 'error')
    }
  } catch {
    showToast('保存失败', 'error')
  } finally {
    saving.value = false
  }
}

// 修改密码
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changing = ref(false)

async function handleChangePassword() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    showToast('请填写完整', 'error')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    showToast('两次密码不一致', 'error')
    return
  }
  if (newPassword.value.length < 6) {
    showToast('新密码至少6位', 'error')
    return
  }
  changing.value = true
  try {
    const res = await changePassword({
      old_password: oldPassword.value,
      new_password: newPassword.value,
    })
    if (res.success) {
      showToast('密码修改成功', 'success')
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } else {
      showToast(res.message || '修改失败', 'error')
    }
  } catch {
    showToast('修改失败', 'error')
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
      showToast('获取版本信息失败', 'error')
    }
  } catch {
    showToast('检查更新失败，请检查网络后重试', 'error')
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
function handleLogout() {
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
        <div class="field">
          <label class="field-label">姓名</label>
          <input v-model="name" class="field-input" placeholder="请输入姓名" />
        </div>
        <div class="divider"></div>
        <div class="field">
          <label class="field-label">手机号</label>
          <input v-model="phone" class="field-input" placeholder="请输入手机号" type="tel" />
        </div>
        <div class="divider"></div>
        <div class="field">
          <label class="field-label">邮箱</label>
          <input v-model="email" class="field-input" placeholder="请输入邮箱" type="email" />
        </div>
      </div>
      <button class="btn btn-primary" :disabled="saving" @click="handleSaveProfile">
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </div>

    <!-- 修改密码 -->
    <div class="section">
      <div class="section-title">修改密码</div>
      <div class="card">
        <div class="field">
          <label class="field-label">原密码</label>
          <input v-model="oldPassword" class="field-input" placeholder="请输入原密码" type="password" />
        </div>
        <div class="divider"></div>
        <div class="field">
          <label class="field-label">新密码</label>
          <input v-model="newPassword" class="field-input" placeholder="请输入新密码（至少6位）" type="password" />
        </div>
        <div class="divider"></div>
        <div class="field">
          <label class="field-label">确认密码</label>
          <input v-model="confirmPassword" class="field-input" placeholder="请再次输入新密码" type="password" />
        </div>
      </div>
      <button class="btn btn-primary" :disabled="changing" @click="handleChangePassword">
        {{ changing ? '修改中...' : '修改密码' }}
      </button>
    </div>

    <!-- 外观设置 -->
    <div class="section">
      <div class="section-title">外观设置</div>
      <div class="card">
        <div class="toggle-row" @click="toggleDark">
          <span>{{ isDark ? '🌙 暗色模式' : '☀️ 亮色模式' }}</span>
          <span class="toggle" :class="{ on: isDark }"></span>
        </div>
      </div>
    </div>

    <!-- 安全退出 -->
    <div class="section">
      <div class="section-title">安全退出</div>
      <button class="btn btn-danger" @click="handleLogout">退出登录</button>
    </div>

    <!-- 检查更新 -->
    <div class="section">
      <div class="section-title">检查更新</div>
      <div class="card">
        <div class="update-item">
          <span class="update-label">当前版本</span>
          <span class="update-value">v{{ APP_VERSION }}</span>
        </div>
      </div>
      <button v-if="!updateInfo" class="btn btn-primary" :disabled="checkingUpdate" @click="checkUpdate">
        {{ checkingUpdate ? '检查中...' : upToDate ? '已是最新版本' : '检查更新' }}
      </button>
      <template v-if="updateInfo">
        <div class="card update-card">
          <div class="update-badge">发现新版本 {{ updateInfo.versionName }}</div>
          <div class="update-size">大小：{{ formatSize(updateInfo.apkSize) }}</div>
          <div class="update-changelog-title">更新内容</div>
          <pre class="update-changelog">{{ updateInfo.changelog }}</pre>
          <button class="btn btn-primary download-btn" @click="downloadApk">下载并安装</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding-bottom: 80px;
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
  padding: 0 16px;
  box-shadow: var(--shadow-card);
}

.field {
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: 12px;
}

.field-label {
  font-size: 14px;
  color: var(--color-text);
  white-space: nowrap;
  width: 60px;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--color-text);
  padding: 12px 0;
}

.field-input::placeholder {
  color: var(--color-text-3);
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 0;
}

.btn {
  display: block;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: opacity 0.2s;
}

.btn:active {
  opacity: 0.8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
}

.btn-danger {
  background: var(--color-error);
  color: #fff;
}

/* 检查更新 */
.update-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  cursor: pointer;
}
.update-label { font-size: 14px; color: var(--color-text); }
.update-value { font-size: 14px; color: var(--color-text-2); }
.update-card { margin-top: 12px; padding: 16px; }
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
.download-btn { text-decoration: none; text-align: center; }

.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--color-text);
}
.toggle {
  width: 48px; height: 28px; border-radius: 14px; background: var(--color-border);
  position: relative; transition: background 0.2s;
}
.toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 22px; height: 22px; border-radius: 50%; background: #fff;
  transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle.on { background: var(--color-accent); }
.toggle.on::after { transform: translateX(20px); }
</style>
