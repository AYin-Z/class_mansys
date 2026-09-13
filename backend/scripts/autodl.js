#!/usr/bin/env node
/**
 * AutoDL 平台操作（开发者 API）
 *
 * 为什么自己写而不是装现成的 MCP 插件：
 * - AutoDL 的 API 极简（POST + Authorization 头），一个脚本就够，且**改完立刻能用**
 *   （MCP 插件要重启 DSH 会话才会出现工具）
 * - **安全闸门放在我们自己的仓库里**：开机/创建是**计费**操作、释放是**毁数据**操作，
 *   这类操作的确认逻辑必须可审计、跟代码走，不能藏在第三方依赖里
 * - 已有 26 工具的社区插件（wuzihuang/AUTODL-PLUGIN）值得之后评估，
 *   但按惯例要先审源码、pin 版本，而且它同样需要一个会话重启
 *
 * 用法：
 *   node scripts/autodl.js balance                 # 查余额（只读）
 *   node scripts/autodl.js list                    # 列实例（只读）
 *   node scripts/autodl.js status <uuid>           # 实例状态（只读）
 *   node scripts/autodl.js snapshot <uuid>         # 硬件/用量/SSH/Jupyter（只读）
 *   node scripts/autodl.js power-on <uuid> --yes   # 开机（计费！）
 *   node scripts/autodl.js power-off <uuid> --yes  # 关机
 *   node scripts/autodl.js release <uuid> --yes-i-mean-it   # 释放（毁数据！）
 *
 * token 来源：AUTODL_TOKEN 环境变量，或 ~/.class-mansys/autodl.token（600）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = 'https://api.autodl.com';
const TOKEN_FILE = process.env.AUTODL_TOKEN_FILE || path.join(os.homedir(), '.class-mansys', 'autodl.token');

function token() {
  const t = process.env.AUTODL_TOKEN || (fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : '');
  if (!t) {
    console.error('缺少 AutoDL 开发者 token：设置 AUTODL_TOKEN，或写入 ' + TOKEN_FILE);
    process.exit(2);
  }
  return t;
}

async function call(method, endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AUTODL_REQUEST_TIMEOUT_MS) || 20000);
  try {
    const res = await fetch(API + endpoint, {
      method,
      headers: { Authorization: token(), 'Content-Type': 'application/json' },
      // 即便没有参数也必须带 JSON body，否则服务端返回 RequestParameterIsWrong
      body: method === 'GET' ? JSON.stringify(body || {}) : JSON.stringify(body || {}),
      signal: controller.signal
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function fail(data) {
  console.error('调用失败：code=' + (data && data.code) + ' msg=' + (data && data.msg) +
    (data && data.request_id ? '\nrequest_id=' + data.request_id + '（排障时带上它）' : ''));
  process.exit(1);
}

const yuan = (v) => (Number(v) / 1000).toFixed(2) + ' 元';

/** 计费操作必须显式确认——避免"顺手跑一下"把钱花掉 */
function requireYes(flag, what, costHint) {
  if (process.argv.includes(flag)) return;
  console.error('⚠️ ' + what + '（' + costHint + '）');
  console.error('   这属于计费/破坏性操作，需要显式加 ' + flag + ' 才会执行。');
  process.exit(3);
}

const fmt = (x) => JSON.stringify(x, null, 1);

(async () => {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1].trim());
    process.exit(0);
  }

  if (cmd === 'balance') {
    const d = await call('POST', '/api/v1/dev/wallet/balance', {});
    if (d.code !== 'Success') return fail(d);
    const x = d.data || {};
    console.log('可用余额   ' + yuan(x.assets) + (x.blocked_asset ? '（冻结 ' + yuan(x.blocked_asset) + '）' : ''));
    console.log('累计消费   ' + yuan(x.accumulate));
    console.log('代金券     ' + yuan(x.voucher_balance) + '，可用券 ' + (x.available_coupon_num || 0) + ' 张');
    return;
  }

  if (cmd === 'list') {
    const d = await call('POST', '/api/v1/dev/instance/pro/list', { page_index: 1, page_size: 20 });
    if (d.code !== 'Success') return fail(d);
    const data = d.data || {};
    const list = Array.isArray(data.list) ? data.list : (Array.isArray(data) ? data : []);
    if (!list.length) { console.log('没有实例。'); return; }
    for (const x of list) {
      console.log('- ' + (x.name || '(无名)') + '  uuid=' + (x.uuid || x.instance_uuid || '?') +
        '  状态=' + (x.status || '?') + '  机型=' + (x.gpu_spec_uuid || x.machine_alias || '?') +
        (x.region_name ? '  区域=' + x.region_name : ''));
    }
    return;
  }

  if (cmd === 'status' || cmd === 'snapshot') {
    if (!arg) { console.error('用法：autodl.js ' + cmd + ' <uuid>'); process.exit(2); }
    const ep = cmd === 'status' ? '/api/v1/dev/instance/pro/status' : '/api/v1/dev/instance/pro/snapshot';
    const d = await call('GET', ep, { instance_uuid: arg });
    if (d.code !== 'Success') return fail(d);
    console.log(fmt(d.data));
    return;
  }

  if (cmd === 'power-on') {
    requireYes('--yes', '开机实例 ' + arg, '按小时计费，闲置也会计费');
    const d = await call('POST', '/api/v1/dev/instance/pro/power_on', { instance_uuid: arg });
    if (d.code !== 'Success') return fail(d);
    console.log('已请求开机。稍后用 snapshot 拿 SSH 信息；用完记得 power-off。');
    return;
  }

  if (cmd === 'power-off') {
    requireYes('--yes', '关机实例 ' + arg, '会终止计费');
    const d = await call('POST', '/api/v1/dev/instance/pro/power_off', { instance_uuid: arg });
    if (d.code !== 'Success') return fail(d);
    console.log('已请求关机。');
    return;
  }

  if (cmd === 'release') {
    requireYes('--yes-i-mean-it', '释放实例 ' + arg, '不可恢复：系统盘数据会丢失');
    const d = await call('POST', '/api/v1/dev/instance/pro/release', { instance_uuid: arg });
    if (d.code !== 'Success') return fail(d);
    console.log('已释放实例。');
    return;
  }

  console.error('未知命令：' + cmd + '（用 help 看用法）');
  process.exit(2);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
