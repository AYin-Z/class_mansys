# 注册页面 Bug 修复 Spec

## Why
注册页面存在两个关键 Bug：微信快速登录无法获取用户信息、身份信息下拉选择器无法弹出，导致用户无法完成注册流程。

## What Changes
- **修复微信快速登录**：移除已废弃的 `uni.getUserProfile()` 调用，改用 `uni.login()` + 后端 `loginWithCode` API 的标准登录流程
- **修复下拉选择器**：将 `<picker>` 组件从独立渲染改为包裹触发元素的模式，确保点击时能正常弹出选择面板

## Impact
- Affected code: `src/pages/auth/register.vue`
- Affected APIs: `src/api/auth.ts`（已有 `loginWithCode`，无需修改）

## ADDED Requirements

### Requirement: 微信快速登录功能
系统 SHALL 在注册页面提供微信快速登录功能，使用 `uni.login()` 获取 code 后发送到后端换取 openid，而非使用已废弃的 `getUserProfile` API。

#### Scenario: 微信快速登录成功
- **WHEN** 用户点击"微信快速登录"按钮
- **THEN** 调用 `uni.login()` 获取临时 code
- **AND** 将 code 发送到后端 `/api/auth/login` 接口
- **AND** 后端返回 openid 和用户信息
- **AND** 若用户已注册，直接跳转首页；若未注册，将 openid 预填到表单中

#### Scenario: 微信快速登录失败
- **WHEN** `uni.login()` 调用失败或后端返回错误
- **THEN** 显示错误提示"登录失败，请重试"
- **AND** 用户仍可通过手动填写表单完成注册

### Requirement: 身份信息下拉选择器
系统 SHALL 在注册页面的身份信息区域提供可正常弹出的下拉选择器，包括性别、政治面貌、班级职务、班级、管理员角色。

#### Scenario: 点击选择器弹出选项
- **WHEN** 用户点击任意 picker-row 区域（如"性别"、"政治面貌"等）
- **THEN** 对应的 `<picker>` 组件立即弹出选择面板
- **AND** 用户选择后值正确回填到表单

#### Scenario: 选择器值回显
- **WHEN** 用户已选择某个选项
- **THEN** picker-row 中显示已选值而非占位文字
- **AND** 已选值以深色文字显示，未选时以灰色占位文字显示

## MODIFIED Requirements

### Requirement: 微信快速登录实现方式
**原实现**：使用 `uni.getUserProfile()` + `wx.cloud.callFunction()` 获取用户信息
**新实现**：使用 `uni.login()` + `loginWithCode()` API 获取 openid，用户信息通过表单手动填写

### Requirement: Picker 组件渲染方式
**原实现**：`<picker>` 作为独立元素放在模板底部，通过 `v-if` 控制显示，点击 picker-row 设置 `showXxxPicker = true`
**新实现**：`<picker>` 包裹 picker-row 内容，始终渲染，点击自动弹出选择面板
