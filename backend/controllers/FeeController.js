const Fee = require('../models/Fee');
const FeeCollection = require('../models/FeeCollection');
const ExpenseApproval = require('../models/ExpenseApproval');
const FeePublication = require('../models/FeePublication');
const { ROLES, isAdmin } = require('../shared/constants');
const { resolveScope, filterByOwnClassScope, canAccessOwnClassRecord } = require('../shared/scope');
const { stampClassId } = require('../shared/classStamp');

class FeeController {
  static _canReviewStep(user, step) {
    const role = Number(user?.role);
    if (role === ROLES.SUPER_ADMIN) return true;
    if (Number(step) === 1) return role === ROLES.CLASS_LEADER;
    if (Number(step) === 2) return role === ROLES.COUNSELOR || role === ROLES.SUPER_ADMIN;
    return false;
  }

  // === 收缴 ===
  static async createCollection(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const id = await FeeCollection.create({ ...req.body, created_by: req.user.id });
      await stampClassId('fee_collections', id, scope.writeClassId);
      res.json({ success: true, id, data: { id } });
    } catch (err) {
      console.error('创建收缴批次失败:', err);
      res.status(500).json({ success: false, error: '创建收缴批次失败' });
    }
  }

  static async listCollections(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const collections = filterByOwnClassScope(await FeeCollection.getAll(), scope);
      res.json({ success: true, collections, data: { collections } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取收缴列表失败' });
    }
  }

  static async getCollectionDetail(req, res) {
    try {
      const collection = await FeeCollection.findById(req.params.id);
      if (!collection) return res.status(404).json({ success: false, error: '收缴批次不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(collection, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该收缴批次' });
      }
      res.json({ success: true, collection, data: { collection } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取收缴详情失败' });
    }
  }

  static async getCollectionRecords(req, res) {
    try {
      const collection = await FeeCollection.findById(req.params.id);
      if (!collection) return res.status(404).json({ success: false, error: '收缴批次不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(collection, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该区队的缴纳明细' });
      }
      const records = await FeeCollection.getRecords(req.params.id);
      res.json({ success: true, records, data: { records } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取缴纳明细失败' });
    }
  }

  static async payCollection(req, res) {
    try {
      const { amount } = req.body;
      const success = await FeeCollection.pay(req.params.id, req.user.id, amount);
      res.json({ success, message: success ? '缴纳成功' : '缴纳失败' });
    } catch (err) {
      res.status(500).json({ success: false, error: '缴纳失败' });
    }
  }

  static async exemptCollection(req, res) {
    try {
      const { userId, remark } = req.body;
      const success = await FeeCollection.markExempt(req.params.id, userId, remark);
      res.json({ success, message: success ? '已标记免缴' : '操作失败' });
    } catch (err) {
      res.status(500).json({ success: false, error: '免缴操作失败' });
    }
  }

  static async closeCollection(req, res) {
    try {
      const success = await FeeCollection.close(req.params.id);
      res.json({ success, message: success ? '已截止收缴' : '操作失败' });
    } catch (err) {
      res.status(500).json({ success: false, error: '截止收缴失败' });
    }
  }

  // === 申请 (expenses) ===
  static async createExpense(req, res) {
    try {
      const { amount, type, purpose, proof_url, details, semester } = req.body;

      // 金额校验
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: '请输入有效金额' });
      }
      if (parsedAmount > 100000) {
        return res.status(400).json({ success: false, error: '单笔申请不超过¥100,000' });
      }

      const scope = await resolveScope(req.user);
      const id = await Fee.createExpense({
        user_id: req.user.id,
        amount: parsedAmount, type: type || '支出', purpose, proof_url, details, semester
      });
      await stampClassId('expenses', id, scope.writeClassId);
      res.json({ success: true, id, data: { id }, message: '申请已提交，等待审批' });
    } catch (err) {
      console.error('提交申请失败:', err);
      res.status(500).json({ success: false, error: '提交申请失败' });
    }
  }

  static async getMyExpenses(req, res) {
    try {
      const expenses = await Fee.getExpensesByUserId(req.user.id);
      res.json({ success: true, expenses, data: { expenses } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取记录失败' });
    }
  }

  static async getAllExpenses(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const expenses = filterByOwnClassScope(await Fee.getAllExpenses(), scope);
      res.json({ success: true, expenses, data: { expenses } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取全部记录失败' });
    }
  }

  static async getExpenseDetail(req, res) {
    try {
      const expense = await Fee.getExpenseWithApprovals(req.params.id);
      if (!expense) return res.status(404).json({ success: false, error: '记录不存在' });
      if (Number(expense.user_id) !== Number(req.user.id) && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: '无权查看该费用记录' });
      }
      if (Number(expense.user_id) !== Number(req.user.id)) {
        const scope = await resolveScope(req.user);
        if (!canAccessOwnClassRecord(expense, scope)) {
          return res.status(403).json({ success: false, error: '无权查看该区队的费用记录' });
        }
      }
      res.json({ success: true, expense, data: { expense } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取详情失败' });
    }
  }

  // === 审批 ===
  static async getPendingApprovals(req, res) {
    try {
      // 普通学员可看到大额费用的投票阶段；干部按角色看到对应审批步骤。
      const approvals = await ExpenseApproval.getPendingApprovals(req.user.role);
      res.json({ success: true, approvals, data: { approvals } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取待审批列表失败' });
    }
  }

  static async approveExpense(req, res) {
    try {
      const { notes } = req.body;
      const id = req.params.id;
      const expense = await Fee.findExpenseById(id);
      if (!expense) return res.status(404).json({ success: false, error: '记录不存在' });

      const role = Number(req.user.role);
      const isLeader = role === ROLES.CLASS_LEADER || role === ROLES.SUPER_ADMIN;
      const isCounselor = role === ROLES.COUNSELOR || role === ROLES.SUPER_ADMIN;

      let success = false;
      if (expense.approval_step === 1 && isLeader) {
        success = await ExpenseApproval.approveByLeader(id, req.user.id, notes);
      } else if (expense.approval_step === 2 && isCounselor) {
        success = await ExpenseApproval.approveByAdvisor(id, req.user.id, notes);
      } else {
        return res.status(400).json({ success: false, error: '当前步骤无需您的审批' });
      }
      res.json({ success: true, message: success ? '审批成功' : '审批失败，可能已被处理' });
    } catch (err) {
      console.error('审批失败:', err);
      res.status(500).json({ success: false, error: '审批失败' });
    }
  }

  static async rejectExpense(req, res) {
    try {
      const { notes } = req.body;
      const id = req.params.id;
      const expense = await Fee.findExpenseById(id);
      if (!expense) return res.status(404).json({ success: false, error: '记录不存在' });
      const step = expense.approval_step || 1;
      if (!FeeController._canReviewStep(req.user, step)) {
        return res.status(403).json({ success: false, error: '当前步骤无权驳回' });
      }
      const success = await ExpenseApproval.reject(id, step, req.user.id, notes);
      res.json({ success: true, message: success ? '已驳回' : '驳回失败' });
    } catch (err) {
      res.status(500).json({ success: false, error: '驳回失败' });
    }
  }

  static async castVote(req, res) {
    try {
      // 权限由路由 APPROVE_FEE_USE 把关；申请人本人不可投票（业务规则见模型层）
      const { vote } = req.body; // 1=同意, 2=反对
      const numericVote = Number(vote);
      if (![1, 2].includes(numericVote)) {
        return res.status(400).json({ success: false, error: '投票值无效' });
      }
      const result = await ExpenseApproval.castVote(req.params.id, req.user.id, numericVote);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: '投票失败' });
    }
  }

  static async getVoteResult(req, res) {
    try {
      const result = await ExpenseApproval.getVoteResult(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取投票结果失败' });
    }
  }

  // === 公示 ===
  static async createPublication(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const id = await FeePublication.create({ ...req.body, published_by: req.user.id });
      await stampClassId('fee_publications', id, scope.writeClassId);
      res.json({ success: true, id, data: { id }, message: '公示已发布' });
    } catch (err) {
      res.status(500).json({ success: false, error: '发布公示失败' });
    }
  }

  static async listPublications(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const publications = filterByOwnClassScope(await FeePublication.getAll(), scope);
      res.json({ success: true, publications, data: { publications } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取公示列表失败' });
    }
  }

  static async getPublicationDetail(req, res) {
    try {
      const publication = await FeePublication.findById(req.params.id);
      if (!publication) return res.status(404).json({ success: false, error: '公示不存在' });
      const scope = await resolveScope(req.user);
      if (!canAccessOwnClassRecord(publication, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该公示' });
      }
      res.json({ success: true, publication, data: { publication } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取公示详情失败' });
    }
  }

  // === 汇总 ===
  static async getSummary(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const role = Number(req.user.role);
      const classId = role >= 8 ? (req.query.class_id || null) : scope.classId;
      const summary = await Fee.getSummary(classId);
      res.json({ success: true, summary, data: { summary } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取汇总失败' });
    }
  }

  /** 证明材料上传 */
  static async uploadProof(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择文件' });
      }
      const url = `/uploads/resources/${req.file.filename}`;
      res.json({ success: true, url, filename: req.file.originalname, size: req.file.size });
    } catch (err) {
      console.error('证明材料上传失败:', err);
      res.status(500).json({ success: false, error: '上传失败' });
    }
  }
}

module.exports = FeeController;
