# 区队管理系统数据库设计

## 1. 用户表（users）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 用户ID | 主键，自增 |
| `openid` | `VARCHAR(100)` | 微信小程序OpenID | 唯一，非空 |
| `nickName` | `VARCHAR(50)` | 用户昵称 | 非空 |
| `avatarUrl` | `VARCHAR(255)` | 用户头像URL | 非空 |
| `gender` | `INT` | 用户性别（0-未知，1-男，2-女） | 非空，默认0 |
| `student_id` | `VARCHAR(20)` | 学号 | 唯一，非空 |
| `name` | `VARCHAR(20)` | 真实姓名 | 非空 |
| `class_id` | `VARCHAR(20)` | 班级ID | 非空 |
| `role` | `INT` | 用户角色（0-普通成员，1-班委，2-辅导员） | 非空，默认0 |
| `phone` | `VARCHAR(20)` | 手机号码 | 非空 |
| `email` | `VARCHAR(50)` | 邮箱 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 2. 请假表（leaves）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 请假ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `leave_type` | `VARCHAR(20)` | 请假类型（事假、病假、公假等） | 非空 |
| `start_time` | `DATETIME` | 开始时间 | 非空 |
| `end_time` | `DATETIME` | 结束时间 | 非空 |
| `reason` | `TEXT` | 请假事由 | 非空 |
| `status` | `INT` | 请假状态（0-待审批，1-已批准，2-已拒绝） | 非空，默认0 |
| `approver_id` | `INT` | 审批人ID | 外键，可空 |
| `approval_time` | `DATETIME` | 审批时间 | 可空 |
| `approval_notes` | `TEXT` | 审批备注 | 可空 |
| `is_cancelled` | `BOOLEAN` | 是否已销假 | 非空，默认false |
| `cancelled_time` | `DATETIME` | 销假时间 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 3. 通知表（notices）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 通知ID | 主键，自增 |
| `title` | `VARCHAR(100)` | 通知标题 | 非空 |
| `content` | `TEXT` | 通知内容 | 非空 |
| `type` | `VARCHAR(20)` | 通知类型（集合通知、会议通知等） | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 4. 通知阅读表（notice_reads）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 阅读记录ID | 主键，自增 |
| `notice_id` | `INT` | 通知ID | 外键，非空 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `read_time` | `TIMESTAMP` | 阅读时间 | 非空，默认CURRENT_TIMESTAMP |

## 5. 公告表（announcements）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 公告ID | 主键，自增 |
| `title` | `VARCHAR(100)` | 公告标题 | 非空 |
| `content` | `TEXT` | 公告内容 | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 6. 资源表（resources）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 资源ID | 主键，自增 |
| `name` | `VARCHAR(100)` | 资源名称 | 非空 |
| `type` | `VARCHAR(20)` | 资源类型（文档、图片、视频等） | 非空 |
| `url` | `VARCHAR(255)` | 资源URL | 非空 |
| `size` | `BIGINT` | 资源大小（字节） | 非空 |
| `uploader_id` | `INT` | 上传人ID | 外键，非空 |
| `category` | `VARCHAR(50)` | 资源分类 | 非空 |
| `description` | `TEXT` | 资源描述 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 7. 相册表（albums）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 相册ID | 主键，自增 |
| `name` | `VARCHAR(100)` | 相册名称 | 非空 |
| `description` | `TEXT` | 相册描述 | 可空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `permission` | `INT` | 权限（0-公开，1-仅成员可见） | 非空，默认0 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 8. 照片表（photos）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 照片ID | 主键，自增 |
| `album_id` | `INT` | 相册ID | 外键，非空 |
| `url` | `VARCHAR(255)` | 照片URL | 非空 |
| `description` | `TEXT` | 照片描述 | 可空 |
| `uploader_id` | `INT` | 上传人ID | 外键，非空 |
| `is_approved` | `BOOLEAN` | 是否已审核 | 非空，默认false |
| `approved_by` | `INT` | 审核人ID | 外键，可空 |
| `approved_at` | `DATETIME` | 审核时间 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 9. 留言表（messages）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 留言ID | 主键，自增 |
| `content` | `TEXT` | 留言内容 | 非空 |
| `user_id` | `INT` | 留言人ID | 外键，非空 |
| `target_id` | `INT` | 目标ID（相册ID或其他） | 非空 |
| `target_type` | `VARCHAR(20)` | 目标类型（album等） | 非空 |
| `parent_id` | `INT` | 父留言ID（用于回复） | 外键，可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 10. 班费表（expenses）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 班费ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `amount` | `DECIMAL(10,2)` | 金额 | 非空 |
| `type` | `VARCHAR(20)` | 类型（收入、支出） | 非空 |
| `purpose` | `TEXT` | 用途 | 非空 |
| `status` | `INT` | 状态（0-待审批，1-已批准，2-已拒绝） | 非空，默认0 |
| `approver_id` | `INT` | 审批人ID | 外键，可空 |
| `approval_time` | `DATETIME` | 审批时间 | 可空 |
| `approval_notes` | `TEXT` | 审批备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 11. 心理干预申请表（psychological_applications）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 申请ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `content` | `TEXT` | 申请内容 | 非空 |
| `status` | `INT` | 状态（0-待处理，1-处理中，2-已完成） | 非空，默认0 |
| `handler_id` | `INT` | 处理人ID | 外键，可空 |
| `handler_notes` | `TEXT` | 处理备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 12. 擂台表（challenges）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 擂台ID | 主键，自增 |
| `name` | `VARCHAR(100)` | 擂台名称 | 非空 |
| `type` | `VARCHAR(20)` | 擂台类型（学习、纪律作风、体能） | 非空 |
| `description` | `TEXT` | 擂台描述 | 非空 |
| `current_champion_id` | `INT` | 当前擂主ID | 外键，可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 13. 擂台申请表（challenge_applications）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 申请ID | 主键，自增 |
| `challenge_id` | `INT` | 擂台ID | 外键，非空 |
| `user_id` | `INT` | 申请人ID | 外键，非空 |
| `status` | `INT` | 状态（0-待审批，1-已批准，2-已拒绝） | 非空，默认0 |
| `approver_id` | `INT` | 审批人ID | 外键，可空 |
| `approval_time` | `DATETIME` | 审批时间 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 14. 挑战记录表（challenge_records）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 记录ID | 主键，自增 |
| `challenge_id` | `INT` | 擂台ID | 外键，非空 |
| `challenger_id` | `INT` | 挑战者ID | 外键，非空 |
| `champion_id` | `INT` | 擂主ID | 外键，非空 |
| `result` | `VARCHAR(20)` | 结果（挑战成功、挑战失败） | 非空 |
| `notes` | `TEXT` | 备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 15. 投票表（votes）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 投票ID | 主键，自增 |
| `title` | `VARCHAR(100)` | 投票标题 | 非空 |
| `description` | `TEXT` | 投票描述 | 可空 |
| `type` | `VARCHAR(20)` | 投票类型（单选、多选） | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `start_time` | `DATETIME` | 开始时间 | 非空 |
| `end_time` | `DATETIME` | 结束时间 | 非空 |
| `is_active` | `BOOLEAN` | 是否激活 | 非空，默认true |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 16. 投票选项表（vote_options）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 选项ID | 主键，自增 |
| `vote_id` | `INT` | 投票ID | 外键，非空 |
| `content` | `VARCHAR(200)` | 选项内容 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 17. 投票记录表（vote_records）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 记录ID | 主键，自增 |
| `vote_id` | `INT` | 投票ID | 外键，非空 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `option_id` | `INT` | 选项ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 18. 作业表（homeworks）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 作业ID | 主键，自增 |
| `title` | `VARCHAR(100)` | 作业标题 | 非空 |
| `description` | `TEXT` | 作业描述 | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `deadline` | `DATETIME` | 截止时间 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 19. 作业提交表（homework_submissions）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 提交ID | 主键，自增 |
| `homework_id` | `INT` | 作业ID | 外键，非空 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `file_url` | `VARCHAR(255)` | 文件URL | 非空 |
| `file_name` | `VARCHAR(100)` | 文件名称 | 非空 |
| `status` | `INT` | 状态（0-待批改，1-已批改） | 非空，默认0 |
| `score` | `INT` | 分数 | 可空 |
| `feedback` | `TEXT` | 反馈 | 可空 |
| `submitted_at` | `TIMESTAMP` | 提交时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 20. 匿名建议表（suggestions）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 建议ID | 主键，自增 |
| `content` | `TEXT` | 建议内容 | 非空 |
| `category` | `VARCHAR(50)` | 建议分类 | 非空 |
| `status` | `INT` | 状态（0-待处理，1-处理中，2-已处理） | 非空，默认0 |
| `handler_id` | `INT` | 处理人ID | 外键，可空 |
| `handler_notes` | `TEXT` | 处理备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 21. 抽奖活动表（lotteries）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 抽奖ID | 主键，自增 |
| `name` | `VARCHAR(100)` | 抽奖名称 | 非空 |
| `description` | `TEXT` | 抽奖描述 | 可空 |
| `rules` | `TEXT` | 抽奖规则 | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `start_time` | `DATETIME` | 开始时间 | 非空 |
| `end_time` | `DATETIME` | 结束时间 | 非空 |
| `is_active` | `BOOLEAN` | 是否激活 | 非空，默认true |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 22. 抽奖参与表（lottery_participants）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 参与ID | 主键，自增 |
| `lottery_id` | `INT` | 抽奖ID | 外键，非空 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `is_winner` | `BOOLEAN` | 是否中奖 | 非空，默认false |
| `prize` | `VARCHAR(100)` | 奖品 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 23. 积分表（points）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 积分记录ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `score` | `INT` | 积分（正数为增加，负数为减少） | 非空 |
| `reason` | `TEXT` | 积分原因 | 非空 |
| `created_by` | `INT` | 操作人ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 24. 积分评分表（point_ratings）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 评分ID | 主键，自增 |
| `rater_id` | `INT` | 评分人ID | 外键，非空 |
| `rated_id` | `INT` | 被评分人ID | 外键，非空 |
| `score` | `INT` | 评分（1-5分） | 非空 |
| `comment` | `TEXT` | 评价内容 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 26. 班级表（classes）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(20)` | 班级ID | 主键 |
| `name` | `VARCHAR(50)` | 班级名称 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 27. 班费收缴提案表（fee_collection_proposals）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 提案ID | 主键，自增 |
| `proposer_id` | `INT` | 提案人ID | 外键，非空 |
| `amount` | `DECIMAL(10,2)` | 收缴金额 | 非空 |
| `purpose` | `TEXT` | 收缴用途说明 | 非空 |
| `status` | `INT` | 状态（0-待讨论，1-已通过，2-已拒绝） | 非空，默认0 |
| `vote_id` | `INT` | 关联投票ID | 外键，可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 28. 班费减免申请表（fee_reduction_applications）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 申请ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `collection_id` | `INT` | 收缴记录ID | 外键，非空 |
| `reason` | `TEXT` | 减免原因 | 非空 |
| `status` | `INT` | 状态（0-待审批，1-已批准，2-已拒绝） | 非空，默认0 |
| `approver_id` | `INT` | 审批人ID | 外键，可空 |
| `approval_time` | `DATETIME` | 审批时间 | 可空 |
| `approval_notes` | `TEXT` | 审批备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 29. 班费收缴记录表（fee_collections）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 收缴ID | 主键，自增 |
| `proposal_id` | `INT` | 关联提案ID | 外键，可空 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `amount` | `DECIMAL(10,2)` | 金额 | 非空 |
| `payment_method` | `VARCHAR(20)` | 支付方式（线上转账、现金） | 非空 |
| `receipt_url` | `VARCHAR(255)` | 凭证URL | 可空 |
| `is_reduced` | `BOOLEAN` | 是否减免 | 非空，默认false |
| `reduction_amount` | `DECIMAL(10,2)` | 减免金额 | 可空 |
| `collected_at` | `TIMESTAMP` | 收缴时间 | 非空，默认CURRENT_TIMESTAMP |
| `collector_id` | `INT` | 收缴人ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 30. 班费使用申请表（fee_usage_applications）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 申请ID | 主键，自增 |
| `applicant_id` | `INT` | 申请人ID | 外键，非空 |
| `amount` | `DECIMAL(10,2)` | 申请金额 | 非空 |
| `usage_category` | `VARCHAR(50)` | 使用类别（文体活动、学风建设、公共物品、同学慰问等） | 非空 |
| `purpose` | `TEXT` | 使用用途 | 非空 |
| `budget_details` | `TEXT` | 预算明细（大额申请时必填） | 可空 |
| `amount_level` | `VARCHAR(20)` | 金额级别（small-≤100，medium-100-500，large->500） | 非空 |
| `status` | `INT` | 状态（0-待审批，1-审批中，2-已批准，3-已拒绝，4-已报销） | 非空，默认0 |
| `is_emergency` | `BOOLEAN` | 是否紧急情况 | 非空，默认false |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 31. 班费审批记录表（fee_approvals）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 审批ID | 主键，自增 |
| `application_id` | `INT` | 申请ID | 外键，非空 |
| `approver_id` | `INT` | 审批人ID | 外键，非空 |
| `approver_role` | `VARCHAR(30)` | 审批人角色 | 非空 |
| `approval_order` | `INT` | 审批顺序 | 非空 |
| `status` | `INT` | 审批状态（0-待审批，1-已批准，2-已拒绝） | 非空，默认0 |
| `approval_time` | `DATETIME` | 审批时间 | 可空 |
| `approval_notes` | `TEXT` | 审批备注 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 32. 班费大额投票表（fee_large_votes）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 投票ID | 主键，自增 |
| `application_id` | `INT` | 申请ID | 外键，非空 |
| `total_votes` | `INT` | 总票数 | 非空，默认0 |
| `agree_votes` | `INT` | 同意票数 | 非空，默认0 |
| `required_votes` | `INT` | 所需票数 | 非空，默认19 |
| `is_passed` | `BOOLEAN` | 是否通过 | 可空 |
| `start_time` | `DATETIME` | 开始时间 | 非空 |
| `end_time` | `DATETIME` | 结束时间 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 33. 班费报销记录表（fee_reimbursements）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 报销ID | 主键，自增 |
| `application_id` | `INT` | 申请ID | 外键，非空 |
| `actual_amount` | `DECIMAL(10,2)` | 实际金额 | 非空 |
| `receipt_urls` | `JSON` | 票据URL列表 | 非空 |
| `reimbursed_at` | `TIMESTAMP` | 报销时间 | 非空，默认CURRENT_TIMESTAMP |
| `bookkeeper_id` | `INT` | 记账员ID | 外键，非空 |
| `treasurer_id` | `INT` | 资金保管员ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 34. 班费收支明细表（fee_transactions）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 交易ID | 主键，自增 |
| `date` | `DATE` | 日期 | 非空 |
| `summary` | `VARCHAR(200)` | 事项摘要 | 非空 |
| `type` | `VARCHAR(10)` | 类型（income-收入，expense-支出） | 非空 |
| `amount` | `DECIMAL(10,2)` | 金额 | 非空 |
| `handler_id` | `INT` | 经手人ID | 外键，非空 |
| `balance` | `DECIMAL(10,2)` | 余额 | 非空 |
| `related_id` | `INT` | 关联记录ID | 可空 |
| `related_type` | `VARCHAR(30)` | 关联记录类型 | 可空 |
| `is_public` | `BOOLEAN` | 是否公示 | 非空，默认false |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 35. 班费月度公示表（fee_monthly_publications）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 公示ID | 主键，自增 |
| `year` | `INT` | 年份 | 非空 |
| `month` | `INT` | 月份 | 非空 |
| `start_balance` | `DECIMAL(10,2)` | 期初余额 | 非空 |
| `total_income` | `DECIMAL(10,2)` | 总收入 | 非空 |
| `total_expense` | `DECIMAL(10,2)` | 总支出 | 非空 |
| `end_balance` | `DECIMAL(10,2)` | 期末余额 | 非空 |
| `transaction_ids` | `JSON` | 交易ID列表 | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `is_published` | `BOOLEAN` | 是否已发布 | 非空，默认false |
| `published_at` | `TIMESTAMP` | 发布时间 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 36. 财务监督小组表（financial_supervisors）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | ID | 主键，自增 |
| `user_id` | `INT` | 用户ID | 外键，非空 |
| `role` | `VARCHAR(30)` | 角色（区队长、团支书、同学代表） | 非空 |
| `start_date` | `DATE` | 开始日期 | 非空 |
| `end_date` | `DATE` | 结束日期 | 可空 |
| `is_active` | `BOOLEAN` | 是否在职 | 非空，默认true |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 37. 账目审计记录表（audit_records）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 审计ID | 主键，自增 |
| `auditor_ids` | `JSON` | 审计人ID列表 | 非空 |
| `start_date` | `DATE` | 审计开始日期 | 非空 |
| `end_date` | `DATE` | 审计结束日期 | 非空 |
| `audit_report` | `TEXT` | 审计报告 | 非空 |
| `issues_found` | `TEXT` | 发现的问题 | 可空 |
| `status` | `INT` | 状态（0-进行中，1-已完成） | 非空，默认0 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 38. 账目质询表（account_queries）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 质询ID | 主键，自增 |
| `user_id` | `INT` | 质询人ID | 外键，非空 |
| `transaction_id` | `INT` | 交易ID | 外键，可空 |
| `content` | `TEXT` | 质询内容 | 非空 |
| `responder_id` | `INT` | 回复人ID | 外键，可空 |
| `response` | `TEXT` | 回复内容 | 可空 |
| `status` | `INT` | 状态（0-待回复，1-已回复） | 非空，默认0 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
| `updated_at` | `TIMESTAMP` | 更新时间 | 非空，默认CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

## 39. 期末结算报告表（final_settlement_reports）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 报告ID | 主键，自增 |
| `semester` | `VARCHAR(20)` | 学期 | 非空 |
| `total_income` | `DECIMAL(10,2)` | 总收入 | 非空 |
| `total_expense` | `DECIMAL(10,2)` | 总支出 | 非空 |
| `remaining_balance` | `DECIMAL(10,2)` | 结余金额 | 非空 |
| `disposal_plan` | `TEXT` | 处置方案（转入下一学期或平均归还） | 非空 |
| `creator_id` | `INT` | 创建人ID | 外键，非空 |
| `is_approved` | `BOOLEAN` | 是否已审批 | 非空，默认false |
| `approved_at` | `TIMESTAMP` | 审批时间 | 可空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 40. 违规行为记录表（violation_records）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 记录ID | 主键，自增 |
| `user_id` | `INT` | 违规人ID | 外键，非空 |
| `violation_type` | `VARCHAR(50)` | 违规类型（侵占、挪用等） | 非空 |
| `description` | `TEXT` | 违规描述 | 非空 |
| `amount_involved` | `DECIMAL(10,2)` | 涉及金额 | 可空 |
| `handling_process` | `TEXT` | 处理流程 | 非空 |
| `handling_result` | `TEXT` | 处理结果 | 非空 |
| `handler_id` | `INT` | 处理人ID | 外键，非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |

## 41. 班费制度修订投票表（rule_revision_votes）

| 字段名 | 数据类型 | 描述 | 约束 |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | 投票ID | 主键，自增 |
| `title` | `VARCHAR(200)` | 修订标题 | 非空 |
| `current_rule` | `TEXT` | 现行制度 | 非空 |
| `proposed_rule` | `TEXT` | 修订方案 | 非空 |
| `proposer_id` | `INT` | 提案人ID | 外键，非空 |
| `total_votes` | `INT` | 总票数 | 非空，默认0 |
| `agree_votes` | `INT` | 同意票数 | 非空，默认0 |
| `disagree_votes` | `INT` | 不同意票数 | 非空，默认0 |
| `is_passed` | `BOOLEAN` | 是否通过 | 可空 |
| `start_time` | `DATETIME` | 开始时间 | 非空 |
| `end_time` | `DATETIME` | 结束时间 | 非空 |
| `created_at` | `TIMESTAMP` | 创建时间 | 非空，默认CURRENT_TIMESTAMP |
