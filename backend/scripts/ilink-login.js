#!/usr/bin/env node
/**
 * 微信（iLink Bot API）扫码登录：获取 account_id / token，并保存到凭证文件。
 * 用法：node scripts/ilink-login.js
 * 说明：iLink 登录得到的是「机器人身份」，通常无法被拉进普通微信群（群事件多数不下发），可靠场景是私聊。
 */
const fs = require('fs');
const path = require('path');
const ilink = require('../services/channel/ilinkClient');
const { env } = require('../config/env');

const CRED_FILE = env.WEIXIN_CREDENTIALS_FILE;

async function main() {
  console.log('正在向 iLink 申请二维码…');
  const qr = await ilink.fetchQrCode(3);
  const qrcode = qr.qrcode || qr.qrcode_value || '';
  const qrcodeUrl = qr.qrcode_img_content || qr.qrcode_url || '';
  if (!qrcode) {
    console.error('获取二维码失败：', JSON.stringify(qr).slice(0, 300));
    process.exit(1);
  }
  console.log('\n请用微信扫描以下二维码（若终端无法显示，可复制链接到浏览器生成二维码）：');
  if (qrcodeUrl) console.log(qrcodeUrl);
  console.log('qrcode=' + qrcode);

  let base = ilink.baseUrl();
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    let status;
    try {
      status = await ilink.pollQrStatus(qrcode, base);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const st = String(status.status || 'wait');
    if (st === 'wait') process.stdout.write('.');
    else if (st === 'scaned') console.log('\n已扫码，请在手机上确认…');
    else if (st === 'scaned_but_redirect' && status.redirect_host) {
      base = 'https://' + status.redirect_host;
      console.log('\n重定向到 ' + base);
    } else if (st === 'expired') {
      console.log('\n二维码已过期，请重新运行本脚本。');
      process.exit(1);
    } else if (st === 'confirmed') {
      const creds = {
        account_id: String(status.ilink_bot_id || ''),
        token: String(status.bot_token || ''),
        base_url: String(status.baseurl || ilink.DEFAULT_BASE_URL),
        user_id: String(status.ilink_user_id || '')
      };
      if (!creds.account_id || !creds.token) {
        console.error('\n登录已确认但凭证不完整：', JSON.stringify(status).slice(0, 300));
        process.exit(1);
      }
      fs.mkdirSync(path.dirname(CRED_FILE), { recursive: true, mode: 0o700 });
      fs.writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
      console.log('\n✅ 微信连接成功');
      console.log('  account_id = ' + creds.account_id);
      console.log('  凭证已保存到 ' + CRED_FILE);
      console.log('\n请把下面两行加入 backend/.env 后重启 worker：');
      console.log('  WEIXIN_ACCOUNT_ID=' + creds.account_id);
      console.log('  WEIXIN_TOKEN=' + creds.token);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log('\n登录超时。');
  process.exit(1);
}

main().catch((e) => { console.error('ILINK_LOGIN_ERROR:', e.message); process.exit(1); });
