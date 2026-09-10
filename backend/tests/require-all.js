const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');
const groups = ['controllers', 'models', 'routes', 'shared'];
const files = [];
for (const g of groups) {
  for (const f of fs.readdirSync(path.join(base, g)).filter(x => x.endsWith('.js'))) files.push(g + '/' + f);
}
files.push('app.js');
let fail = 0;
for (const f of files) {
  try { require(path.join(base, f)); } catch (e) { console.log('FAIL', f, e.message); fail = 1; }
}
console.log(fail ? 'SOME FAIL' : 'BACKEND ALL OK (' + files.length + ' modules)');
process.exit(fail);
