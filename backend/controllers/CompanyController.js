const db = require('../config/database');
const Company = require('../models/Company');

/**
 * 取"今天"的本地日期（东八区）
 *
 * 不能用 new Date().toISOString().slice(0,10)：那是 UTC，
 * 北京时间 00:00-08:00 会把"今天"算成昨天（早操/早集合时段必现）。
 */
function todayLocal() {
  // 不能带 getTimezoneOffset()：宿主机时区恰好是东八区时会把偏移抵消掉，
  // 结果仍返回 UTC 日期；这里直接以 UTC+8 计算，与宿主机时区无关。
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
const { resolveScope } = require('../shared/scope');

/**
 * 中队（公司）级聚合控制器：为「贯通中队每日请销假 + 实时出勤」提供数据地基。
 * 访问权限：具备 hasCompanyView 的区队管理层可平行查看本中队。
 */
class CompanyController {
  /**
   * GET /api/company/overview?date=YYYY-MM-DD
   * 返回本中队各分区队出勤/请假统计 + 汇总。
   */
  static async overview(req, res) {
    try {
      const scope = await resolveScope(req.user);
      if (!scope.canViewCompany) {
        return res.status(403).json({ success: false, error: '仅区队管理层可查看中队概览' });
      }

      const date = (req.query.date || '').trim() || todayLocal();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'date 格式应为 YYYY-MM-DD' });
      }

      let classFilter = '';
      let params = [];
      const role = Number(req.user.role);
      if (role >= 1 && role <= 7) {
        // 区队管理层：平行查看本中队；若本班未归属中队，则退化为只看本区队
        if (scope.companyId) {
          classFilter = 'WHERE c.company_id = ?';
          params = [scope.companyId];
        } else if (scope.classIds && scope.classIds.length) {
          classFilter = 'WHERE c.id IN (' + scope.classIds.map(() => '?').join(',') + ')';
          params = scope.classIds;
        } else {
          return res.status(403).json({ success: false, error: '当前区队未归属任何中队' });
        }
      } else if (role === 0) {
        // 普通学员（防御性）
        classFilter = 'WHERE c.id IN (' + (scope.classIds || []).map(() => '?').join(',') + ')';
        params = scope.classIds || [];
      } else if (req.query.company_id) {
        // 超管/辅导员：可显式指定中队
        classFilter = 'WHERE c.company_id = ?';
        params = [req.query.company_id];
      }

      const query = [
        'SELECT c.id AS class_id, c.name AS class_name,',
        // total_members 只统计在队学生（排除已离开/管理员/老师），与 member_count 同口径
        "  COUNT(CASE WHEN u.member_type = 'student' THEN 1 END) AS total_members,",
        "  SUM(CASE WHEN u.member_type = 'student' THEN 1 ELSE 0 END) AS member_count,",
        '  (SELECT COUNT(DISTINCT l.user_id) FROM leaves l JOIN users ul ON l.user_id = ul.id',
        "    WHERE ul.class_id = c.id AND ul.member_type = 'student' AND l.status = 1 AND l.is_cancelled = 0",
        '      AND l.start_time < DATE_ADD(?, INTERVAL 1 DAY) AND l.end_time >= ?) AS on_leave_count,',
        '  (SELECT COUNT(DISTINCT l.user_id) FROM leaves l JOIN users ul ON l.user_id = ul.id',
        "    WHERE ul.class_id = c.id AND ul.member_type = 'student' AND l.status = 1 AND l.is_cancelled = 0",
        '      AND l.start_time <= NOW() AND l.end_time >= NOW()) AS currently_leave_count,',
        '  (SELECT COUNT(DISTINCT l.user_id) FROM leaves l JOIN users ul ON l.user_id = ul.id',
        "    WHERE ul.class_id = c.id AND ul.member_type = 'student' AND l.status = 1 AND l.is_cancelled = 0",
        '      AND l.end_time < NOW()) AS not_returned_count',
        'FROM classes c',
        'LEFT JOIN users u ON u.class_id = c.id',
        classFilter,
        'GROUP BY c.id, c.name',
        'ORDER BY c.id ASC'
      ].filter(Boolean).join(' ');

      const [rows] = await db.query(query, [date, date].concat(params));

      const classes = rows.map(r => ({
        class_id: r.class_id,
        class_name: r.class_name,
        total_members: Number(r.total_members || 0),
        member_count: Number(r.member_count || 0),
        on_leave: Number(r.on_leave_count || 0),
        present: Math.max(0, (Number(r.member_count || 0) - Number(r.on_leave_count || 0))),
        currently_leave: Number(r.currently_leave_count || 0),
        not_returned: Number(r.not_returned_count || 0)
      }));

      const summary = classes.reduce((acc, c) => {
        acc.total += c.member_count;
        acc.on_leave += c.on_leave;
        acc.present += c.present;
        acc.currently_leave += c.currently_leave;
        acc.not_returned += c.not_returned;
        return acc;
      }, { total: 0, on_leave: 0, present: 0, currently_leave: 0, not_returned: 0 });

      res.json({ success: true, date, classes, summary });
    } catch (e) {
      console.error('[company/overview] failed:', e);
      res.status(500).json({ success: false, error: '获取中队出勤概览失败' });
    }
  }

  /**
   * GET /api/company/classes
   * 列出本中队下的所有区队（含统计）。
   */
  static async classes(req, res) {
    try {
      const scope = await resolveScope(req.user);
      if (!scope.canViewCompany) {
        return res.status(403).json({ success: false, error: '仅区队管理层可查看中队区队列表' });
      }
      const allowQueryCompany = Number(req.user.role) >= 8;
      const companyId = (allowQueryCompany ? req.query.company_id : null) || scope.companyId || null;
      let classes;
      if (companyId) {
        classes = await Company.getClassesByCompany(companyId);
      } else if (Number(req.user.role) === 8 || Number(req.user.role) === 9) {
        const [rows] = await db.query(
          "SELECT c.id AS class_id, c.name AS class_name, c.company_id," +
          "  COUNT(CASE WHEN u.member_type = 'student' THEN 1 END) AS member_count" +
          " FROM classes c LEFT JOIN users u ON u.class_id = c.id" +
          " GROUP BY c.id, c.name, c.company_id ORDER BY c.id ASC"
        );
        classes = rows;
      } else {
        return res.status(403).json({ success: false, error: '当前未归属任何中队' });
      }

      const companyIds = [...new Set(classes.map(c => c.company_id).filter(Boolean))];
      const companies = companyIds.length ? await Company.getByIds(companyIds) : [];

      res.json({ success: true, companies, classes });
    } catch (e) {
      console.error('[company/classes] failed:', e);
      res.status(500).json({ success: false, error: '获取中队区队列表失败' });
    }
  }

  /**
   * GET /api/company/leave-records?date=YYYY-MM-DD&company_id=
   * 返回当天在假学员的请假明细（跨区队，仅管理/平行权限）。
   */
  static async leaveRecords(req, res) {
    try {
      const scope = await resolveScope(req.user);
      if (!scope.canViewCompany) {
        return res.status(403).json({ success: false, error: '仅区队管理层可查看中队请假明细' });
      }
      const date = (req.query.date || '').trim() || todayLocal();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'date 格式应为 YYYY-MM-DD' });
      }

      const role = Number(req.user.role);
      let records = [];
      const allowQueryCompany = Number(req.user.role) >= 8;
      const companyId = (allowQueryCompany ? req.query.company_id : null) || scope.companyId || null;
      if (companyId) {
        records = await Company.getLeaveRecordsByCompany(companyId, date);
      } else if (role >= 1 && role <= 7 && scope.classIds && scope.classIds.length) {
        records = await Company.getLeaveRecordsByClasses(scope.classIds, date);
      } else {
        // 超管/辅导员且未指定 company_id：取全部区队
        const [classes] = await db.query("SELECT id FROM classes WHERE id <> '0' ORDER BY id ASC");
        const classIds = classes.map(c => c.id);
        records = await Company.getLeaveRecordsByClasses(classIds, date);
      }

      res.json({ success: true, date, records });
    } catch (e) {
      console.error('[company/leave-records] failed:', e);
      res.status(500).json({ success: false, error: '获取中队请假明细失败' });
    }
  }
}

module.exports = CompanyController;
