-- 026_publish_notice_company.sql
-- 新增权限：发布全中队通知（PUBLISH_NOTICE_COMPANY）
--
-- 背景：通知的可见范围一直由**作者作用域**决定（区队干部 → 本区队，超管/辅导员 → 全局），
-- 工具与接口上都没有"范围"这个选项，所以区队干部无法发全中队通知。
-- 这与实际需要不符：团的工作、宣传工作常常面向全中队。
--
-- 为什么不给所有干部：可见范围一旦放开成"人人可发全中队"，任何人都能向 215 人推送，
-- 骚扰面和误发风险都太大。默认只给团支书(5)、宣传委员(7)、超管(8)、辅导员(9)，
-- 其他人需要时由超管在权限矩阵里单独授予。
--
-- 幂等：INSERT IGNORE（与 016 同一口径，已存在的配置不覆盖）。

INSERT IGNORE INTO role_permissions (permission, role) VALUES ('PUBLISH_NOTICE_COMPANY', 5);
INSERT IGNORE INTO role_permissions (permission, role) VALUES ('PUBLISH_NOTICE_COMPANY', 7);
INSERT IGNORE INTO role_permissions (permission, role) VALUES ('PUBLISH_NOTICE_COMPANY', 8);
INSERT IGNORE INTO role_permissions (permission, role) VALUES ('PUBLISH_NOTICE_COMPANY', 9);
