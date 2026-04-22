<template>
  <view class="register-page">
    <view class="header-section">
      <view class="brand-bar"></view>
      <view class="header-content">
        <text class="title">用户注册</text>
        <text class="subtitle">完善个人信息以使用区队管理系统</text>
      </view>
    </view>

    <scroll-view scroll-y class="form-scroll">
      <view class="form-container">
        <!-- 微信登录按钮 -->
        <view class="wechat-login-section">
          <button class="wechat-btn" @click="wechatLogin">
            <text class="wechat-icon">💬</text>
            <text class="wechat-text">微信快速登录</text>
          </button>
        </view>

        <view class="divider-section">
          <view class="divider"></view>
          <text class="divider-text">或填写信息注册</text>
          <view class="divider"></view>
        </view>

        <view class="section-label">
          <text class="label-text">基本信息</text>
        </view>

        <view class="form-group">
          <view class="input-wrapper">
            <text class="input-label">学号</text>
            <input class="ghost-input" placeholder="请输入学号" v-model="formData.studentId" />
          </view>
          <view class="input-divider"></view>

          <view class="input-wrapper">
            <text class="input-label">真实姓名</text>
            <input class="ghost-input" placeholder="请输入真实姓名" v-model="formData.name" />
          </view>
          <view class="input-divider"></view>

          <view class="input-wrapper">
            <text class="input-label">手机号码</text>
            <input class="ghost-input" type="number" placeholder="请输入手机号码" v-model="formData.phone" />
          </view>
          <view class="input-divider"></view>

          <view class="input-wrapper">
            <text class="input-label">邮箱</text>
            <input class="ghost-input" type="text" placeholder="请输入邮箱" v-model="formData.email" />
          </view>
        </view>

        <view class="section-label mt-lg">
          <text class="label-text">身份信息</text>
        </view>

        <view class="form-group">
          <picker mode="selector" :range="genderOptions" @change="onGenderChange" :value="genderIndex">
            <view class="picker-row">
              <text class="input-label">性别</text>
              <view class="picker-value">
                <text :class="['value-text', { placeholder: !formData.genderLabel }]">{{ formData.genderLabel || '请选择性别' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>
          <view class="input-divider"></view>

          <picker mode="selector" :range="politicalStatuses" @change="onPoliticalStatusChange" :value="politicalIndex">
            <view class="picker-row">
              <text class="input-label">政治面貌</text>
              <view class="picker-value">
                <text :class="['value-text', { placeholder: !formData.politicalStatus }]">{{ formData.politicalStatus || '请选择政治面貌' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>
          <view class="input-divider"></view>

          <picker mode="selector" :range="classPositions" @change="onClassPositionChange" :value="classPositionIndex">
            <view class="picker-row">
              <text class="input-label">班级职务</text>
              <view class="picker-value">
                <text :class="['value-text', { placeholder: !formData.classPosition }]">{{ formData.classPosition || '请选择班级职务' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>
          <view class="input-divider"></view>

          <view class="input-wrapper">
            <text class="input-label">学校组织职务</text>
            <input class="ghost-input" placeholder="如无则留空" v-model="formData.schoolPosition" />
          </view>
          <view class="input-divider"></view>

          <picker mode="selector" :range="classes" range-key="name" @change="onClassChange" :value="classIndex">
            <view class="picker-row">
              <text class="input-label">班级</text>
              <view class="picker-value">
                <text :class="['value-text', { placeholder: !formData.className }]">{{ formData.className || '请选择班级' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>
        </view>

        <view class="admin-card" v-if="!showAdminRoleSelector">
          <view class="admin-header">
            <text class="admin-title">申请成为管理员（可选）</text>
          </view>
          <view class="input-wrapper mt-md">
            <text class="input-label">超级管理员密码</text>
            <input class="ghost-input" password placeholder="请输入超级管理员密码" v-model="superAdminPassword" @input="onPasswordInput" />
          </view>
        </view>

        <view class="admin-card active" v-if="showAdminRoleSelector">
          <view class="admin-header success">
            <text class="status-dot"></text>
            <text class="admin-title">身份验证通过</text>
          </view>
          <picker mode="selector" :range="adminRoles" @change="onAdminRoleChange" :value="adminRoleIndex">
            <view class="picker-row mt-md">
              <text class="input-label">选择管理员角色</text>
              <view class="picker-value">
                <text :class="['value-text highlight', { placeholder: !formData.adminRole }]">{{ formData.adminRole || '请选择角色' }}</text>
                <text class="arrow">›</text>
              </view>
            </view>
          </picker>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-action">
      <button class="primary-btn" @click="onSubmit">
        <text class="btn-text">完成注册</text>
      </button>
    </view>

  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { loginAndStoreToken, registerAndStoreToken } from '@/api/auth'
import { getClasses } from '@/api/classes'

const userStore = useUserStore()
const openid = ref('')

function persistProfileFromBackend(token, user) {
  userStore.setTokenAndProfile(token, {
    id: user.id,
    name: user.name || user.nickName || '未命名',
    nickName: user.nickName,
    student_id: user.student_id,
    class_id: user.class_id,
    role: typeof user.role === 'number' ? user.role : 0,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl
  })
  uni.setStorageSync('isRegistered', true)
}

async function wechatLogin() {
  uni.showLoading({ title: '登录中...' })
  try {
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({ success: resolve, fail: reject })
    })

    if (!loginRes.code) {
      uni.hideLoading()
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
      return
    }

    try {
      const result = await loginAndStoreToken({ code: loginRes.code })
      uni.hideLoading()

      if (result.success && result.token) {
        if (result.user && result.user.name) {
          persistProfileFromBackend(result.token, result.user)
          uni.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            uni.switchTab({ url: '/pages/index/index' })
          }, 1200)
        } else {
          openid.value = result.user?.id || ''
          uni.showToast({ title: '请完善信息完成注册', icon: 'none' })
        }
      } else {
        uni.showToast({ title: result.message || '登录失败', icon: 'none' })
      }
    } catch (apiErr) {
      uni.hideLoading()
      console.error('后端登录失败:', apiErr)
      uni.showToast({ title: '登录失败，请手动填写注册', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    console.error('微信登录失败:', err)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  }
}

const genderOptions = ['男', '女']
const politicalStatuses = ['群众', '共青团员', '中共预备党员', '中共党员']
const classPositions = ['无', '区队长', '生活副区', '学习副区', '心理副区', '团支书', '组织委员', '宣传委员']
const adminRoles = ['区队长', '生活副区', '学习副区', '心理副区', '团支书', '组织委员', '宣传委员']
// 班级列表改为后端动态加载，失败时回退到默认值（保证离线可用）
const classes = ref([
  { id: 'class001', name: '一区队' },
  { id: 'class002', name: '二区队' },
  { id: 'class003', name: '三区队' },
  { id: 'class004', name: '四区队' },
  { id: 'class005', name: '五区队' },
  { id: 'class006', name: '六区队' }
])

onMounted(async () => {
  try {
    const res = await getClasses()
    if (res?.success && Array.isArray(res.classes) && res.classes.length) {
      classes.value = res.classes
    }
  } catch (_) { /* 静默失败，使用本地回退 */ }
})

const showAdminRoleSelector = ref(false)
const superAdminPassword = ref('')
const currentAdminCount = ref(0)
const maxAdminCount = ref(7)

const genderIndex = ref(0)
const politicalIndex = ref(0)
const classPositionIndex = ref(0)
const classIndex = ref(0)
const adminRoleIndex = ref(0)

const formData = reactive({
  studentId: '',
  name: '',
  phone: '',
  email: '',
  gender: 1,
  genderLabel: '',
  politicalStatus: '',
  classPosition: '',
  schoolPosition: '',
  classId: '',
  className: '',
  adminRole: ''
})

function onPasswordInput(e) {
  const password = e.detail.value
  if (password === 'kskblzdjdwqzkbl') {
    if (currentAdminCount.value < maxAdminCount.value) {
      showAdminRoleSelector.value = true
    } else {
      uni.showToast({ title: '管理员数量已满', icon: 'none' })
    }
  } else {
    showAdminRoleSelector.value = false
  }
}

function onGenderChange(e) {
  const idx = e.detail.value
  genderIndex.value = idx
  formData.gender = parseInt(idx) + 1
  formData.genderLabel = genderOptions[idx]
}

function onPoliticalStatusChange(e) {
  const idx = e.detail.value
  politicalIndex.value = idx
  formData.politicalStatus = politicalStatuses[idx]
}

function onClassPositionChange(e) {
  const idx = e.detail.value
  classPositionIndex.value = idx
  formData.classPosition = classPositions[idx]
}

function onClassChange(e) {
  const idx = e.detail.value
  classIndex.value = idx
  const selected = classes.value[idx]
  if (!selected) return
  formData.classId = selected.id
  formData.className = selected.name
}

function onAdminRoleChange(e) {
  const idx = e.detail.value
  adminRoleIndex.value = idx
  formData.adminRole = adminRoles[idx]
}

// --- 有效性校验工具 ---
const STUDENT_ID_RE = /^[A-Za-z0-9]{4,20}$/          // 学号：4-20 位字母数字
const NAME_RE       = /^[\u4e00-\u9fa5A-Za-z·•\s]{2,20}$/ // 姓名：2-20 中英文
const PHONE_RE      = /^1[3-9]\d{9}$/                  // 大陆手机号
const EMAIL_RE      = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function validateForm() {
  // trim
  formData.studentId      = String(formData.studentId || '').trim()
  formData.name           = String(formData.name || '').trim()
  formData.phone          = String(formData.phone || '').trim()
  formData.email          = String(formData.email || '').trim()
  formData.schoolPosition = String(formData.schoolPosition || '').trim()

  if (!formData.studentId)            return '请输入学号'
  if (!STUDENT_ID_RE.test(formData.studentId)) return '学号应为 4-20 位字母或数字'
  if (!formData.name)                 return '请输入真实姓名'
  if (!NAME_RE.test(formData.name))   return '姓名只能包含中英文，2-20 位'
  if (!formData.phone)                return '请输入手机号码'
  if (!PHONE_RE.test(formData.phone)) return '手机号码格式不正确'
  if (!formData.email)                return '请输入邮箱'
  if (!EMAIL_RE.test(formData.email)) return '邮箱格式不正确'
  if (!formData.genderLabel)          return '请选择性别'
  if (!formData.politicalStatus)      return '请选择政治面貌'
  if (!formData.classPosition)        return '请选择班级职务'
  if (!formData.classId)              return '请选择班级'
  if (showAdminRoleSelector.value && !formData.adminRole) return '请选择管理员角色'
  return ''
}

function isDomainWhitelistError(err) {
  const msg = String(err?.message || err?.errMsg || '')
  return msg.includes('url not in domain list') || msg.includes('not in domain list')
}

async function onSubmit() {
  const invalidMsg = validateForm()
  if (invalidMsg) {
    uni.showToast({ title: invalidMsg, icon: 'none' })
    return
  }

  uni.showLoading({ title: '注册中...' })

  try {
    const result = await registerAndStoreToken({
      openid: openid.value || undefined,   // 微信登录链路给的 openid 优先
      student_id: formData.studentId,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      gender: formData.gender,
      class_id: formData.classId,
      role: formData.adminRole || 0,        // 后端识别中文角色名 → INT
      adminRole: formData.adminRole,
      nickName: formData.name
    })

    uni.hideLoading()

    if (result?.success && result.token && result.user) {
      persistProfileFromBackend(result.token, result.user)
      uni.showToast({
        title: result.reused ? '已识别已有账号，已登录' : '注册成功',
        icon: 'success'
      })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 1200)
    } else {
      uni.showToast({ title: result?.error || result?.message || '注册失败', icon: 'none' })
    }
  } catch (err) {
    uni.hideLoading()
    console.error('注册失败:', err)

    // 小程序域名白名单错误：给出专门的指引文案
    if (isDomainWhitelistError(err)) {
      uni.showModal({
        title: '后端域名未加入白名单',
        content: '当前小程序的 request 合法域名中不包含后端服务地址。请联系管理员在「微信公众平台 → 开发管理 → 开发设置 → 服务器域名」中添加 HTTPS 域名；开发期可在微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」临时解除。',
        showCancel: false,
        confirmText: '我知道了'
      })
      return
    }

    // request 已在非 silent 模式下弹过 toast，这里只兜底一次模态，方便用户感知
    uni.showModal({
      title: '注册失败',
      content: err?.message || '请检查网络或稍后再试',
      showCancel: false
    })
  }
}
</script>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  background-color: #f7f9fc;
  display: flex;
  flex-direction: column;
}

/* 微信登录 */
.wechat-login-section {
  padding: 32rpx;
}

.wechat-btn {
  width: 100%;
  height: 96rpx;
  background: #07C160;
  border-radius: 20rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-shadow: 0 8rpx 32rpx rgba(7, 193, 96, 0.25);
  
  &:active {
    transform: scale(0.98);
  }
}

.wechat-icon {
  font-size: 48rpx;
}

.wechat-text {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 分隔线 */
.divider-section {
  display: flex;
  align-items: center;
  padding: 0 32rpx 32rpx;
  gap: 24rpx;
}

.divider {
  flex: 1;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(195, 198, 209, 0.5), transparent);
}

.divider-text {
  font-size: 24rpx;
  color: #999999;
  white-space: nowrap;
}

.header-section {
  position: relative;
  padding: 48rpx 32rpx 40rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
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
  color: #ffffff;
  letter-spacing: -0.5rpx;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
}

.form-scroll {
  flex: 1;
  padding-bottom: 140rpx;
}

.form-container {
  padding: 32rpx;
}

.section-label {
  margin-bottom: 20rpx;
  padding-left: 4rpx;
}

.label-text {
  font-size: 22rpx;
  font-weight: 600;
  color: #43474f;
  text-transform: uppercase;
  letter-spacing: 4rpx;
}

.form-group {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.input-wrapper {
  padding: 28rpx 24rpx;
}

.input-label {
  display: block;
  font-size: 24rpx;
  font-weight: 500;
  color: #191c1e;
  margin-bottom: 12rpx;
}

.ghost-input {
  width: 100%;
  height: 52rpx;
  font-size: 30rpx;
  color: #191c1e;
  border: none;
  border-bottom: 2rpx solid rgba(195, 198, 209, 0.2);
  background: transparent;
  padding: 0;

  &:focus {
    border-bottom-color: #001e40;
  }

  &::placeholder {
    color: #c3c6d1;
  }
}

.input-divider {
  height: 1rpx;
  margin-left: 24rpx;
  margin-right: 24rpx;
  background: transparent;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
}

.picker-value {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.value-text {
  font-size: 30rpx;
  color: #191c1e;

  &.placeholder {
    color: #c3c6d1;
  }

  &.highlight {
    color: #001e40;
    font-weight: 500;
  }
}

.arrow {
  font-size: 36rpx;
  color: #c3c6d1;
}

.mt-md {
  margin-top: 20rpx;
}

.mt-lg {
  margin-top: 48rpx;
}

.admin-card {
  margin-top: 32rpx;
  background: #f2f4f7;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;

  &.active {
    background: linear-gradient(135deg, rgba(0, 30, 64, 0.06) 0%, rgba(0, 51, 102, 0.04) 100%);
    border-left: 6rpx solid #001e40;
  }
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 10rpx;

  &.success {
    .status-dot {
      width: 14rpx;
      height: 14rpx;
      border-radius: 50%;
      background: #003366;
    }
  }
}

.admin-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #43474f;
}

.bottom-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  z-index: 100;
}

.primary-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #001e40 0%, #003366 100%);
  border-radius: 20rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 30, 64, 0.25);

  &:active {
    transform: scale(0.98);
  }
}

.btn-text {
  font-family: 'PingFang SC', sans-serif;
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}
</style>