# 项目健康度修复 Spec

## Why
项目存在 27 个问题，包括密钥泄露、编译配置冲突、缺失页面文件、数据库字段不匹配、根目录遗留无关文件等，导致项目无法正常编译为微信小程序，且存在安全隐患。

## What Changes
- 修复 pages.json 中的 JSON 注释（编译阻断问题）
- 删除 vite.config.js，保留功能更完整的 vite.config.ts
- 删除 src/main.js，保留功能更完整的 src/main.ts
- 为 expense 页面补充 .vue 文件或从 pages.json 移除
- 为 login 页面在 pages.json 中注册
- 修复 App.vue 中 JSON.parse 对对象的错误调用
- 为 notices 数据库表补充 priority 和 is_pinned 字段
- 移除 auth.js 中暴露的超级管理员密码和 getSuperAdminPassword 函数
- 完善 .gitignore 规则
- 将根目录无关遗留文件移动到 _legacy/ 目录
- 修复 User.update 的 SQL 注入风险
- 修复 CORS 配置
- **BREAKING**: 移除 getSuperAdminPassword 导出，前端调用方需适配

## Impact
- Affected specs: 用户认证、权限管理、编译构建
- Affected code: src/pages.json, src/App.vue, src/utils/auth.js, vite.config.js, src/main.js, backend/database_init.sql, backend/models/User.js, backend/app.js, .gitignore

## ADDED Requirements

### Requirement: 编译产物完整性
系统 SHALL 在执行 `npm run build:mp-weixin` 后，在 dist/build/mp-weixin/ 目录下生成完整的微信小程序文件结构，包括 app.js、app.json、app.wxss 和 pages/ 目录。

#### Scenario: 编译微信小程序
- **WHEN** 执行 `npm run build:mp-weixin`
- **THEN** dist/build/mp-weixin/ 目录包含 app.js、app.json、app.wxss 和所有注册页面的 wxml/wxss/js/json 文件

### Requirement: 无关文件归档
系统 SHALL 将根目录下不属于 uni-app 项目的遗留文件移动到 _legacy/ 目录，保持项目根目录整洁。

#### Scenario: 清理根目录
- **WHEN** 项目根目录存在原生小程序遗留文件（app.js, app.json, app.wxss, project.config.json 等）
- **THEN** 这些文件被移动到 _legacy/ 目录

### Requirement: SQL 注入防护
系统 SHALL 对 User.update 方法中的动态字段名做白名单校验，防止攻击者通过注入字段名提权。

#### Scenario: 更新用户信息
- **WHEN** 调用 User.update 传入 userData
- **THEN** 只有白名单中的字段（name, phone, email, nickName, avatarUrl, class_id）被允许更新

## MODIFIED Requirements

### Requirement: 用户登录状态检查
App.vue 中的 checkLoginStatus 函数 SHALL 正确处理 uni.getStorageSync 返回的对象，不再对对象调用 JSON.parse。

### Requirement: 超级管理员验证
超级管理员密码验证 SHALL 仅在服务端进行，前端 SHALL NOT 包含明文密码或 getSuperAdminPassword 函数。

## REMOVED Requirements

### Requirement: 前端暴露管理员密码
**Reason**: 安全风险，密码不应出现在前端代码中
**Migration**: 超级管理员验证逻辑迁移到后端 API
