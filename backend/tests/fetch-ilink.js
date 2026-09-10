const https = require('https');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'dsh-recon', Accept: 'application/vnd.github+json' } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
(async () => {
  const targets = [
    ['weixin.py', 'https://api.github.com/repos/NousResearch/hermes-agent/contents/gateway/platforms/weixin.py?ref=245e48008fa814b3251f50755eb656bd9fb86cb1'],
    ['weixin.md', 'https://api.github.com/repos/NousResearch/hermes-agent/contents/website/docs/user-guide/messaging/weixin.md?ref=245e48008fa814b3251f50755eb656bd9fb86cb1'],
  ];
  for (const [name, url] of targets) {
    const r = await get(url);
    process.stdout.write('=== ' + name + ' status=' + r.status + ' ===\n');
    try {
      const j = JSON.parse(r.body);
      if (!j.content) { process.stdout.write((j.message || 'no content') + '\n'); continue; }
      const text = Buffer.from(j.content, 'base64').toString('utf8');
      process.stdout.write(text.slice(0, 3500) + '\n...[len=' + text.length + ']\n\n');
    } catch (e) { process.stdout.write('parse err: ' + r.body.slice(0, 200) + '\n'); }
  }
})();
