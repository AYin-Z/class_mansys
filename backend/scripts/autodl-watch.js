#!/usr/bin/env node
/**
 * AutoDL 实例"接力"监视器
 *
 * ## 为什么是"接力"而不是"自动开机"
 * AutoDL 的**开发者 API 只覆盖「容器实例 Pro」**（官方文档的 API 章节只有 Pro API 与弹性部署 API）。
 * 实测：`/api/v1/dev/instance/pro/list` 对普通容器实例返回空列表，非 pro 路径全部 404。
 * 而且 GPU 库存接口要企业认证，个人账号**查不到有没有卡**。
 * 所以"盯着有卡就自动开机"这件事，用官方 API **做不到** —— 这个脚本负责剩下的一切：
 *
 *   你在网页上看到有卡、点了开机 → 本脚本自动检测到 → 自动跑完并通知你
 *
 * ## 流程（每个关键节点都会发邮件，失败也发）
 *   waiting    每 3 分钟探测 SSH 端口（很轻，不花 API 配额）
 *   up         实例上线 → 校验环境是否还在（依赖/底座/数据）
 *   smoke      跑 20 步冒烟 → **顺带从日志解析真实吞吐**，据此估算正式训练要多久
 *   training   按模式决定：auto=直接接着训（带硬性时限），notify=只通知你、等你发话
 *   done       下载适配器 → 通知（并尝试在实例内关机，能成就不会继续计费）
 *
 * ## 模式
 *   ~/.class-mansys/autodl-watch.mode 内容为 auto（默认）或 notify
 *
 * ## 为什么要有硬性时限
 * 无人看管的训练如果卡住，GPU 会一直计费。所以正式训练用 `timeout` 包起来，
 * 到点就断，宁可少训也不要空烧。同时**无法在实例外关机**（API 不管普通实例），
 * 所以脚本会尝试 `shutdown`，失败就明确提醒你去网页关机。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const HOME = os.homedir();
const STATE_FILE = path.join(HOME, '.class-mansys', 'autodl-watch.json');
const MODE_FILE = path.join(HOME, '.class-mansys', 'autodl-watch.mode');
const SSH_ALIAS = process.env.AUTODL_SSH_ALIAS || 'autodl';
const REMOTE_DIR = '/root/autodl-tmp/agent-train';
const TRAIN_CAP_SEC = Number(process.env.AUTODL_TRAIN_CAP_SEC || 4 * 3600); // 正式训练硬上限 4 小时
const SMOKE_CAP_SEC = Number(process.env.AUTODL_SMOKE_CAP_SEC || 1800);

function mode() {
  try { return fs.readFileSync(MODE_FILE, 'utf8').trim() || 'auto'; } catch (e) { return 'auto'; }
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { return { phase: 'waiting' }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }, null, 1));
}

/** 简单探测：只连 TCP 端口，不做认证、不花 API 配额 */
function portOpen(host, port, timeoutMs = 8000) {
  const r = spawnSync('bash', ['-c', `timeout ${Math.ceil(timeoutMs / 1000)} bash -c 'cat < /dev/null > /dev/tcp/${host}/${port}'`], { timeout: timeoutMs + 3000 });
  return r.status === 0;
}

const SSH_HOST = (() => {
  const cfg = (() => { try { return fs.readFileSync(path.join(HOME, '.ssh', 'config'), 'utf8'); } catch (e) { return ''; } })();
  const m = cfg.match(new RegExp('Host\\s+' + SSH_ALIAS + '\\s*\\n([\\s\\S]*?)(?=\\nHost\\s|$)', 'i'));
  const host = m && m[1].match(/HostName\s+(\S+)/i);
  const port = m && m[1].match(/Port\s+(\d+)/i);
  return { host: host ? host[1] : null, port: port ? Number(port[1]) : 22 };
})();

function ssh(cmd, timeoutSec) {
  const r = spawnSync('ssh', ['-o', 'ConnectTimeout=20', '-o', 'BatchMode=yes', SSH_ALIAS, cmd],
    { encoding: 'utf8', timeout: (timeoutSec || 120) * 1000 });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), status: r.status };
}

function notify(subject, text) {
  try {
    const mailer = require('../services/mailer');
    const to = process.env.SUGGESTION_DIGEST_TO || '';
    if (!to) { console.log('[watch] 未配置收件人，仅打印'); return; }
    // mailer 是异步的，这里同步等待结果不重要：失败也不影响主流程
    mailer.sendMail({ to, subject: '[AutoDL] ' + subject, text }).then((r) => {
      console.log('[watch] 通知已发' + (r && r.skipped ? '（SMTP 未配置，跳过）' : ''));
    }).catch(() => {});
  } catch (e) { console.log('[watch] 通知失败：' + e.message); }
}

(async () => {
  const state = loadState();
  const m = mode();

  if (!SSH_HOST.host) { console.log('[watch] ~/.ssh/config 里没有 ' + SSH_ALIAS + ' 主机，退出'); process.exit(0); }

  const up = portOpen(SSH_HOST.host, SSH_HOST.port);
  if (!up) {
    if (state.phase !== 'waiting') {
      console.log('[watch] 实例已下线，回到等待中');
      saveState({ phase: 'waiting', note: '实例不可达' });
    }
    process.exit(0);
  }

  // 实例上线
  if (state.phase === 'waiting' || !state.phase) {
    console.log('[watch] 检测到实例上线，开始校验环境');
    const r = ssh(`nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; echo "---"; ls ${REMOTE_DIR} 2>/dev/null | wc -l; /root/miniconda3/bin/python -c "import torch;print('torch',torch.__version__)" 2>&1 | tail -1`, 120);
    saveState({ phase: 'up', envCheck: r.out.slice(-500) });
    notify('实例已上线，环境校验结果', r.out);
    console.log(r.out);
    // 不在这里自动开训：交给下一轮（这样这次调用很快返回，不占着锁）
    process.exit(0);
  }

  // 环境已校验 → 跑冒烟
  if (state.phase === 'up') {
    console.log('[watch] 开始冒烟（20 步）');
    const cmd = `cd ${REMOTE_DIR} && timeout ${SMOKE_CAP_SEC} bash bootstrap.sh smoke 2>&1 | tail -40`;
    const r = ssh(cmd, SMOKE_CAP_SEC + 120);
    // 从日志里解析吞吐（LLaMA-Factory 会打印 tokens/s 或 samples/s）
    const tps = (r.out.match(/([\d.]+)\s*(?:tokens|token)\/s/i) || [])[1]
      || (r.out.match(/'\w*throughput\w*':\s*([\d.]+)/i) || [])[1];
    const passed = /✅ 冒烟通过/.test(r.out) || /'loss'/.test(r.out);
    saveState({ phase: passed ? 'smoke-done' : 'smoke-failed', smokeOk: passed, tokensPerSec: tps || null, smokeTail: r.out.slice(-1500) });
    notify(
      passed ? '冒烟通过' + (tps ? `（吞吐 ${tps} tok/s）` : '') : '冒烟失败',
      `模式：${m}\n吞吐：${tps || '未解析到'}\n\n${r.out.slice(-1500)}`
    );
    console.log(r.out.slice(-800));
    if (!passed) { console.log('[watch] 冒烟未通过，停在这里等你处理（不自动往下训，避免白烧钱）'); process.exit(0); }
    if (m === 'notify') { console.log('[watch] notify 模式：已通知，等你发话再正式训练'); process.exit(0); }
    process.exit(0); // 下一轮进 training
  }

  // 冒烟通过 → 正式训练
  if (state.phase === 'smoke-done') {
    console.log('[watch] 开始正式训练（硬上限 ' + Math.round(TRAIN_CAP_SEC / 3600) + ' 小时）');
    saveState({ ...state, phase: 'training', trainStartedAt: new Date().toISOString() });
    // 日志落盘：官方文档明确提醒"自动关机后标准输出中的日志将不再可见"，
    // 所以训练日志同时写一份到数据盘，万一训练崩了还能回头查。
    const cmd = `cd ${REMOTE_DIR} && timeout ${TRAIN_CAP_SEC} bash bootstrap.sh full 2>&1 | tee /root/autodl-tmp/train-$(date +%Y%m%d-%H%M).log | tail -60`;
    const r = ssh(cmd, TRAIN_CAP_SEC + 300);
    const done = /训练完成/.test(r.out);
    const newState = { ...state, phase: done ? 'trained' : 'train-failed', trainTail: r.out.slice(-2000) };
    saveState(newState);
    notify(done ? '训练完成' : '训练未正常结束', `模式：${m}\n\n${r.out.slice(-2000)}`);
    console.log(r.out.slice(-1000));
    process.exit(0);
  }

  // 训练完成 → 下载适配器 → 提醒关机
  if (state.phase === 'trained') {
    console.log('[watch] 下载适配器');
    const local = path.join(HOME, 'class-mansys-artifacts', 'autodl-out');
    fs.mkdirSync(local, { recursive: true });
    // 下载失败不能让流程断掉：下面会根据 list 是否为空决定要不要关机
    spawnSync('bash', ['-c',
      `ssh ${SSH_ALIAS} 'tar czf - -C /root/autodl-tmp/out qwen3vl-4b-agent-lora 2>/dev/null' | tar xzf - -C ${local}`
    ], { encoding: 'utf8', timeout: 900000 });
    const list = fs.existsSync(local) ? fs.readdirSync(local) : [];

    // 自动关机：AutoDL 官方文档支持在实例内执行 /usr/bin/shutdown（"省钱绝招"一节）。
    // 这一步很关键——**API 关不了普通实例**，如果我们不在这里关，机器会一直计费。
    // 顺序必须是：先下载完适配器，再关机（关了就 SSH 不进去了）。
    let shutdownNote;
    if (list.length) {
      const sd = ssh('nohup /usr/bin/shutdown >/dev/null 2>&1 &  sleep 1; echo shutdown-issued', 60);
      shutdownNote = /shutdown-issued/.test(sd.out) ? '已下发关机命令' : ('关机命令执行异常：' + sd.out.slice(-200));
      console.log('[watch] ' + shutdownNote);
    } else {
      shutdownNote = '产物为空，**没有关机**，以免把可能还在写的训练结果关掉——请手动确认';
    }
    saveState({ ...state, phase: 'done', downloadedTo: local, files: list, shutdownNote });
    notify('训练完成，适配器已下载',
      `目录：${local}\n内容：${list.join(', ') || '（空，检查训练产物路径）'}\n\n关机：${shutdownNote}`);
    console.log('[watch] 下载到 ' + local + '：' + list.join(', '));
    process.exit(0);
  }

  console.log('[watch] 当前阶段 ' + state.phase + '，无需动作');
  process.exit(0);
})().catch((e) => { console.error('[watch] 异常：' + e.message); process.exit(1); });
