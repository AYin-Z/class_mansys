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
const TRAIN_CAP_SEC = Number(process.env.AUTODL_TRAIN_CAP_SEC || 4 * 3600); // 正式训练硬上限（unit 里设为 12 小时）
const SMOKE_CAP_SEC = Number(process.env.AUTODL_SMOKE_CAP_SEC || 1800);
// ⚠️ 2026-09-13 实测：正式训练在第 1 步 OOM，报错是 CUDA 分配器碎片化
//    （"Tried to allocate 5.66 GiB ... 5.88 GiB is reserved by PyTorch but unallocated"）。
//    这行是报错信息自己推荐的解法。故意放在**命令行前缀**而不是只写进 bootstrap.sh：
//    远端那份 bootstrap.sh 是副本、可能过期，命令行前缀保证一定生效。
const CUDA_ALLOC_ENV = 'PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True';

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

/**
 * 实例是否**真的**可用：必须能 SSH 进去。
 *
 * ⚠️ 2026-09-14 踩坑：裸 TCP 探测会被 AutoDL 的转发层骗到——实例已经关机，
 * 转发层有时仍然接受 TCP 连接（随后 SSH 握手被拒）。只信 TCP 的话，
 * 关机的实例会被判成"上线"，于是「同步失败 → 告警」每 12 分钟循环一次，
 * 一晚上发了 76 封邮件。所以"上线"必须以 SSH 能执行为准。
 */
function sshReady() {
  const r = spawnSync('bash', ['-c',
    `timeout 15 ssh -o BatchMode=yes -o ConnectTimeout=8 ${SSH_ALIAS} 'echo watch-ready' 2>/dev/null`
  ], { encoding: 'utf8', timeout: 20000 });
  return /watch-ready/.test(r.stdout || '');
}

/** 实例上还有没有训练进程在跑（用于区分「训练真的结束了」和「只是 SSH 断了」） */
function trainingAlive() {
  // 用 [l]lamafactory 的写法避免 pgrep 匹配到自己这条 ssh 命令行（踩过：pkill -f 把 ssh 会话自己杀了）
  const r = ssh('pgrep -fc "[l]lamafactory.cli train" 2>/dev/null || echo 0', 60);
  const n = Number((r.out.match(/(\d+)\s*$/) || [])[1] || 0);
  return n > 0;
}

/** 产物目录里的文件数（checkpoint / adapter） */
function artifactCount() {
  const r = ssh('ls /root/autodl-tmp/out/qwen3vl-4b-agent-lora 2>/dev/null | wc -l', 120);
  return Number((r.out.match(/(\d+)/) || [])[1] || 0);
}

/**
 * 把仓库里 autodl/ 下的脚本与测试数据同步到实例。
 *
 * 为什么必须做：实例上那份 bootstrap.sh 只是一份副本，改完仓库不同步，它就会过期。
 * 2026-09-13 就踩到这一点——本地给 bootstrap.sh 加了 memtest 模式，但实例关机中推不上去，
 * 如果接力器拿着旧脚本执行 `bootstrap.sh memtest`，会一路落到正式训练分支，
 * 被 30 分钟的 memtest 上限打断，白烧半小时卡时还污染产物目录。
 * 同步失败就不往下走（宁可不动，也不要拿着过期脚本乱跑）。
 */
function syncAutodlFiles() {
  const src = path.resolve(__dirname, '..', '..', 'autodl');
  const files = ['bootstrap.sh', 'dataset_info.json', 'agent-longest.jsonl', 'train_qlora.yaml'];
  const missing = files.filter((f) => !fs.existsSync(path.join(src, f)));
  if (missing.length) return { ok: false, reason: '本地缺少文件：' + missing.join(', ') };
  const r = spawnSync('bash', ['-c',
    `tar czf - -C ${src} ${files.join(' ')} | ssh ${SSH_ALIAS} 'tar xzf - -C ${REMOTE_DIR} && chmod +x ${REMOTE_DIR}/bootstrap.sh && grep -c memtest ${REMOTE_DIR}/bootstrap.sh'`
  ], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '').trim();
  const n = Number((out.match(/(\d+)\s*$/) || [])[1] || 0);
  if (r.status !== 0 || n < 1) {
    return { ok: false, reason: `推送失败(rc=${r.status})：${(r.stderr || out).slice(-300)}` };
  }
  return { ok: true, detail: `已同步 ${files.join(', ')}（远端含 memtest 分支）` };
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
    // 去重：同一主题 6 小时内只发一次。
    // 2026-09-14 教训：端口误判导致的同步失败循环，把同一条告警发了 76 次，直接刷爆邮箱。
    // 告警宁可我这边静默，也不能变成骚扰——重复状态在 journal 里照样能看到。
    const st = loadState();
    const last = st.lastNotify || {};
    if (last.key === subject && Date.now() - (last.at || 0) < 6 * 3600 * 1000) {
      console.log('[watch] 同类通知 6 小时内已发过，跳过：' + subject);
      return;
    }
    saveState({ ...st, lastNotify: { key: subject, at: Date.now() } });
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

  // 实例可用 = TCP 通 **且** SSH 真能进去（只看 TCP 会被转发的假连接骗到，见 sshReady 注释）
  const up = portOpen(SSH_HOST.host, SSH_HOST.port) && sshReady();
  if (!up) {
    // 训练进行中时**不能**因为一次端口抖动就把状态清成 waiting：
    // 训练很可能还在实例上跑，清掉会导致下次上线又从 env check 重来，
    // 甚至和还在跑的那次撞车（同一张卡两个进程 = 双双 OOM + 产物被覆盖）。
    // done 是终态：流水线已经走完（产物下载 + 关机），不该再被重置成 waiting 重新触发。
    if (state.phase === 'training' || state.phase === 'done') {
      console.log(`[watch] 实例不可达，阶段是 ${state.phase} —— 保持不动`);
      process.exit(0);
    }
    if (state.phase !== 'waiting') {
      console.log('[watch] 实例已下线，回到等待中');
      saveState({ phase: 'waiting', note: '实例不可达' });
    }
    process.exit(0);
  }

  // 实例上线
  if (state.phase === 'waiting' || !state.phase) {
    console.log('[watch] 检测到实例上线，先同步仓库脚本，再校验环境');
    const sync = syncAutodlFiles();
    console.log('[watch] ' + (sync.ok ? sync.detail : '同步失败：' + sync.reason));
    if (!sync.ok) {
      // 脚本没同步成功就绝不往下走：宁可不跑，也不能拿着过期脚本烧 8 小时卡时
      saveState({ phase: 'sync-failed', note: sync.reason, updatedAt: new Date().toISOString() });
      notify('AutoDL 脚本同步失败，已暂停流水线', `原因：${sync.reason}\n\n处理：确认 ~/.ssh/config 的 autodl 可连、仓库 autodl/ 目录文件齐全后，把状态文件改回 waiting。`);
      process.exit(0);
    }
    const r = ssh(`nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; echo "---"; ls ${REMOTE_DIR} 2>/dev/null | wc -l; /root/miniconda3/bin/python -c "import torch;print('torch',torch.__version__)" 2>&1 | tail -1`, 120);
    saveState({ phase: 'up', envCheck: r.out.slice(-500), sync: sync.detail });
    notify('实例已上线，环境校验结果', sync.detail + '\n\n' + r.out);
    console.log(r.out);
    // 不在这里自动开训：交给下一轮（这样这次调用很快返回，不占着锁）
    process.exit(0);
  }

  // 环境已校验 → 先做最坏情况显存测试（单条最长样本，1 个优化步）
  // 为什么不是原来的 20 步冒烟：2026-09-13 实测 —— 冒烟 6 步正常，正式训练第 1 步就 OOM。
  // 原因是长度分布很窄（6803~8235），冒烟跑的不是峰值；而单条最长样本恰好就是峰值。
  // 这个测试只要几分钟，却能在烧 8 小时卡时之前拦住显存问题。
  if (state.phase === 'up') {
    console.log('[watch] 开始最坏情况显存测试（单条最长样本，1 个优化步）');
    const cmd = `cd ${REMOTE_DIR} && ${CUDA_ALLOC_ENV} timeout ${SMOKE_CAP_SEC} bash bootstrap.sh memtest 2>&1 | tail -40`;
    const r = ssh(cmd, SMOKE_CAP_SEC + 120);
    // 从日志里解析吞吐（LLaMA-Factory 会打印 tokens/s 或 samples/s）
    const tps = (r.out.match(/([\d.]+)\s*(?:tokens|token)\/s/i) || [])[1]
      || (r.out.match(/'\w*throughput\w*':\s*([\d.]+)/i) || [])[1];
    const passed = /✅ 显存测试通过/.test(r.out) || /'loss'/.test(r.out);
    saveState({ phase: passed ? 'memtest-done' : 'memtest-failed', smokeOk: passed, tokensPerSec: tps || null, smokeTail: r.out.slice(-1500) });
    notify(
      passed ? '显存测试通过（最长样本）' + (tps ? `（吞吐 ${tps} tok/s）` : '') : '显存测试失败（多半是 OOM）',
      `模式：${m}\n吞吐：${tps || '未解析到'}\n\n${r.out.slice(-1500)}`
    );
    console.log(r.out.slice(-800));
    if (!passed) { console.log('[watch] 显存测试未通过，停在这里等你处理（不自动往下训，避免白烧钱）'); process.exit(0); }
    if (m === 'notify') { console.log('[watch] notify 模式：已通知，等你发话再正式训练'); process.exit(0); }
    process.exit(0); // 下一轮进 training
  }

  // 显存测试过了 → 正式训练
  if (state.phase === 'memtest-done') {
    console.log('[watch] 开始正式训练（硬上限 ' + Math.round(TRAIN_CAP_SEC / 3600) + ' 小时）');
    saveState({ ...state, phase: 'training', trainStartedAt: new Date().toISOString() });
    // 日志落盘：官方文档明确提醒"自动关机后标准输出中的日志将不再可见"，
    // 所以训练日志同时写一份到数据盘，万一训练崩了还能回头查。
    const cmd = `cd ${REMOTE_DIR} && ${CUDA_ALLOC_ENV} timeout ${TRAIN_CAP_SEC} bash bootstrap.sh full 2>&1 | tee /root/autodl-tmp/train-$(date +%Y%m%d-%H%M).log | tail -60`;
    const r = ssh(cmd, TRAIN_CAP_SEC + 300);
    const done = /训练完成/.test(r.out);
    // ⚠️ ssh 断连 ≠ 训练结束。断连时 r.out 里没有"训练完成"，如果这时直接去看产物目录、
    //    又恰好有 checkpoint，就会**在训练还在跑的时候把它下载并关机**——8 小时的训练直接毁掉。
    //    所以先确认实例上还有没有训练进程：还在跑就把阶段留在 training，等下一轮再看。
    if (!done && trainingAlive()) {
      const note = '训练 SSH 会话中断，但实例上训练进程仍在运行 —— 保持 training 阶段继续等待';
      saveState({ ...state, phase: 'training', trainTail: r.out.slice(-2000), note });
      notify('训练期间 SSH 中断（训练仍在跑）', `${note}\n\n${r.out.slice(-1500)}`);
      console.log('[watch] ' + note);
      process.exit(0);
    }
    const count = artifactCount();
    const partial = !done && count > 0;
    const newState = {
      ...state,
      phase: done || partial ? 'trained' : 'train-failed',
      trainPartial: !done,
      artifactCount: count,
      trainTail: r.out.slice(-2000)
    };
    saveState(newState);
    notify(
      done ? '训练完成'
        : partial ? `训练未跑完（产物 ${count} 项，将下载中间 checkpoint 后关机）`
          : '训练失败且无产物（将关机止损）',
      `模式：${m}\n产物文件数：${count}\n\n${r.out.slice(-2000)}`
    );
    console.log(r.out.slice(-1000));
    process.exit(0);
  }

  // 阶段已是 training 但本轮没有在跑训练 SSH（上一轮断连 / 服务重启过）：
  // 以实例上的实际进程为准，还在跑就等，真结束了再按产物决定下一步。
  if (state.phase === 'training') {
    if (trainingAlive()) {
      console.log('[watch] 训练仍在进行中（阶段 training），继续等待');
      process.exit(0);
    }
    const count = artifactCount();
    saveState({ ...state, phase: count ? 'trained' : 'train-failed', trainPartial: true, artifactCount: count });
    notify(count ? `训练进程已结束，产物 ${count} 项（将下载后关机）` : '训练进程已结束且无产物（将关机止损）',
      `阶段：training → ${count ? 'trained' : 'train-failed'}\n产物文件数：${count}`);
    console.log(`[watch] 训练进程已结束，产物 ${count} 项`);
    process.exit(0);
  }

  // 训练失败且没有任何产物 → 直接关机止损
  // 不这么做的话，服务会停在 train-failed 阶段什么都不做，而实例一直按小时计费。
  if (state.phase === 'train-failed') {
    const sd = ssh('nohup /usr/bin/shutdown >/dev/null 2>&1 &  sleep 1; echo shutdown-issued', 60);
    const shutdownNote = /shutdown-issued/.test(sd.out)
      ? '已下发关机命令（止损）'
      : ('关机命令执行异常，请在 AutoDL 网页手动关机：' + sd.out.slice(-200));
    saveState({ ...state, phase: 'done', shutdownNote });
    notify('训练失败，已关机止损',
      `关机：${shutdownNote}\n\n排错：重新开机后执行\n  cd ${REMOTE_DIR}\n  bash bootstrap.sh full\n训练日志在 /root/autodl-tmp/train-*.log（标准输出关机后看不到，日志文件还在）`);
    console.log('[watch] ' + shutdownNote);
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
      // "Connection closed by remote host" 是**正常**的：实例正在关机，SSH 会话必然被掐断。
      // 2026-09-14 实测确认：日志里报了这句，实例随后确实下线了（别再把它当异常吓自己）。
      shutdownNote = /shutdown-issued/.test(sd.out) ? '已下发关机命令'
        : /closed by remote host|Connection to .* closed/i.test(sd.out) ? '已下发关机命令（连接被远端关闭＝实例正在关机，正常）'
          : ('关机命令执行异常：' + sd.out.slice(-200));
      console.log('[watch] ' + shutdownNote);
    } else {
      shutdownNote = '产物为空，**没有关机**，以免把可能还在写的训练结果关掉——请手动确认';
    }
    saveState({ ...state, phase: 'done', downloadedTo: local, files: list, shutdownNote });
    notify(state.trainPartial ? '训练未跑完，已下载中间产物并关机' : '训练完成，适配器已下载',
      `目录：${local}\n内容：${list.join(', ') || '（空，检查训练产物路径）'}\n\n关机：${shutdownNote}`);
    console.log('[watch] 下载到 ' + local + '：' + list.join(', '));
    process.exit(0);
  }

  console.log('[watch] 当前阶段 ' + state.phase + '，无需动作');
  process.exit(0);
})().catch((e) => { console.error('[watch] 异常：' + e.message); process.exit(1); });
