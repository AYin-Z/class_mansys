-- 029_revoke_student_view_company.sql
-- 收回学员的「查看中队情况」权限（VIEW_COMPANY）
--
-- 背景（一个真实的双真相源问题）：
--   - 代码默认矩阵 PERMISSIONS.VIEW_COMPANY = ADMIN_ROLE_IDS = [1..9]，**本就不含学员**
--   - 但后台把 role 0 加进了 role_permissions.VIEW_COMPANY
--   - 控制器当时查的是**硬编码**的 COMPANY_VIEW_ROLE_IDS = [1..9]（不含学员）
--   于是：路由中间件按矩阵放行、控制器按硬编码拒绝 → 学员"看得见、调不动"，
--   而且工具目录（从路由权限自动生成）把两个中队类工具暴露给了学员。
--
-- 决策（2026-09-13，产品确认）：**学员不该看中队数据**（跨区队请假明细含他人请假事由）。
-- 修法分两步，本文件是第二步：
--   1. 代码：shared/scope.js 的 canViewCompany 改为查权限矩阵（唯一权威来源，带启动期兜底）
--   2. 数据：本迁移把 role 0 从 VIEW_COMPANY 收回
-- 两步合起来，生效行为与原来完全一致（学员本来就看不到），但两套定义合并成一套，
-- 后台改矩阵从此真的生效，工具目录也不再撒谎。
--
-- 幂等：DELETE 本身幂等。

DELETE FROM role_permissions WHERE permission = 'VIEW_COMPANY' AND role = 0;
