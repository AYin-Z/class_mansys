# arch-insight Intake — class_mansys

## Analysis Subject

- **研究主体**：class_mansys（区队管理系统），单一仓库，前端 + 后端同仓
- **参考来源**：本地路径 `~/Current_Works/class_mansys/`，GitHub `AYin-Z/class_mansys`（main 分支）
- **覆盖范围**：全仓库，重点关注后端分层架构、前端分层架构、认证双轨设计、权限矩阵
- **延后范围**：部署细节（CloudBase 配置）、迁移脚本、Node 模块

## Project Type Judgment

- **更像**：全栈业务系统，multi-page App（非 SPA 框架，是 uni-app 的路由体系）
- **判断依据**：18 个业务模块、75+ 端点、25 张表、MVC 后端、双轨认证、多端编译

## Priority Entry Points

1. `src/constants/roles.ts` — 权限矩阵定义，系统的简化灵魂，一通百通
2. `src/utils/request.ts` + `cloudbase.ts` — 认证双轨如何衔接
3. `backend/app.js` — 后端中间件链与路由注册
4. `backend/middleware/auth.js` — JWT 校验与权限守卫
5. `backend/controllers/FeeController.js` — 最复杂的业务模块（班费 9 个页面）

## Recommended Path

`01_intake -> 02_brain_dump -> 04_architecture_report`（单仓库 Analysis Package，无需生态扩展）

## Key Findings

- 认证双轨（CloudBase 面客 + JWT 鉴权）是系统最核心的设计决策
- 权限矩阵集中定义在 `constants/roles.ts`，前后端共享编码
- MVC 分层清晰，但存在历史遗留（`utils/auth.js` 中文字符串比较耦合）
- 25 张表中 operation_logs 是写操作审计的设计亮点
- 18 个模块中班费模块最复杂（收缴/申请/审批/公示/报销/投票）
