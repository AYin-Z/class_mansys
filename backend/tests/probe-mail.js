const mailer = require('../services/mailer');
const { env } = require('../config/env');
(async () => {
  const to = env.SUGGESTION_DIGEST_TO || '2792715318@qq.com';
  const r = await mailer.sendMail({
    to,
    subject: '[class_mansys] SMTP 连通性测试',
    text: '这是一封来自区队管理系统的测试邮件。\n\n如果你收到它，说明：\n1) QQ 邮箱 SMTP 授权码配置正确；\n2) 每日建议汇总（每天 08:00）可以正常送达此邮箱。',
    html: '<p>这是一封来自<strong>区队管理系统</strong>的测试邮件。</p><p>收到即表示 SMTP 配置正确，每日建议汇总（每天 08:00）可正常送达。</p>'
  });
  console.log(JSON.stringify(r));
  process.exit(0);
})().catch(e => { console.error('MAIL_ERROR:', e.message); process.exit(1); });
