/**
 * 请假类型配置种子脚本
 * 用法: node seed-leave-config.js
 * 幂等：已存在的数据不会重复插入
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/database');

const DEFAULT_CONFIGS = [
  { type_name: '早操',   start_time: '06:00:00', end_time: '07:00:00', is_fixed: true,  reasons: JSON.stringify(['调休','出督','病假','事假','公假','其他']), sort_order: 1 },
  { type_name: '早集合', start_time: '07:00:00', end_time: '08:10:00', is_fixed: true,  reasons: JSON.stringify(['调休','出督','病假','事假','公假','其他']), sort_order: 2 },
  { type_name: '午集合', start_time: '13:00:00', end_time: '14:00:00', is_fixed: true,  reasons: JSON.stringify(['调休','出督','病假','事假','公假','其他']), sort_order: 3 },
  { type_name: '收假集合',start_time: '18:00:00', end_time: '19:00:00', is_fixed: true,  reasons: JSON.stringify(['调休','出督','病假','事假','公假','其他']), sort_order: 4 },
  { type_name: '晚自习', start_time: '18:30:00', end_time: '20:30:00', is_fixed: true,  reasons: JSON.stringify(['调休','出督','病假','事假','公假','其他']), sort_order: 5 },
  { type_name: '中队会', start_time: null,        end_time: null,        is_fixed: false, reasons: JSON.stringify(['病假','事假','公假','其他']), sort_order: 6 },
  { type_name: '全休',   start_time: null,        end_time: null,        is_fixed: false, reasons: JSON.stringify(['病假','事假','公假','其他']), sort_order: 7 },
  { type_name: '其他',   start_time: null,        end_time: null,        is_fixed: false, reasons: JSON.stringify(['病假','事假','公假','其他']), sort_order: 8 },
];

async function seed() {
  try {
    // 确保表存在
    await db.query(`
      CREATE TABLE IF NOT EXISTS leave_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        type_name VARCHAR(20) NOT NULL,
        start_time TIME DEFAULT NULL,
        end_time TIME DEFAULT NULL,
        is_fixed BOOLEAN NOT NULL DEFAULT TRUE,
        reasons JSON NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 检查是否已有数据
    const [existing] = await db.query('SELECT COUNT(*) as cnt FROM leave_config');
    if (existing[0].cnt > 0) {
      console.log(`leave_config 表已有 ${existing[0].cnt} 条记录，跳过种子数据插入`);
    } else {
      for (const cfg of DEFAULT_CONFIGS) {
        await db.query(
          `INSERT INTO leave_config (type_name, start_time, end_time, is_fixed, reasons, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cfg.type_name, cfg.start_time, cfg.end_time, cfg.is_fixed, cfg.reasons, cfg.sort_order]
        );
      }
      console.log(`已插入 ${DEFAULT_CONFIGS.length} 条默认请假类型配置`);
    }

    console.log('leave_config 种子数据完成');
    process.exit(0);
  } catch (err) {
    console.error('种子数据失败:', err.message);
    process.exit(1);
  }
}

seed();
