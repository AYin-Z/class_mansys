const https = require('https');
const fs = require('fs');
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'dsh-recon', Accept: 'application/vnd.github+json' } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
(async () => {
  const r = await get('https://api.github.com/repos/NousResearch/hermes-agent/contents/gateway/platforms/weixin.py?ref=245e48008fa814b3251f50755eb656bd9fb86cb1');
  const j = JSON.parse(r.body);
  const text = Buffer.from(j.content, 'base64').toString('utf8');
  fs.writeFileSync('/tmp/weixin.py', text);
  process.stdout.write('saved len=' + text.length + '\n');
})();
