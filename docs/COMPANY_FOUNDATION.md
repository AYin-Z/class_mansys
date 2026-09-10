# 中队（公司）化改造 · 数据与权限地基

> 本文档描述「区队管理系统 → 中队管理系统」的地基改造：组织模型、作用域/权限、聚合接口，以及上线前需执行的迁移与种子。

## 1. 组织模型

- 新增 `companies`（中队/大队）表：`id / name / code / description`。
- `classes`（区队）新增 `company_id`，外键指向 `companies.id`（ON DELETE SET NULL）。
- 用户归属仍由 `users.class_id` 决定，区队归属中队，中队聚合多个区队。

```
companies (中队) 1 ── n classes (区队) 1 ── n users (学员/干部)
```

## 2. 权限模型

- 角色编码沿用 0-9。
- 新增「中队平行查看」权限：`COMPANY_VIEW_ROLE_IDS = [1..9]`，即各区队管理层（干部/辅导员）均可查看本中队情况。
- 作用域由 `backend/shared/scope.js` 的 `resolveScope(user)` 解析：
  - 区队管理层（role 1-7）：作用域限本区队；若本区队已归属中队，则允许平行查看本中队。
  - 普通学员（role 0）：仅限本区队。
  - 超管/辅导员（role 8/9）：不限，可指定 `company_id` 查看任意中队。

## 3. 新增接口（`/api/company`）

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/api/company/overview?date=YYYY-MM-DD` | 本中队各分区队出勤/请假统计 + 汇总 | `hasCompanyView` |
| GET | `/api/company/classes?company_id=` | 本中队下区队列表（含成员统计） | `hasCompanyView` |
| GET | `/api/company/leave-records?date=&company_id=` | 当天在假学员请假明细（跨区队） | `hasCompanyView` |

`overview` 返回示例：
```json
{
  "success": true,
  "date": "2026-06-01",
  "classes": [
    { "class_id": "6", "class_name": "数据警务技术六区队", "total_members": 40,
      "student_count": 38, "on_leave": 3, "present": 35,
      "currently_leave": 2, "not_returned": 1 }
  ],
  "summary": { "total": 38, "on_leave": 3, "present": 35, "currently_leave": 2, "not_returned": 1 }
}
```

## 4. 迁移与种子（上线前执行）

1. 应用迁移：`mysql -u <user> -p class_manage_sys < backend/migrations/009_add_company.sql`
2. 创建默认中队并把未归属区队挂载：`node backend/seed-company.js 1 "数据警务技术中队"`
   （也可按需传自定义中队 id/名称；重复执行幂等）
3. 之后各区队管理层通过 `GET /api/company/overview` 即可查看本中队出勤。

## 4.1 现有请假接口的作用域化

- `GET /api/leave/all`：超管/辅导员看全部；区队管理层平行查看本中队；普通学员仅本区队。
- `GET /api/leave/:id`、`PUT /api/leave/approve`：区队管理层仅能查看/审批本区队记录，超管/辅导员不限。

## 5. 涉及文件

- `backend/migrations/009_add_company.sql`
- `backend/models/Company.js`、`backend/models/ClassInfo.js`
- `backend/shared/constants.js`（`COMPANY_VIEW_ROLE_IDS` / `hasCompanyView`）
- `backend/shared/scope.js`（作用域解析）
- `backend/controllers/CompanyController.js`、`backend/routes/company.js`
- `frontend-v3/src/api/company.ts`、`frontend-v3/src/types/roles.ts`（`VIEW_COMPANY`）
## 6. 作用域覆盖矩阵（本轮完成）

| 模块 | 读（列表/详情） | 写（创建/动作） | 口径 |
|---|---|---|---|
| 请假 leave | 列表按本中队平行；详情限本区队/本中队 | 审批仅本区队 | 中队平行读 |
| 中队 company | overview/leave-records 需 hasCompanyView | — | 中队平行读 |
| 通知 notice | 列表/详情按可见区队 | 发布打区队标记；更新/删除限可见区队；完成名单仅本区队 | 混合 |
| 公告 announcement | 列表/详情按可见区队 | 发布限区队长/超管并打标；资源上传限干部并打标 | 混合 |
| 相册 album | 列表/详情按可见区队 | 创建/上传校验相册可达 | 混合 |
| 作业 homework | 列表/详情按可见区队 | 发布打标；提交校验作业可达 | 混合 |
| 投票 vote | 列表/详情按可见区队 | 创建限干部；投票/关闭校验可达 | 混合 |
| 抽奖 lottery | 列表/详情按可见区队 | 创建限干部；参与校验可达 | 混合 |
| 擂台 challenge | 列表/详情按可见区队 | 创建限干部并打标；申请校验可达 | 混合 |
| 积分 points | 明细仅本区队；排行按可见区队 | 加分仅本区队；删除限可见区队 | 混合 |
| 心理 psychological | 列表/详情仅本区队 | 处理仅本区队 | 仅本区队 |
| 留言 message | 仅本区队目标 | 仅本区队目标 | 仅本区队 |
| 班费 fee | 收缴/支出/公示/汇总仅本区队 | 创建打标；审批按角色 | 仅本区队 |
| 管理员 admin | members/member-detail/operations 仅本区队 | 角色变更仅超管 | 仅本区队 |
| 建议箱 suggestion | 列表/详情仅管理员 | 匿名提交返回 viewToken | 全局匿名 |

说明：`class_id IS NULL` 视为「全局/中队级」，所有区队可见；超管(8)/辅导员(9) 不受区队限制。

## 7. 测试与验收

- `backend/tests/setup-test-db.js`：克隆生产结构到 `*_test` 库并应用迁移+种子。
- `backend/tests/fixtures.js`：多区队夹具（仅允许 `*_test[0-9]*` 库）。
- `backend/tests/e2e-acceptance.js`：65 项端到端验收（P0/P1 回归 + 中队作用域 + 内容隔离 + 二轮安全回归）。
- `backend/tests/backup-db.js` / `restore-db.js`：逻辑备份与恢复。
- `backend/tests/require-all.js`：后端模块加载自检。
## 8. 身份模型修正：role 与 member_type 正交

**问题**：出勤/在编统计曾用 role=0 当“学员”，导致班干部（role 1-7）被排除在出勤分母之外（生产显示 30 人全勤，实际在编学员 37 人）。根因是 role 同时承担了「岗位/权限」与「是否在编学员」两种语义，而系统角色（8 超管 / 9 辅导员）又和岗位混在同一刻度上。

**修正**（迁移 `011_add_user_member_type.sql`）：

| 字段 | 含义 | 取值 |
|---|---|---|
| users.role | 岗位/权限（0 学员，1-7 班干部，8 系统管理员，9 辅导员） | INT |
| users.member_type | 在编身份，决定是否计入区队花名册/出勤分母 | student（在编学员，含班干部）、staff（辅导员等外部）、system（系统账号） |

- 回填规则：role 0-7 → student；role 8 → system；role 9 → staff（若已有人工设置则不覆盖）。
- 出勤聚合（/api/company/overview、/leave-records、区队列表）分母 = member_type 为 student 的成员。
- 通知待办完成名单（Notice.getTodoCompletionStatus）同样改为按 member_type 统计。
- 接口字段由 student_count 更名为 member_count；超管后台概览改为「在编学员 / 班干部」两个口径。

**待办**：超管后台增加 member_type 维护入口（例如“某学员同时是系统管理员”应标为 student），以及后续把权限矩阵从 role 数值中解耦（hasPermission 已具备基础）。
