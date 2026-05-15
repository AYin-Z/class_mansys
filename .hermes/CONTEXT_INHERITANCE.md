# Context Inheritance

## Current Task
class_mansys 白屏根因诊断与修复 — 排查完成。

## Progress (2026-05-15)
- ✅ 清理全部构建缓存，从零重建
- ✅ 将 `main.ts` 从动态导入 `import("@dcloudio/uni-h5")` 改为**静态导入** + 直接挂载
- ✅ uni-h5 插件代码直接打包进主入口 chunk，不再依赖异步 chunk 加载
- ✅ 构建通过，服务端已更新
- ✅ git commit + push

## Root Cause (推测)
白屏原因是动态导入 `import("@dcloudio/uni-h5")` 在某些浏览器上不稳定：
- Safari/旧版浏览器对动态 `import()` 的支持存在差异
- 异步 chunk 加载可能在 `app.mount()` 前未完成
- `fix-vue-ssr-export` 插件可能未正确应用于动态导入的子 chunk

## Key Paths
- 项目: /home/ayin/Current_Works/class_mansys
- 后端: PORT=3002 后台进程运行中
- 前端: https://cls.ayinserver.xin/
- 主入口: src/main.ts (已改为静态导入 + 直接 mount)
- Vite 配置: vite.config.ts (fix-vue-ssr-export 插件暂保留)

## Next Steps
1. 用户用手机/浏览器访问 https://cls.ayinserver.xin/ 测试
2. 如果还白屏，打开浏览器 DevTools Console 查看错误并反馈
3. 若修复成功，清理 vite.config.ts 中不必要的兼容插件
4. 将 dist/ 添加到 .gitignore
