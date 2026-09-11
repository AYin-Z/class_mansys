# 班费规则（对照 PRD 实现）

依据：《25Q6 班费收缴与管理方案【草案1】》（原件 `/home/ayin/Current_Works/班费管理/25Q6班费收缴管理方案【草案1】.docx`）。

## 1. 审批阶梯（PRD 原文 → 系统实现）

| 金额 | PRD 流程 | 系统实现 |
|---|---|---|
| ≤ 100 元（小额） | 经办人申请 → 区队长审批 → 即可使用并报销 | `tier=small`，审批链仅 step1（区队长，`role=1`） |
| 100–500 元（中额） | 经办人申请 → 班长审核 → 班主任/辅导员审批 | `tier=medium`，step1 区队长 → step2 辅导员（`role=9`，超管可代办） |
| > 500 元（大额） | 经办人提交详细预算方案 → 班长和班主任审核 → **匿名问卷投票，获得全班 19 票以上同意** | `tier=large`，step1 区队长 → step2 辅导员 → **step3 全班匿名投票，门槛 19 票** |

## 2. 投票口径（2026-09-11 按 PRD 开放）

- **门槛：19 票**（`models/ExpenseApproval.js` 的 `PRD_VOTE_THRESHOLD`）。若某区队在编学员不足 19 人，门槛取全班人数（否则永远无法达标）。
- **参与人：本区队全体在编学员**（含本班干部）；**申请人本人不可投票**；跨区队、辅导员、超管不可投票（保持「全班匿名问卷」语义）。
- **匿名**：投票只记录 `expense_id + user_id + vote`，任何接口都不返回「谁投了什么」，只返回赞成/反对票数。
- **接口开放范围**（`routes/fee.js`）：
  - `GET /api/fee/approvals/pending`：所有登录用户；服务端按角色 + 区队过滤——学员只会看到本班处于 step3 的投票项，区队长看到本班 step1，辅导员看到 step2。
  - `POST /api/fee/approvals/:id/vote`：所有登录用户（服务端校验本班同学、非申请人、当前处于 step3）。
  - `GET /api/fee/approvals/:id/votes`：同班可见投票进度。
  - 审批（`POST /approvals/:id`、`/reject`）仍需 `APPROVE_FEE_USE`。
- **只取当前步骤的待办**：待办列表 JOIN 的是 `ea.step = e.approval_step`，避免大额件刚提交时其空白 step3 节点就出现在投票列表里（该缺陷已修）。

## 3. 其他 PRD 条款落地情况

| PRD 条款 | 实现 |
|---|---|
| 钱账分离：生活副区管钱、组织委员记账 | 收缴由「发起收缴」权限（默认含生活副区）操作，报销记账走 `BOOKKEEP_FEE`；公示由记账方发布 |
| 困难同学可减免 | 「免缴」功能（免缴不计入已缴金额与人数） |
| 必须先申请后使用再报销 | 报销单必须先提交并走完审批链才会 `status=1` 计入账目 |
| 报销凭证必须提供 | `proof_url` 仅接受 `/uploads/` 前缀（上传接口限制图片、10MB），前端在申请页与详情页均渲染凭证 |
| 每月公示收支明细 | 班费 → 公示：一键按本区队汇总（含收缴收入）并生成明细快照 |
| 全额/超额校验 | 缴纳金额以服务端「人均应缴」为准，重复缴纳与已截止批次会被拒绝 |

## 4. 相关代码

- `backend/models/ExpenseApproval.js`：审批链、投票门槛、投票事务
- `backend/models/FeeCollection.js`：收缴、缴纳、免缴、截止（金额服务端取值）
- `backend/models/FeePublication.js`：按区队汇总与公示快照
- `backend/controllers/FeeController.js`：作用域与状态校验
- 前端：`pages/fee/{index,approvals,expense-apply,expense-detail,publication-detail}.vue`
