#!/usr/bin/env node
/**
 * 中队种子脚本：创建默认中队并把未归属的区队挂到该中队
 * 用法：node seed-company.js [companyId] [companyName]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/database');

const COMPANY_ID = process.argv[2] || '1';
const COMPANY_NAME = process.argv[3] || '数据警务技术中队';

async function seed() {
  // 1. 建默认中队
  const [existingCompany] = await db.query('SELECT id FROM companies WHERE id = ?', [COMPANY_ID]);
  if (existingCompany.length === 0) {
    await db.query(
      'INSERT INTO companies (id, name, code) VALUES (?, ?, ?)',
      [COMPANY_ID, COMPANY_NAME, 'ZDD']
    );
    console.log(`✓ 已创建中队：${COMPANY_NAME} (id=${COMPANY_ID})`);
  } else {
    console.log(`✓ 中队已存在：${COMPANY_NAME} (id=${COMPANY_ID})`);
  }

  // 2. 把尚未归属的区队挂到该中队（幂等）
  const [result] = await db.query(
    'UPDATE classes SET company_id = ? WHERE (company_id IS NULL OR company_id = \'\') AND id <> \'0\'',
    [COMPANY_ID]
  );
  console.log(`✓ 已将 ${result.affectedRows} 个未归属区队挂到 ${COMPANY_NAME}`);

  // 3. 展示
  const [classes] = await db.query(
    'SELECT c.id, c.name FROM classes c WHERE c.company_id = ? ORDER BY c.id ASC',
    [COMPANY_ID]
  );
  console.log('该中队下区队：', classes.map(r => `${r.id}(${r.name})`).join(', ') || '(无)');
  process.exit(0);
}

seed().catch(e => { console.error('❌ 种子失败:', e.message); process.exit(1); });
