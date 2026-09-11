# 超管后台（中队管理控制台）

> 入口：`/admin/login` 登录后进入 `/admin/panel`；只有具备控制台权限的账号才能进入（默认系统管理员）。
> 本次重构把原来的「概览 / 成员 / 请假配置」三个 Tab 扩成 10 个模块，并把后端 `/api/admin/*` 从 5 个接口扩到完整控制台接口。

## 1. 模块一览

| 模块 | 能做什么 | 需要的权限 |
|---|---|---|
| 总览 | 中队规模、今日出勤/请假、待办入口、区队分布、近 7 日请假趋势、职务分布、助手使用量、最近操作 | VIEW_ROSTER |
| 内容与待办 | 请假/报销/作业/建议/心理/照片的待处理数量与一键跳转 | VIEW_ROSTER |
| 成员管理 | 查询筛选、编辑（姓名/学号/区队/职务/备注/类型）、重置密码、移出统计/恢复、批量操作、新增成员、无历史账号删除 | 查看=VIEW_ROSTER，写=MANAGE_MEMBERS |
| 名册导入 | 上传成绩表 xlsx → 预览 diff（新增/更新/移出）→ 确认导入 | MANAGE_MEMBERS |
| 区队与中队 | 新建/改名区队、改名中队、查看各区人数与区队长 | 查看=VIEW_ROSTER，写=MANAGE_MEMBERS |
| 请假配置 | 请假类型、允许时段、原因选项、启用状态 | MANAGE_LEAVE_CONFIG |
| 审计日志 | 按关键词/方法/状态码/时间筛选全部操作记录，导出 CSV，近 24h 错误统计 | VIEW_SYSTEM |
| 助手与渠道 | 模型模式、近 14 天用量、全部 MCP 令牌（可吊销）、微信绑定、工具调用 Top10 | VIEW_SYSTEM |
| 系统运维 | 服务/数据库状态、系统开关、备份（可一键触发）、近 24h 5xx、数据导出、定时任务、汇总文件 | VIEW_SYSTEM |
| 权限矩阵 | 29 个权限键 × 10 个角色的可视化配置，支持恢复默认 | MANAGE_PERMISSIONS |

## 2. 权限矩阵（可配置）

- 存储：表 `role_permissions(permission, role)`，迁移 `016_add_role_permissions.sql` 会把代码默认矩阵写入（INSERT IGNORE，不覆盖已有配置）；
- 运行时：服务启动时加载进内存（`shared/permissions.js`），后台保存后**立即刷新**，另有 30 秒兜底轮询，因此外部改库也能在 30 秒内生效；
- 兜底：表不存在或为空时自动回落到代码默认矩阵，系统不会因为权限表异常而瘫痪；
- 防锁死：`MANAGE_PERMISSIONS` 必须保留超管，移除会被拒绝（400）；
- 前端：`/api/auth/userinfo` 会返回该用户的权限快照（permissions），前端据此显示/隐藏入口（服务端仍会再校验一次）；
- 已接入的网关：路由统一用 `requirePermission(键)`（含中队视角 VIEW_COMPANY、班费审批 APPROVE_FEE_USE 等），后台改权限即可改变实际可操作范围。

## 3. 名册导入语义（以表为准）

1. 每个 sheet 对应一个区队（sheet 名需包含「一区」…「六区」）；
2. 表里有的人：系统没有 → 新建；已有 → 更新姓名/区队（若此前被移出统计，会自动恢复为在队）；
3. 表里没有、但系统里属于该区队的人 → **移出统计**（member_type='left'，历史数据保留，不计入出勤/名册/通知名单）；
4. **不改动职务（role）与职务备注（duty_note）**：成绩表里没有职务信息，不能覆盖后台配置；
5. 同名不同学号会给出告警（学号变更请用「编辑成员」手动处理）；
6. 导入前必须先预览，导入走事务，失败回滚；新建账号初始密码 123456。

注意：如果上传的是**过期的成绩表**（还包含已离开的人、或缺少新加入的人），导入会把这些人恢复或移出；请先在本模块「系统运维 → 导出名册 Excel」下载当前名册作为基准。

## 4. 成员数据的取舍

- **不做物理删除**（除「刚建错、无任何历史数据」的账号）：有过请假/积分/班费/建议等记录的成员只能用「移出统计」；
- 移出后：不出现在名册列表、不计入中队出勤、不进入通知完成名单，但历史记录、审计、操作日志全部保留；
- 系统管理员账号不可删除；删除接口会逐表检查历史数据并给出拒绝原因。

## 5. 相关命令与接口

```bash
# 迁移（含权限矩阵表）
cd backend && node scripts/migrate.js up

# 名册导入（命令行版，带 dry-run；UI 版在控制台里）
node scripts/import-roster.js --file <xlsx>          # 预览
node scripts/import-roster.js --file <xlsx> --apply  # 应用

# 控制台接口（均需超管权限）
GET  /api/admin/console/overview | todos | agent
GET  /api/admin/system/status        POST /api/admin/system/backup
GET  /api/admin/audit                GET  /api/admin/audit/export
GET  /api/admin/classes              POST/PUT /api/admin/classes
GET/POST/PUT/DELETE /api/admin/members[/:id]   POST /api/admin/members/bulk
POST /api/admin/roster/preview | apply
GET  /api/admin/export/roster.csv | roster.xlsx
GET/PUT /api/admin/permissions[/:key]
```
