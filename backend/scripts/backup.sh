#!/usr/bin/env bash
# ============================================================
# backup.sh — 逻辑备份 class_manage_sys 到 /home/ayin/db_backups
# 用法: bash scripts/backup.sh   （可由 systemd timer 定时调用）
# 环境变量: BACKUP_DIR / BACKUP_KEEP
# ============================================================
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${BACKUP_DIR:-/home/ayin/db_backups}"
KEEP="${BACKUP_KEEP:-14}"

cd "$BACKEND_DIR"
node tests/backup-db.js "${DB_NAME:-class_manage_sys}" "$OUT_DIR"

# 仅保留最近 KEEP 份
ls -1t "$OUT_DIR"/class_manage_sys_*.json 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "[backup] 完成，保留最近 ${KEEP} 份于 ${OUT_DIR}"
