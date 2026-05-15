# Context Inheritance

## Current Task
class_mansys 高优先级修复计划 — 全部完成。

## Progress
- ✅ P0: 路由守卫 composable + onShow 触发 + setRouteGuard 401 联动
- ✅ P1: composables 层搭建（useSystemInfo / useDateTime / useNoticeUtils）
- ✅ P2: 设计系统规范化（6 个文件注入 SCSS 令牌）
- ✅ P3: show-captcha 改用 defineEmits
- ✅ P4: 首屏阻塞消除（cloudbase fire-and-forget）
- ✅ P5: 类型安全渐进提升（lang=ts + auth.js 标记 @deprecated）
- ✅ P6: 巨型首页拆分（5 个子组件）

## Key Paths
- 项目: /home/ayin/Current_Works/class_mansys
- 后端: PORT=3002 后台进程 (verify with curl -sI http://127.0.0.1:3002/)
- 前端: https://cls.ayinserver.xin/
- 构建: dist/build/h5/

## Next Steps
1. **验证 H5 是否正常渲染** — 需用户浏览器访问 https://cls.ayinserver.xin/
2. 考略收藏的 Sprint 计划中的新增功能（4 张新表 + 后端扩展）
3. 若白屏仍有问题，检查浏览器 console 错误日志
