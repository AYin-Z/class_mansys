# Tasks

- [x] Task 1: 修复编译阻断问题
  - [x] 1.1: 删除 src/pages.json 中的 JSON 注释
  - [x] 1.2: 合并 vite.config.ts 配置到 vite.config.js，移除有问题的 BigInt 插件
  - [x] 1.3: 合并 src/main.ts 全局组件注册到 src/main.js

- [x] Task 2: 修复缺失页面文件
  - [x] 2.1: 为 src/pages/expense/ 补充 .vue 文件
  - [x] 2.2: 在 src/pages.json 中注册 login 页面路径
  - [x] 2.3: 在 src/pages.json 中注册 pages/profile/profile

- [x] Task 3: 修复运行时逻辑错误
  - [x] 3.1: 修复 App.vue 中 checkLoginStatus 的 JSON.parse
  - [x] 3.2: 修复 auth.js 数据存取一致性

- [x] Task 4: 修复安全问题
  - [x] 4.1: 移除前端明文密码
  - [x] 4.2: User.update 字段白名单
  - [x] 4.3: CORS 配置
  - [x] 4.4: JWT_SECRET

- [x] Task 5: 修复数据库与代码不匹配
  - [x] 5.1: notices 表添加 priority/is_pinned
  - [x] 5.2: leaves 表添加 cancel_time

- [x] Task 6: 归档无关文件
  - [x] 6.1-6.9: 全部完成

- [x] Task 7: 完善 .gitignore
  - [x] 7.1-7.4: 全部完成

- [x] Task 8: 验证编译
  - [x] 8.1: 执行 npm run build:mp-weixin，编译成功
  - [x] 8.2: dist/build/mp-weixin/ 包含 app.js、app.json、app.wxss、pages/ 目录

- [x] Task 9: 修复编译过程中的额外问题
  - [x] 9.1: 安装缺失的 @dcloudio/uni-mp-weixin 依赖
  - [x] 9.2: 在 uni.scss 中补充设计系统变量（$surface, $primary, $spacing-*, $font-*, $radius-*, $shadow-*, $transition-*, $z-index-*, $on-surface-* 等）
  - [x] 9.3: 在 uni.scss 中补充设计系统 mixin（actionable-card, glass-effect）
  - [x] 9.4: index.html 引用改为 main.js
  - [x] 9.5: 恢复 index.html（uni-app 编译需要）

# Task Dependencies
- [Task 8] depends on [Task 1, Task 2, Task 5]
