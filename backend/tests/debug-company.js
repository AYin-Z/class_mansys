const BASE = 'http://127.0.0.1:3102';
(async () => {
  const lr = await fetch(BASE + '/api/auth/login-with-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: '202521760025', password: '123456' }) });
  const lj = await lr.json();
  const t = lj.token;
  const date = new Date().toISOString().slice(0, 10);
  const r1 = await (await fetch(BASE + '/api/company/leave-records?date=' + date, { headers: { Authorization: 'Bearer ' + t } })).json();
  console.log('DATE', date);
  console.log('LEAVE-RECORDS', JSON.stringify(r1).slice(0, 1500));
  const r2 = await (await fetch(BASE + '/api/company/overview?date=' + date, { headers: { Authorization: 'Bearer ' + t } })).json();
  console.log('OVERVIEW', JSON.stringify(r2).slice(0, 1200));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
