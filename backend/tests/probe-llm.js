const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const base = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const key = process.env.LLM_API_KEY || '';
console.log('base=', base, 'model=', process.env.LLM_MODEL, 'keyLen=', key.length);
(async () => {
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: process.env.LLM_MODEL || 'deepseek-chat', messages: [{ role: 'user', content: '只回复两个字：连通' }], max_tokens: 16 })
  });
  const text = await res.text();
  console.log('HTTP', res.status);
  try { const j = JSON.parse(text); console.log('reply=', (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim(), 'usage=', JSON.stringify(j.usage || {}), 'err=', j.error ? j.error.message : '-'); }
  catch (e) { console.log('raw=', text.slice(0, 300)); }
})().catch(e => console.log('ERR', e.message));
