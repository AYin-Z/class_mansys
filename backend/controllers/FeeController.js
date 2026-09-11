const Fee = require('../models/Fee');
const FeeCollection = require('../models/FeeCollection');
const ExpenseApproval = require('../models/ExpenseApproval');
const FeePublication = require('../models/FeePublication');
const { ROLES, isAdmin } = require('../shared/constants');
const { resolveScope, filterByOwnClassScope, canAccessOwnClassRecord } = require('../shared/scope');

/**
 * 班费控制器
 *
 * 审计修复要点（原实现的越权与算错）：
 * - 缴/免缴/截止、审批/驳回/投票、待审批列表、公示 全部补区队作用域；
 * - 缴纳金额以服务端「人均应缴」为准；只允许未截止批次；已缴不再静默覆盖；
 * - 审批/驳回失败时返回 success:false（原来无论成败都回 success:true，前端会误报已审批）；
 * - 报销 type 收敛为 支出/收入、purpose 必填；建单与审批链同一事务；
 * - 公示汇总按本区队过滤并纳入收缴收入。
 */
class FeeController {
  static _canReviewStep(user, step) {
    const role = Number(user?.role);
    if (role === ROLES.SUPER_ADMIN) return true;
    if (Number(step) === 1) return role === ROLES.CLASS_LEADER;
    if (Number(step) === 2) return role === ROLES.COUNSELOR || role === ROLES.SUPER_ADMIN;
    return false;
  }

  /** 是否能操作该班费记录（本人 or 本区队管理） */
  static _inScope(record, scope) {
    return canAccessOwnClassRecord(record, scope);
  }

  // === 收缴 ===
  static async createCollection(req, res) {
    try {
      const scope = await resolveScope(req.user);
      if (!scope.writeClassId && Number(req.user.role) >= 8 && req.body.class_id) {
        // 超管可代某区队发起
        scope.writeClassId = String(req.body.class_id);
      }
      const id = await FeeCollection.create({
        title: req.body.title,
        amount_per_person: req.body.amount_per_person,
        semester: req.body.semester,
        created_by: req.user.id,
        class_id: scope.writeClassId
      });
      res.json({ success: true, id, data: { id } });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error: '本学期已存在同名收缴批次，请换个标题' });
      }
      const status = err && /人均金额|区队|在编学员|title/.test(err.message || '') ? 400 : 500;
      if (status === 500) console.error('创建收缴批次失败:', err);
      res.status(status).json({ success: false, error: err.message || '创建收缴批次失败' });
    }
  }

  static async listCollections(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const collections = await FeeCollection.getAll(
        Array.isArray(scope.classIds) ? scope.classIds : null,
        req.user.id
      );
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
      if (!FeeController._inScope(collection, scope)) {
        return res.status(403).json({ success: false, error: '无权查看该收缴批次' });
      }
      const mine = await FeeCollection.myRecord(req.params.id, req.user.id);
      res.json({ success: true, collection: Object.assign({}, collection, { my_record: mine }), data: { collection } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取收缴详情失败' });
    }
  }

  static async getCollectionRecords(req, res) {
    try {
      const collection = await FeeCollection.findById(req.params.id);
      if (!collection) return res.status(404).json({ success: false, error: '收缴批次不存在' });
      const scope = await resolveScope(req.user);
      if (!FeeController._inScope(collection, scope)) {
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
      const scope = await resolveScope(req.user);
      const collection = await FeeCollection.findById(req.params.id);
      if (!collection) return res.status(404).json({ success: false, error: '收缴批次不存在' });
      if (Array.isArray(scope.classIds) && scope.classIds.indexOf(String(collection.class_id)) === -1) {
        return res.status(403).json({ success: false, error: '无权向其他区队的收缴批次缴纳' });
      }
      const result = await FeeCollection.pay(req.params.id, req.user.id, req.body.amount);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('缴纳失败:', err);
      res.status(500).json({ success: false, error: '缴纳失败' });
    }
  }

  static async exemptCollection(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const result = await FeeCollection.markExempt(req.params.id, req.body.userId, req.body.remark, scope.classIds);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('免缴操作失败:', err);
      res.status(500).json({ success: false, error: '免缴操作失败' });
    }
  }

  static async closeCollection(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const result = await FeeCollection.close(req.params.id, scope.classIds);
      return res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('截止收缴失败:', err);
      res.status(500).json({ success: false, error: '截止收缴失败' });
    }
  }

  // === 申请 (expenses) ===
  static async createExpense(req, res) {
    try {
      const { amount, type, purpose, proof_url, details, semester } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, error: '请输入有效金额' });
      }
      if (parsedAmount > 100000) {
        return res.status(400).json({ success: false, error: '单笔申请不超过¥100,000' });
      }
      const finalType = type || '支出';
      if (['支出', '收入'].indexOf(finalType) === -1) {
        return res.status(400).json({ success: false, error: '费用类型只能是 支出/收入' });
      }
      if (!purpose || !String(purpose).trim()) {
        return res.status(400).json({ success: false, error: '请填写用途说明' });
      }
      if (proof_url && !/^\/uploads\//.test(String(proof_url))) {
        return res.status(400).json({ success: false, error: '证明材料地址不合法' });
      }

      const scope = await resolveScope(req.user);
      const id = await Fee.createExpense({
        user_id: req.user.id,
        amount: parsedAmount,
        type: finalType,
        purpose: String(purpose).slice(0, 500),
        proof_url: proof_url || null,
        details,
        semester,
        class_id: scope.writeClassId
      });
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
      if (Number(expense.user_id) !== Number(req.user.id)) {
        if (!isAdmin(req.user)) return res.status(403).json({ success: false, error: '无权查看该费用记录' });
        const scope = await resolveScope(req.user);
        if (!FeeController._inScope(expense, scope)) {
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
      const scope = await resolveScope(req.user);
      const approvals = await ExpenseApproval.getPendingApprovals(
        req.user.role,
        Array.isArray(scope.classIds) ? scope.classIds : null
      );
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
      const scope = await resolveScope(req.user);
      if (!FeeController._inScope(expense, scope)) {
        return res.status(403).json({ success: false, error: '无权审批其他区队的费用申请' });
      }
      if (Number(expense.status) !== 0) {
        return res.status(400).json({ success: false, error: '该申请已处理' });
      }
      const role = Number(req.user.role);
      const isLeader = role === ROLES.CLASS_LEADER || role === ROLES.SUPER_ADMIN;
      const isCounselor = role === ROLES.COUNSELOR || role === ROLES.SUPER_ADMIN;

      let success = false;
      if (Number(expense.approval_step) === 1 && isLeader) {
        success = await ExpenseApproval.approveByLeader(id, req.user.id, notes);
      } else if (Number(expense.approval_step) === 2 && isCounselor) {
        success = await ExpenseApproval.approveByAdvisor(id, req.user.id, notes);
      } else {
        return res.status(400).json({ success: false, error: '当前步骤无需您的审批' });
      }
      if (!success) {
        // 审计修复：原来无论成败都回 success:true，前端会误报「已审批通过」
        return res.status(409).json({ success: false, error: '审批失败，该申请可能已被他人处理' });
      }
      res.json({ success: true, message: '审批成功' });
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
      const scope = await resolveScope(req.user);
      if (!FeeController._inScope(expense, scope)) {
        return res.status(403).json({ success: false, error: '无权驳回其他区队的费用申请' });
      }
      if (Number(expense.status) !== 0) {
        return res.status(400).json({ success: false, error: '该申请已处理' });
      }
      const step = expense.approval_step || 1;
      if (!FeeController._canReviewStep(req.user, step)) {
        return res.status(403).json({ success: false, error: '当前步骤无权驳回' });
      }
      const success = await ExpenseApproval.reject(id, step, req.user.id, notes);
      if (!success) return res.status(409).json({ success: false, error: '驳回失败，该申请可能已被他人处理' });
      res.json({ success: true, message: '已驳回' });
    } catch (err) {
      res.status(500).json({ success: false, error: '驳回失败' });
    }
  }

  static async castVote(req, res) {
    try {
      const { vote } = req.body;
      const numericVote = Number(vote);
      if ([1, 2].indexOf(numericVote) === -1) {
        return res.status(400).json({ success: false, error: '投票值无效' });
      }
      const expense = await Fee.findExpenseById(req.params.id);
      if (!expense) return res.status(404).json({ success: false, error: '记录不存在' });
      const scope = await resolveScope(req.user);
      if (!FeeController._inScope(expense, scope)) {
        return res.status(403).json({ success: false, error: '无权对其它区队的费用投票' });
      }
      const result = await ExpenseApproval.castVote(req.params.id, req.user.id, numericVote);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: '投票失败' });
    }
  }

  static async getVoteResult(req, res) {
    try {
      const expense = await Fee.findExpenseById(req.params.id);
      if (!expense) return res.status(404).json({ success: false, error: '记录不存在' });
      const scope = await resolveScope(req.user);
      if (!FeeController._inScope(expense, scope)) {
        return res.status(403).json({ success: false, error: '无权查看其它区队的投票结果' });
      }
      const result = await ExpenseApproval.getVoteResult(req.params.id, expense.class_id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取投票结果失败' });
    }
  }

  // === 公示 ===
  static async createPublication(req, res) {
    try {
      const scope = await resolveScope(req.user);
      const classId = scope.writeClassId || (Number(req.user.role) >= 8 ? req.body.class_id : null);
      if (!classId) return res.status(400).json({ success: false, error: '缺少区队信息，无法发布公示' });
      const id = await FeePublication.create({
        title: req.body.title,
        period: req.body.period,
        published_by: req.user.id,
        class_id: classId
      });
      res.json({ success: true, id, data: { id }, message: '公示已发布' });
    } catch (err) {
      console.error('发布公示失败:', err);
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
      let classId;
      if (role >= 8) {
        classId = req.query.class_id || null;
      } else {
        classId = scope.classId || (Array.isArray(scope.classIds) ? scope.classIds[0] : null) || null;
        if (!classId) {
          // 没有区队归属的用户不能看全局账目
          return res.json({ success: true, summary: { balance: 0, totalIncome: 0, totalExpense: 0, totalCollected: 0 }, data: {} });
        }
      }
      const summary = await Fee.getSummary(classId);
      res.json({ success: true, summary, data: { summary } });
    } catch (err) {
      res.status(500).json({ success: false, error: '获取汇总失败' });
    }
  }

  /** 证明材料上传（仅图片，路径由 multer 决定） */
  static async uploadProof(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择文件' });
      }
      const url = '/uploads/resources/' + req.file.filename;
      res.json({ success: true, url, filename: req.file.originalname, size: req.file.size });
    } catch (err) {
      console.error('证明材料上传失败:', err);
      res.status(500).json({ success: false, error: '上传失败' });
    }
  }
}

module.exports = FeeController;
