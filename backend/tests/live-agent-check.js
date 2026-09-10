const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3111';

async function login(sid) {
  const r = await fetch(BASE + '/api/auth/login-with-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: sid, password: '123456' })
  });
  const j = await r.json();
  return j.token;
}

async function chat(token, message, label) {
  const t0 = Date.now();
  const res = await fetch(BASE + '/api/agent/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ message })
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let tools = [];
  let pending = null;
  let done = null;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() || '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (ev.type === 'delta') text += ev.content;
      else if (ev.type === 'tool') tools.push(ev.name);
      else if (ev.type === 'pending') pending = ev.action;
      else if (ev.type === 'done') done = ev;
      else if (ev.type === 'error') text += '[ERROR] ' + ev.message;
    }
  }
  console.log('\n=== ' + label + ' (' + Math.round((Date.now() - t0) / 1000) + 's) ===');
  console.log('tools:', tools.length ? tools.join(',') : '(none)');
  console.log('pending:', pending ? (pending.label + ' | ' + pending.preview) : '(none)');
  console.log('reply:', (done && done.reply || text).slice(0, 400).replace(/\n+/g, ' / '));
  return { token, pending, conversationId: done && done.conversationId };
}

(async () => {
  const student = await login('202521760001');
  const leader = await login('202521760025');
  console.log('login ok:', !!student, !!leader);

  await chat(student, '怎么请假？', '学员：使用引导');
  const s2 = await chat(student, '给个建议：希望晚自习后能延长热水供应时间', '学员：写操作（应返回待确认）');
  if (s2.pending) {
    const r = await fetch(BASE + '/api/agent/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s2.token },
      body: JSON.stringify({ actionId: s2.pending.id })
    });
    const j = await r.json();
    console.log('\n=== 确认执行 ===');
    console.log('success:', j.success, '| reply:', String(j.reply || '').slice(0, 200));
  }
  await chat(leader, '今天有什么要处理的？帮我看看待审批和中队出勤', '干部：管理助手');
})().catch((e) => { console.error('LIVE_TEST_ERROR:', e.message); process.exit(1); });
