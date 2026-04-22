# Tasks

- [x] Task 1: 修复微信快速登录功能
  - [x] 1.1: 移除 `uni.getUserProfile()` 和 `wx.cloud.callFunction()` 调用
  - [x] 1.2: 改用 `uni.login()` + `loginAndStoreToken()` API 实现登录流程
  - [x] 1.3: 登录成功后判断用户是否已注册，已注册则跳转首页，未注册则预填 openid
  - [x] 1.4: 添加登录失败的错误处理和用户提示

- [x] Task 2: 修复身份信息下拉选择器
  - [x] 2.1: 将所有 `<picker>` 组件改为包裹 picker-row 的模式
  - [x] 2.2: 移除 `showXxxPicker` 相关的 ref 变量和 v-if 条件
  - [x] 2.3: 移除 picker-row 上的 `@click` 事件（由 picker 组件自动处理）
  - [x] 2.4: 确保选择后值正确回填到 formData

# Task Dependencies
- Task 1 和 Task 2 无依赖关系，可并行执行
