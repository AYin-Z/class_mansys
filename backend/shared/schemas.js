const { z } = require('zod');

/**
 * 写接口请求体 schema（P1 契约统一）
 *
 * 说明：统一使用 .passthrough() 保留未声明字段——当前阶段先获得类型/格式校验，
 * 未知字段的收紧（防 mass assignment）放在各域 service 化时逐个落实。
 */
const passthrough = (shape) => z.object(shape).passthrough();

const idLike = z.union([z.number(), z.string().min(1)]);

const schemas = {
  // ---------- 认证 ----------
  loginWithPassword: passthrough({
    student_id: z.string().min(1, '学号不能为空'),
    password: z.string().min(1, '密码不能为空')
  }),
  loginWithPhone: passthrough({
    phone: z.string().min(1, '手机号不能为空'),
    password: z.string().min(1, '密码不能为空')
  }),
  loginWithEmail: passthrough({
    email: z.string().min(1, '邮箱不能为空'),
    password: z.string().min(1, '密码不能为空')
  }),
  sendCode: passthrough({ phone: z.string().optional(), email: z.string().optional() }),
  phoneCodeLogin: passthrough({ phone: z.string().min(1), code: z.string().min(4) }),
  emailCodeLogin: passthrough({ email: z.string().min(1), code: z.string().min(4) }),
  setPassword: passthrough({
    phone: z.string().optional(),
    email: z.string().optional(),
    code: z.string().min(4),
    password: z.string().min(6, '密码至少 6 位')
  }),
  register: passthrough({
    student_id: z.string().min(1, '学号不能为空'),
    name: z.string().min(1, '姓名不能为空')
  }),

  // ---------- 请假 ----------
  leaveApply: passthrough({
    type: z.string().min(1, '请选择请假类型'),
    start_time: z.string().min(1, '开始时间不能为空'),
    end_time: z.string().min(1, '结束时间不能为空')
  }),

  // ---------- 内容类 ----------
  noticeCreate: passthrough({
    title: z.string().min(1, '标题不能为空'),
    content: z.string().min(1, '内容不能为空')
  }),
  announcementCreate: passthrough({
    title: z.string().min(1, '标题不能为空'),
    content: z.string().min(1, '内容不能为空')
  }),
  albumCreate: passthrough({ name: z.string().min(1, '相册名称不能为空') }),
  homeworkCreate: passthrough({
    title: z.string().min(1, '标题不能为空'),
    description: z.string().min(1, '描述不能为空'),
    deadline: z.string().min(1, '截止时间不能为空')
  }),

  // ---------- 活动 ----------
  voteCreate: passthrough({
    title: z.string().min(1, '标题必填'),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    options: z.array(z.string()).min(2, '至少需要两个有效选项')
  }),
  lotteryCreate: passthrough({
    name: z.string().min(1),
    rules: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1)
  }),
  challengeCreate: passthrough({
    name: z.string().min(1),
    type: z.string().min(1),
    description: z.string().min(1)
  }),

  // ---------- 互动 ----------
  pointsAdd: passthrough({
    user_id: idLike,
    score: z.union([z.number(), z.string()]),
    reason: z.string().min(1, 'reason 必填')
  }),
  suggestionSubmit: passthrough({
    content: z.string().min(5, '建议内容至少 5 个字')
  }),
  psychologicalCreate: passthrough({
    content: z.string().min(3, '请填写申请内容')
  }),
  messageCreate: passthrough({
    content: z.string().min(1, 'content 必填'),
    target_id: idLike,
    target_type: z.string().min(1)
  }),

  // ---------- 班费 ----------
  feeCreateCollection: passthrough({
    title: z.string().min(1),
    amount_per_person: z.union([z.number(), z.string()])
  }),
  feeCreateExpense: passthrough({
    amount: z.union([z.number(), z.string()]),
    purpose: z.string().optional()
  }),
  feeCreatePublication: passthrough({ title: z.string().min(1) }),

  // ---------- 对话式 Agent ----------
  agentChat: passthrough({
    // 允许"只发附件不写字"，因此 message 可为空字符串，但两者不能同时为空（由控制器兜底）
    message: z.string().max(4000).default(''),
    conversationId: idLike.optional(),
    attachments: z.array(z.object({
      url: z.string().min(1).max(500),
      name: z.string().max(120).optional(),
      mime: z.string().max(80).optional(),
      size: z.number().optional()
    })).max(6).optional()
  }),
  agentConfirm: passthrough({ actionId: idLike }),
  apiTokenCreate: passthrough({
    name: z.string().trim().min(1, '请填写令牌备注').max(50),
    allowWrite: z.boolean().optional()
  }),

  // ---------- 管理 ----------
  leaveConfigUpdate: passthrough({
    type_name: z.string().optional(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    is_fixed: z.union([z.boolean(), z.number()]).optional(),
    reasons: z.array(z.string()).optional(),
    enabled: z.union([z.boolean(), z.number()]).optional(),
    sort_order: z.union([z.number(), z.string()]).optional()
  })
};

module.exports = { schemas };
