const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const db = require('../config/database');
const { env } = require('../config/env');
const { PERMISSION_KEYS, PERMISSION_LABELS, currentMatrix } = require('../shared/permissions');

const BACKUP_DIR = process.env.BACKUP_DIR || '/home/ayin/db_backups';
const DIGEST_DIR = path.join(BACKUP_DIR, 'digests');

function exec(cmd, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || err?.message || '').trim() });
    });
  });
}

function safeList(dir, filter) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => (filter ? filter(f) : true))
      .map((f) => {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        return { name: f, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  } catch (e) {
    return [];
  }
}

/**
 * 超管控制台：服务端聚合数据
 *
 * 原则：所有统计都在 SQL 里一次算完，前端不再拉全量名册自己数
 * （此前概览用 listMembers(pageSize=200) 计算，超过 200 人的中队会算错）。
 */
class AdminConsole {
  /** 总览：规模、今日出勤、待办、近 7 日趋势、近期操作 */
  static async overview() {
    const [[companies]] = await db.query('SELECT COUNT(*) AS c FROM companies');
    const [[classes]] = await db.query('SELECT COUNT(*) AS c FROM classes');
    const [[people]] = await db.query(
      "SELECT COUNT(*) AS total, SUM(member_type = 'student') AS students, SUM(member_type = 'left') AS lefts, " +
      "SUM(member_type = 'student' AND role BETWEEN 1 AND 7) AS cadres, SUM(role = 8) AS admins, SUM(member_type = 'staff') AS staffs " +
      'FROM users'
    );
    // 口径统一：只看在编学员（member_type='student'）且未撤销的请假，
    // 否则控制台「当前在假/待审批」会混入辅导员、系统账号与已离开人员，与中队页对不上。
    const [[leaves]] = await db.query(
      "SELECT SUM(l.status = 0 AND l.is_cancelled = 0) AS pending, " +
      "SUM(l.status = 1 AND l.is_cancelled = 0 AND l.start_time <= NOW() AND l.end_time >= NOW()) AS ongoing, " +
      "SUM(l.status = 0 AND l.is_cancelled = 0 AND l.start_time < NOW()) AS overdue " +
      "FROM leaves l JOIN users u ON u.id = l.user_id WHERE u.member_type = 'student'"
    );

    const [trend] = await db.query(
      "SELECT DATE(created_at) AS day, COUNT(*) AS c FROM leaves WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at) ORDER BY day"
    );
    const [byClass] = await db.query(
      'SELECT c.id AS class_id, c.name AS class_name, ' +
      "COUNT(CASE WHEN u.member_type = 'student' THEN 1 END) AS students, " +
      "COUNT(CASE WHEN u.member_type = 'student' AND u.role BETWEEN 1 AND 7 THEN 1 END) AS cadres, " +
      "COUNT(CASE WHEN u.member_type = 'left' THEN 1 END) AS lefts " +
      'FROM classes c LEFT JOIN users u ON u.class_id = c.id GROUP BY c.id, c.name ORDER BY c.id'
    );
    const [roleDist] = await db.query(
      "SELECT role, COUNT(*) AS c FROM users WHERE member_type = 'student' GROUP BY role ORDER BY role"
    );

    // 今日请假（按类型）
    const [todayByType] = await db.query(
      'SELECT l.leave_type, COUNT(*) AS c FROM leaves l JOIN users u ON u.id = l.user_id ' +
      "WHERE u.member_type = 'student' AND l.is_cancelled = 0 AND l.status = 1 " +
      'AND DATE(l.start_time) = CURDATE() GROUP BY l.leave_type ORDER BY c DESC'
    );

    const [recentOps] = await db.query(
      'SELECT o.id, o.action, o.method, o.path, o.status_code, o.created_at, u.name AS user_name ' +
      'FROM operation_logs o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 10'
    );

    const [[pendingFee]] = await db.query(
      'SELECT COUNT(*) AS c FROM expenses WHERE status = 0'
    ).catch(() => [[{ c: 0 }]]);
    const [[pendingHomework]] = await db.query(
      'SELECT COUNT(*) AS c FROM homework_submissions WHERE status = 0'
    ).catch(() => [[{ c: 0 }]]);
    const [[unhandledSuggestion]] = await db.query(
      "SELECT COUNT(*) AS c FROM suggestions WHERE status = 0"
    ).catch(() => [[{ c: 0 }]]);
    const [[pendingPsych]] = await db.query(
      'SELECT COUNT(*) AS c FROM psychological_applications WHERE status = 0'
    ).catch(() => [[{ c: 0 }]]);
    const [[pendingPhoto]] = await db.query('SELECT COUNT(*) AS c FROM photos WHERE is_approved = 0').catch(() => [[{ c: 0 }]]);

    const [[agent]] = await db.query(
      'SELECT (SELECT COUNT(*) FROM agent_conversations) AS conversations, ' +
      '(SELECT COUNT(*) FROM agent_messages) AS messages, ' +
      '(SELECT COUNT(*) FROM agent_messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS messages_7d, ' +
      '(SELECT COUNT(DISTINCT user_id) FROM agent_conversations) AS users'
    ).catch(() => [[{ conversations: 0, messages: 0, messages_7d: 0, users: 0 }]]);
    const [[tokens]] = await db.query('SELECT COUNT(*) AS c FROM api_tokens WHERE revoked_at IS NULL').catch(() => [[{ c: 0 }]]);
    const [[bindings]] = await db.query("SELECT COUNT(*) AS c FROM agent_channel_bindings WHERE status = 'active'").catch(() => [[{ c: 0 }]]);
    const [[errors24h]] = await db.query(
      'SELECT COUNT(*) AS c FROM operation_logs WHERE status_code >= 500 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );

    const [[dbSize]] = await db.query(
      'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb, COUNT(*) AS tables FROM information_schema.TABLES WHERE table_schema = DATABASE()'
    );

    return {
      scale: {
        companies: Number(companies.c),
        classes: Number(classes.c),
        users: Number(people.total || 0),
        students: Number(people.students || 0),
        cadres: Number(people.cadres || 0),
        admins: Number(people.admins || 0),
        staff: Number(people.staffs || 0),
        left: Number(people.lefts || 0)
      },
      today: {
        date: new Date().toISOString().slice(0, 10),
        onLeave: Number(leaves.ongoing || 0),
        pendingLeaves: Number(leaves.pending || 0),
        overduePending: Number(leaves.overdue || 0),
        byType: todayByType.map((r) => ({ type: r.leave_type, count: Number(r.c) }))
      },
      todos: {
        pendingLeaves: Number(leaves.pending || 0),
        pendingFee: Number(pendingFee.c || 0),
        pendingHomework: Number(pendingHomework.c || 0),
        unhandledSuggestion: Number(unhandledSuggestion.c || 0),
        pendingPsych: Number(pendingPsych.c || 0),
        pendingPhoto: Number(pendingPhoto.c || 0)
      },
      classes: byClass.map((r) => ({
        class_id: String(r.class_id),
        class_name: r.class_name,
        students: Number(r.students || 0),
        cadres: Number(r.cadres || 0),
        left: Number(r.lefts || 0)
      })),
      roleDist: roleDist.map((r) => ({ role: Number(r.role), count: Number(r.c) })),
      trend: trend.map((r) => ({ day: String(r.day instanceof Date ? r.day.toISOString().slice(0, 10) : r.day), count: Number(r.c) })),
      recentOps,
      agent: {
        conversations: Number(agent.conversations || 0),
        messages: Number(agent.messages || 0),
        messages7d: Number(agent.messages_7d || 0),
        users: Number(agent.users || 0),
        activeTokens: Number(tokens.c || 0),
        wechatBindings: Number(bindings.c || 0)
      },
      health: {
        errors24h: Number(errors24h.c || 0),
        dbSizeMb: Number(dbSize.mb || 0),
        tables: Number(dbSize.tables || 0)
      }
    };
  }

  /** 待办聚合（按模块给数量与入口） */
  static async todos() {
    const q = async (sql, fallback = 0) => {
      try { const [[row]] = await db.query(sql); return Number(Object.values(row)[0] || 0); } catch (e) { return fallback; }
    };
    const [pendingLeaves, ongoingLeaves, pendingFee, pendingHomework, unhandledSuggestion, pendingPsych, pendingPhoto] = await Promise.all([
      q("SELECT COUNT(*) AS c FROM leaves l JOIN users u ON u.id = l.user_id WHERE u.member_type = 'student' AND l.status = 0 AND l.is_cancelled = 0"),
      q("SELECT COUNT(*) AS c FROM leaves l JOIN users u ON u.id = l.user_id WHERE u.member_type = 'student' AND l.status = 1 AND l.is_cancelled = 0 AND l.start_time <= NOW() AND l.end_time >= NOW()"),
      q('SELECT COUNT(*) AS c FROM expenses WHERE status = 0'),
      q('SELECT COUNT(*) AS c FROM homework_submissions WHERE status = 0'),
      q('SELECT COUNT(*) AS c FROM suggestions WHERE status = 0'),
      q('SELECT COUNT(*) AS c FROM psychological_applications WHERE status = 0'),
      q('SELECT COUNT(*) AS c FROM photos WHERE is_approved = 0')
    ]);
    return [
      { key: 'leave', label: '待审批请假', count: pendingLeaves, path: '/pages/leave/approvals' },
      { key: 'leave_ongoing', label: '当前在假', count: ongoingLeaves, path: '/pages/company/index' },
      { key: 'fee', label: '待审批报销', count: pendingFee, path: '/pages/fee/approvals' },
      { key: 'homework', label: '待批改作业', count: pendingHomework, path: '/pages/homework/index' },
      { key: 'suggestion', label: '待处理建议', count: unhandledSuggestion, path: '/pages/suggestion/inbox' },
      { key: 'psych', label: '待处理心理申请', count: pendingPsych, path: '/pages/psychological/index' },
      { key: 'photo', label: '待审核照片', count: pendingPhoto, path: '/pages/album/index' }
    ];
  }

  /** Agent / 渠道 / 令牌 全局视角 */
  static async agentPanel() {
    const [daily] = await db.query(
      'SELECT DATE(created_at) AS day, COUNT(*) AS messages, COUNT(DISTINCT conversation_id) AS conversations ' +
      'FROM agent_messages WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(created_at) ORDER BY day'
    ).catch(() => [[]]);
    const [tokens] = await db.query(
      'SELECT t.id, t.name, t.prefix, t.allow_write, t.last_used_at, t.revoked_at, t.created_at, u.name AS user_name, u.student_id, u.class_id ' +
      'FROM api_tokens t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT 100'
    ).catch(() => [[]]);
    const [bindings] = await db.query(
      'SELECT b.id, b.channel, b.external_id, b.display_name, b.status, b.created_at, u.name AS user_name, u.class_id ' +
      'FROM agent_channel_bindings b LEFT JOIN users u ON u.id = b.user_id ORDER BY b.id DESC LIMIT 100'
    ).catch(() => [[]]);
    const [[quota]] = await db.query(
      "SELECT COUNT(*) AS messages_24h, COUNT(DISTINCT user_id) AS users_24h FROM agent_messages WHERE role = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
    ).catch(() => [[{ messages_24h: 0, users_24h: 0 }]]);
    const [topTools] = await db.query(
      "SELECT JSON_UNQUOTE(JSON_EXTRACT(tool_calls, '$[0].pendingAction.tool')) AS tool, COUNT(*) AS c " +
      'FROM agent_messages WHERE tool_calls IS NOT NULL GROUP BY tool ORDER BY c DESC LIMIT 10'
    ).catch(() => [[]]);
    const worker = await exec('systemctl', ['--user', 'is-active', 'class-mansys-ilink']);
    return {
      daily: daily.map((r) => ({ day: String(r.day), messages: Number(r.messages), conversations: Number(r.conversations) })),
      tokens,
      bindings,
      quota: { messages24h: Number(quota.messages_24h || 0), users24h: Number(quota.users_24h || 0), dailyLimitPerUser: env.AGENT_DAILY_QUOTA },
      topTools: topTools.filter((t) => t.tool).map((t) => ({ tool: t.tool, count: Number(t.c) })),
      llmMode: env.AGENT_LLM_MODE,
      wechat: {
        worker: worker.out || 'unknown',
        configured: !!(env.WEIXIN_ACCOUNT_ID && env.WEIXIN_TOKEN),
        credentialsFile: env.WEIXIN_CREDENTIALS_FILE
      }
    };
  }

  /** 系统状态：进程、数据库、迁移、定时任务、备份、摘要文件、开关 */
  static async systemStatus() {
    const [migrations] = await db.query('SELECT id, applied_at FROM schema_migrations ORDER BY applied_at').catch(() => [[]]);
    const [[tables]] = await db.query(
      'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE table_schema = DATABASE()'
    );
    const timers = await exec('systemctl', ['--user', 'list-timers', '--all', '--no-pager'], 10000);
    const service = await exec('systemctl', ['--user', 'is-active', 'class-mansys']);
    const backups = safeList(BACKUP_DIR, (f) => f.startsWith('class_manage_sys_') && f.endsWith('.json'));
    const digests = safeList(DIGEST_DIR, (f) => f.endsWith('.txt'));
    const [[errors24h]] = await db.query(
      'SELECT COUNT(*) AS c FROM operation_logs WHERE status_code >= 500 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    ).catch(() => [[{ c: 0 }]]);
    const [errorsByPath] = await db.query(
      'SELECT path, method, COUNT(*) AS c FROM operation_logs WHERE status_code >= 500 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY path, method ORDER BY c DESC LIMIT 10'
    ).catch(() => [[]]);
    const [slowPaths] = await db.query(
      'SELECT path, COUNT(*) AS c FROM operation_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY path ORDER BY c DESC LIMIT 10'
    ).catch(() => [[]]);

    return {
      process: {
        node: process.version,
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        pid: process.pid,
        env: env.NODE_ENV,
        port: env.PORT,
        service
      },
      database: {
        name: env.DB_NAME,
        tables: Number(tables.c || 0),
        migrationsApplied: migrations.length,
        lastMigration: migrations.length ? migrations[migrations.length - 1] : null
      },
      timers: timers.ok ? timers.out.split('\n').slice(0, 12) : [timers.err || 'systemd 不可用'],
      backups: backups.slice(0, 10),
      digests: digests.slice(0, 5),
      errors: {
        count24h: Number(errors24h.c || 0),
        byPath: errorsByPath.map((r) => ({ path: r.path, method: r.method, count: Number(r.c) })),
        topPaths: slowPaths.map((r) => ({ path: r.path, count: Number(r.c) }))
      },
      flags: {
        AGENT_LLM_MODE: env.AGENT_LLM_MODE,
        UPLOAD_AUTH_MODE: env.UPLOAD_AUTH_MODE,
        llmConfigured: !!env.LLM_API_KEY,
        smtpConfigured: !!env.SMTP_HOST,
        digestTo: env.SUGGESTION_DIGEST_TO || '',
        wechatConfigured: !!(env.WEIXIN_ACCOUNT_ID && env.WEIXIN_TOKEN),
        apkDir: env.APK_DIR,
        uploadDir: env.UPLOAD_DIR
      }
    };
  }

  /** 触发一次数据库备份（复用 scripts/backup.sh） */
  static async runBackup() {
    const script = path.join(__dirname, '..', 'scripts', 'backup.sh');
    if (!fs.existsSync(script)) throw new Error('备份脚本不存在: ' + script);
    const res = await exec('bash', [script], 120000);
    const backups = safeList(BACKUP_DIR, (f) => f.startsWith('class_manage_sys_') && f.endsWith('.json'));
    return { ok: res.ok, output: (res.out + '\n' + res.err).trim().split('\n').slice(-6).join('\n'), latest: backups[0] || null };
  }

  /** 权限矩阵（含中文说明） */
  static async permissionMatrix() {
    const matrix = currentMatrix();
    const keys = PERMISSION_KEYS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key] || key,
      roles: (matrix[key] || []).slice().sort((a, b) => a - b)
    }));
    return { keys, defaults: require('../shared/permissions').PERMISSIONS };
  }
}

module.exports = AdminConsole;
