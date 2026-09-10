const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../config/logger');

function isConfigured() {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: String(env.SMTP_SECURE) === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });
  }
  return transporter;
}

/**
 * 发送邮件。未配置 SMTP 时返回 { skipped: true }（调用方负责落盘兜底）。
 */
async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    logger.warn('SMTP 未配置，邮件未发送（将仅落盘）');
    return { skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
  }
  const from = env.MAIL_FROM || env.SMTP_USER;
  const info = await getTransporter().sendMail({ from, to, subject, text, html });
  logger.info({ to, subject, messageId: info.messageId }, '邮件已发送');
  return { skipped: false, messageId: info.messageId };
}

module.exports = { isConfigured, sendMail };
