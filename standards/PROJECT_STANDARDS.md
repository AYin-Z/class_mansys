# PROJECT_STANDARDS — 通用项目结构规范

> 来源：SCALE OS v10.0 · HERMES.md
> 适用范围：新项目初始化

- `[PS1]` **目录规范**：src/ 源码、tests/ 测试、docs/ 文档、scripts/ 脚本、config/ 配置
- `[PS2]` **Git 工作流**：main(生产) / develop(开发) / feature/*(功能) / fix/*(修复) / hotfix/*(紧急)
- `[PS3]` **提交规范**：`type(scope): subject`，type = feat/fix/docs/style/refactor/test/chore
- `[PS4]` **分支同步**：每天开始工作前 git fetch + rebase/merge，确保基于最新代码
- `[PS5]` **代码审查**：所有合并到 develop/main 的代码必须经过审查
- `[PS6]` **文档更新**：功能变更必须同步更新 README、CHANGELOG 和相关文档
- `[PS7]` **依赖管理**：新增依赖必须说明理由，定期检查更新和漏洞
