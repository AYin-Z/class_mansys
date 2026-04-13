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
          <view class="picker-row" @click="showGenderPicker = true">
            <text class="input-label">性别</text>
            <view class="picker-value">
              <text :class="['value-text', { placeholder: !formData.genderLabel }]">{{ formData.genderLabel || '请选择性别' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
          <view class="input-divider"></view>

          <view class="picker-row" @click="showPoliticalPicker = true">
            <text class="input-label">政治面貌</text>
            <view class="picker-value">
              <text :class="['value-text', { placeholder: !formData.politicalStatus }]">{{ formData.politicalStatus || '请选择政治面貌' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
          <view class="input-divider"></view>

          <view class="picker-row" @click="showClassPositionPicker = true">
            <text class="input-label">班级职务</text>
            <view class="picker-value">
              <text :class="['value-text', { placeholder: !formData.classPosition }]">{{ formData.classPosition || '请选择班级职务' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
          <view class="input-divider"></view>

          <view class="input-wrapper">
            <text class="input-label">学校组织职务</text>
            <input class="ghost-input" placeholder="如无则留空" v-model="formData.schoolPosition" />
          </view>
          <view class="input-divider"></view>

          <view class="picker-row" @click="showClassPicker = true">
            <text class="input-label">班级</text>
            <view class="picker-value">
              <text :class="['value-text', { placeholder: !formData.className }]">{{ formData.className || '请选择班级' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
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
          <view class="picker-row mt-md" @click="showAdminRolePicker = true">
            <text class="input-label">选择管理员角色</text>
            <view class="picker-value">
              <text :class="['value-text highlight', { placeholder: !formData.adminRole }]">{{ formData.adminRole || '请选择角色' }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bottom-action">
      <button class="primary-btn" @click="onSubmit">
        <text class="btn-text">完成注册</text>
      </button>
    </view>

    <picker mode="selector" :range="genderOptions" @change="onGenderChange" v-if="showGenderPicker" :value="genderIndex"></picker>
    <picker mode="selector" :range="politicalStatuses" @change="onPoliticalStatusChange" v-if="showPoliticalPicker" :value="politicalIndex"></picker>
    <picker mode="selector" :range="classPositions" @change="onClassPositionChange" v-if="showClassPositionPicker" :value="classPositionIndex"></picker>
    <picker mode="selector" :range="classes" range-key="name" @change="onClassChange" v-if="showClassPicker" :value="classIndex"></picker>
    <picker mode="selector" :range="adminRoles" @change="onAdminRoleChange" v-if="showAdminRolePicker && showAdminRoleSelector" :value="adminRoleIndex"></picker>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { encodeBase64 } from '@/utils/auth.js'

// 微信登录函数
function wechatLogin() {
  uni.showLoading({ title: '登录中...' })
  
  // 调用微信登录接口
  uni.login({
    success: (loginRes) => {
      if (loginRes.code) {
        // 获取用户信息
        uni.getUserProfile({
          desc: '用于完善用户信息',
          success: (userInfoRes) => {
            // 调用云函数进行登录
            if (typeof wx !== 'undefined' && wx.cloud) {
              wx.cloud.callFunction({
                name: 'login',
                data: {
                  code: loginRes.code,
                  userInfo: userInfoRes.userInfo
                },
                success: (res) => {
                  uni.hideLoading()
                  if (res.result.success) {
                    const user = res.result.user
                    // 保存用户信息
                    uni.setStorageSync('userInfo', JSON.stringify(user))
                    uni.setStorageSync('isRegistered', true)
                    
                    uni.showToast({ title: '登录成功', icon: 'success' })
                    
                    setTimeout(() => {
                      uni.switchTab({ url: '/pages/index/index' })
                    }, 1500)
                  } else {
                    uni.showToast({ title: res.result.message || '登录失败', icon: 'none' })
                  }
                },
                fail: (err) => {
                  uni.hideLoading()
                  console.error('云函数调用失败:', err)
                  uni.showToast({ title: '登录失败，请重试', icon: 'none' })
                }
              })
            } else {
              uni.hideLoading()
              uni.showToast({ title: '云开发未初始化', icon: 'none' })
            }
          },
          fail: (err) => {
            uni.hideLoading()
            console.error('获取用户信息失败:', err)
            uni.showToast({ title: '获取用户信息失败', icon: 'none' })
          }
        })
      } else {
        uni.hideLoading()
        uni.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    },
    fail: (err) => {
      uni.hideLoading()
      console.error('登录失败:', err)
      uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  })
}

const genderOptions = ['男', '女']
const politicalStatuses = ['群众', '共青团员', '中共预备党员', '中共党员']
const classPositions = ['无', '区队长', '生活副区', '学习副区', '心理副区', '团支书', '组织委员', '宣传委员']
const adminRoles = ['区队长', '生活副区', '学习副区', '心理副区', '团支书', '组织委员', '宣传委员']
const classes = [{ id: '202306', name: '数据警务技术六区' }]

const showGenderPicker = ref(false)
const showPoliticalPicker = ref(false)
const showClassPositionPicker = ref(false)
const showClassPicker = ref(false)
const showAdminRolePicker = ref(false)
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
  showGenderPicker.value = false
}

function onPoliticalStatusChange(e) {
  const idx = e.detail.value
  politicalIndex.value = idx
  formData.politicalStatus = politicalStatuses[idx]
  showPoliticalPicker.value = false
}

function onClassPositionChange(e) {
  const idx = e.detail.value
  classPositionIndex.value = idx
  formData.classPosition = classPositions[idx]
  showClassPositionPicker.value = false
}

function onClassChange(e) {
  const idx = e.detail.value
  classIndex.value = idx
  const selected = classes[idx]
  formData.classId = selected.id
  formData.className = selected.name
  showClassPicker.value = false
}

function onAdminRoleChange(e) {
  const idx = e.detail.value
  adminRoleIndex.value = idx
  formData.adminRole = adminRoles[idx]
  showAdminRolePicker.value = false
}

function onSubmit() {
  if (!formData.studentId) {
    uni.showToast({ title: '请输入学号', icon: 'none' })
    return
  }
  if (!formData.name) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  if (!formData.phone) {
    uni.showToast({ title: '请输入手机号码', icon: 'none' })
    return
  }
  if (!formData.email) {
    uni.showToast({ title: '请输入邮箱', icon: 'none' })
    return
  }
  if (!formData.classId) {
    uni.showToast({ title: '请选择班级', icon: 'none' })
    return
  }
  if (!formData.politicalStatus) {
    uni.showToast({ title: '请选择政治面貌', icon: 'none' })
    return
  }
  if (!formData.classPosition) {
    uni.showToast({ title: '请选择班级职务', icon: 'none' })
    return
  }

  uni.showLoading({ title: '注册中...' })

  setTimeout(() => {
    uni.hideLoading()

    const userInfo = {
      studentId: formData.studentId,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      gender: formData.gender,
      politicalStatus: formData.politicalStatus,
      classPosition: formData.classPosition,
      schoolPosition: formData.schoolPosition,
      classId: formData.classId,
      className: formData.className,
      isAdmin: !!formData.adminRole,
      adminRole: formData.adminRole,
      openid: 'o6zAJs7FCMRWfy6FW1sLtk3J7c2M',
      registeredAt: new Date().toISOString()
    }

    const encryptedUserInfo = {
      ...userInfo,
      studentId: encodeBase64(userInfo.studentId),
      phone: encodeBase64(userInfo.phone),
      email: encodeBase64(userInfo.email)
    }

    uni.setStorageSync('userInfo', encryptedUserInfo)
    uni.setStorageSync('isRegistered', true)

    uni.showToast({ title: '注册成功', icon: 'success' })

    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 1500)
  }, 1000)
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