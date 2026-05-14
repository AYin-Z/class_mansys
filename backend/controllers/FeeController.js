const Fee = require('../models/Fee');
const FeeCollection = require('../models/FeeCollection');
const ExpenseApproval = require('../models/ExpenseApproval');
const FeePublication = require('../models/FeePublication');

// 后端角色常量（前端 roles.ts 用 ESM 不可 require，这里复制一份）
// TODO: 提取为 shared/constants.js 共享
const BACKEND_ROLES = {
  STUDENT: 0, CLASS_LEADER: 1, LIFE_VICE: 2, STUDY_VICE: 3,
  PSYCHOLOGICAL_VICE: 4, LEAGUE_SECRETARY: 5, ORGANIZATION_COMMITTEE: 6, PUBLICITY_COMMITTEE: 7,
  SUPER_ADMIN: 8
};
const BACKEND_ADMIN_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
function isBackendAdmin(user) { return user && BACKEND_ADMIN_IDS.includes(user.role); }

class FeeController {
  // === 收缴 ===
  static async createCollection(req, res) {
    try {
      if (req.user.role !== BACKEND_ROLES.LIFE_VICE && !req.user.isAdmin) {
        return res.status(403).json({ error: '仅生活副区可发起收缴' });
      }
      const id = await FeeCollection.create({ ...req.body, created_by: req.user.id });
      res.json({ success: true, id });
    } catch (err) {
      console.error('创建收缴批次失败:', err);
      res.status(500).json({ error: '创建收缴批次失败' });
    }
  }

  static async listCollections(req, res) {
    try {
      const collections = await FeeCollection.getAll();
      res.json({ success: true, collections });
    } catch (err) {
      res.status(500).json({ error: '获取收缴列表失败' });
    }
  }

  static async getCollectionDetail(req, res) {
    try {
      const collection = await FeeCollection.findById(req.params.id);
      if (!collection) return res.status(404).json({ error: '收缴批次不存在' });
      res.json({ success: true, collection });
    } catch (err) {
      res.status(500).json({ error: '获取收缴详情失败' });
    }
  }

  static async getCollectionRecords(req, res) {
    try {
      if (!isBackendAdmin(req.user)) {
        return res.status(403).json({ error: '仅干部可查看缴纳明细' });
      }
      const records = await FeeCollection.getRecords(req.params.id);
      res.json({ success: true, records });
    } catch (err) {
      res.status(500).json({ error: '获取缴纳明细失败' });
    }
  }

  static async payCollection(req, res) {
    try {
      const { amount } = req.body;
      const success = await FeeCollection.pay(req.params.id, req.user.id, amount);
      res.json({ success, message: success ? '缴纳成功' : '缴纳失败' });
    } catch (err) {
      res.status(500).json({ error: '缴纳失败' });
    }
  }

  static async exemptCollection(req, res) {
    try {
      if (req.user.role !== BACKEND_ROLES.LIFE_VICE && !req.user.isAdmin) {
        return res.status(403).json({ error: '仅生活副区可操作' });
      }
      const { userId, remark } = req.body;
      const success = await FeeCollection.markExempt(req.params.id, userId, remark);
      res.json({ success, message: success ? '已标记免缴' : '操作失败' });
    } catch (err) {
      res.status(500).json({ error: '免缴操作失败' });
    }
  }

  static async closeCollection(req, res) {
    try {
      if (req.user.role !== BACKEND_ROLES.LIFE_VICE && !req.user.isAdmin) {
        return res.status(403).json({ error: '仅生活副区可操作' });
      }
      const success = await FeeCollection.close(req.params.id);
      res.json({ success, message: success ? '已截止收缴' : '操作失败' });
    } catch (err) {
      res.status(500).json({ error: '截止收缴失败' });
    }
  }

  // === 申请 (expenses) ===
  static async createExpense(req, res) {
    try {
      const { amount, type, purpose, proof_url, details, semester } = req.body;
      const expenseId = await Fee.createExpense({
        user_id: req.user.id,
        amount, type: type || '支出', purpose, proof_url, details, semester
      });
      res.json({ success: true, expenseId, message: '申请已提交，等待审批' });
    } catch (err) {
      console.error('提交申请失败:', err);
      res.status(500).json({ error: '提交申请失败' });
    }
  }

  static async getMyExpenses(req, res) {
    try {
      const expenses = await Fee.getExpensesByUserId(req.user.id);
      res.json({ success: true, expenses });
    } catch (err) {
      res.status(500).json({ error: '获取记录失败' });
    }
  }

  static async getAllExpenses(req, res) {
    try {
      if (!isBackendAdmin(req.user)) {
        return res.status(403).json({ error: '仅干部可查看全部记录' });
      }
      const expenses = await Fee.getAllExpenses();
      res.json({ success: true, expenses });
    } catch (err) {
      res.status(500).json({ error: '获取全部记录失败' });
    }
  }

  static async getExpenseDetail(req, res) {
    try {
      const expense = await Fee.getExpenseWithApprovals(req.params.id);
      if (!expense) return res.status(404).json({ error: '记录不存在' });
      res.json({ success: true, expense });
    } catch (err) {
      res.status(500).json({ error: '获取详情失败' });
    }
  }

  // === 审批 ===
  static async getPendingApprovals(req, res) {
    try {
      if (!isBackendAdmin(req.user)) {
        return res.status(403).json({ error: '仅干部可查看' });
      }
      const approvals = await ExpenseApproval.getPendingApprovals(req.user.role);
      res.json({ success: true, approvals });
    } catch (err) {
      res.status(500).json({ error: '获取待审批列表失败' });
    }
  }

  static async approveExpense(req, res) {
    try {
      const { notes, action } = req.body;
      const id = req.params.id;
      const expense = await Fee.findExpenseById(id);
      if (!expense) return res.status(404).json({ error: '记录不存在' });

      const tier = expense.tier || (expense.amount <= 100 ? 'small' : expense.amount <= 500 ? 'medium' : 'large');
      const isLeader = req.user.role === 1 || req.user.role === 8; // 区队长或管理员

      let success = false;
      if (expense.approval_step === 1 && isLeader) {
        success = await ExpenseApproval.approveByLeader(id, req.user.id, notes);
      } else if (expense.approval_step === 2) {
        success = await ExpenseApproval.approveByAdvisor(id, req.user.id, notes);
      } else {
        return res.status(400).json({ error: '当前步骤无需您的审批' });
      }
      res.json({ success, message: success ? '审批成功' : '审批失败，可能已被处理' });
    } catch (err) {
      console.error('审批失败:', err);
      res.status(500).json({ error: '审批失败' });
    }
  }

  static async rejectExpense(req, res) {
    try {
      const { notes } = req.body;
      const id = req.params.id;
      const expense = await Fee.findExpenseById(id);
      if (!expense) return res.status(404).json({ error: '记录不存在' });
      const step = expense.approval_step || 1;
      const success = await ExpenseApproval.reject(id, step, req.user.id, notes);
      res.json({ success, message: success ? '已驳回' : '驳回失败' });
    } catch (err) {
      res.status(500).json({ error: '驳回失败' });
    }
  }

  static async castVote(req, res) {
    try {
      const { vote } = req.body; // 1=同意, 2=反对
      if (![1, 2].includes(vote)) {
        return res.status(400).json({ error: '投票值无效' });
      }
      const result = await ExpenseApproval.castVote(req.params.id, req.user.id, vote);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: '投票失败' });
    }
  }

  static async getVoteResult(req, res) {
    try {
      if (!isBackendAdmin(req.user)) {
        return res.status(403).json({ error: '仅干部可查看' });
      }
      const result = await ExpenseApproval.getVoteResult(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: '获取投票结果失败' });
    }
  }

  // === 公示 ===
  static async createPublication(req, res) {
    try {
      if (req.user.role !== BACKEND_ROLES.ORGANIZATION_COMMITTEE && !req.user.isAdmin) {
        return res.status(403).json({ error: '仅组织委员可发布公示' });
      }
      const id = await FeePublication.create({ ...req.body, published_by: req.user.id });
      res.json({ success: true, id, message: '公示已发布' });
    } catch (err) {
      res.status(500).json({ error: '发布公示失败' });
    }
  }

  static async listPublications(req, res) {
    try {
      const publications = await FeePublication.getAll();
      res.json({ success: true, publications });
    } catch (err) {
      res.status(500).json({ error: '获取公示列表失败' });
    }
  }

  static async getPublicationDetail(req, res) {
    try {
      const publication = await FeePublication.findById(req.params.id);
      if (!publication) return res.status(404).json({ error: '公示不存在' });
      res.json({ success: true, publication });
    } catch (err) {
      res.status(500).json({ error: '获取公示详情失败' });
    }
  }

  // === 汇总 ===
  static async getSummary(req, res) {
    try {
      const summary = await Fee.getSummary();
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ error: '获取汇总失败' });
    }
  }

  // === 老端点兼容 ===

  /** 获取班费余额（旧前端使用） */
  static async getBalance(req, res) {
    try {
      const summary = await Fee.getSummary();
      res.json({ success: true, balance: { balance: summary.balance, totalIncome: summary.totalIncome, totalExpense: summary.totalExpense } });
    } catch (err) {
      res.status(500).json({ error: '获取余额失败' });
    }
  }
}

module.exports = FeeController;
