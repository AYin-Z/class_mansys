# Context Inheritance

> **注意**: 此文件为历史诊断记录（2026-05-15），当时项目仍在使用 uni-app (`src/`)。
> 当前（2026-06）项目已完全迁移到 Vue 3 + Vite (`frontend-v3/`)，旧 `src/` 目录已移除。

## Current Task
class_mansys 白屏根因诊断与修复 — 排查完成（历史记录）。

## Progress (2026-05-15)
- ✅ 清理全部构建缓存，从零重建
- ✅ 将当时 `src/main.ts` 从动态导入 `import("@dcloudio/uni-h5")` 改为静态导入
- ✅ 构建通过，服务端已更新
- ✅ git commit + push

## Root Cause (推测，历史)
白屏原因是动态导入 `import("@dcloudio/uni-h5")` 在某些浏览器上不稳定。

## Key Paths (当前)
- 项目: /home/ayin/Current_Works/class_mansys
- 后端: PORT=3002, systemd 管理 (`class-mansys.service`)
- 前端: https://cls.ayinserver.xin/
- 主入口: **`frontend-v3/src/main.ts`** (Vue 3 + Vite + Vue Router)
- Vite 配置: `frontend-v3/vite.config.ts`
- Nginx 配置: `nginx-cls.conf`

## Next Steps
- 前端维护工作以 `frontend-v3/` 为准
- 旧 uni-app 代码已从 `main` 分支移除
