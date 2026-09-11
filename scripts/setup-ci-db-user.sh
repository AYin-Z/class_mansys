#!/usr/bin/env bash
# ============================================================
# setup-ci-db-user.sh — 为 CI 创建最小权限的测试库账号，并写入 GitHub Secrets
#
# 背景：CI（self-hosted runner，跑在本机）需要真实数据库才能覆盖
#       令牌校验、权限矩阵、MCP 等需要查库的用例；
#       但本仓库是**公开仓库**，口令不能写进 workflow 文件。
#
# 做法：
#   1) 在宿主机 MySQL 上创建/更新 ci_runner 账号，只授予
#      class_manage_sys_test 库权限（无法读生产库 class_manage_sys）
#   2) 生成随机口令，写入 GitHub Secrets：CI_DB_USER / CI_DB_PASSWORD
#
# 用法：
#   bash scripts/setup-ci-db-user.sh            # 创建账号 + 写入 secrets
#   bash scripts/setup-ci-db-user.sh --no-gh    # 只创建账号并打印口令
#
# 依赖：docker（MySQL 跑在容器里）或本机 mysql 客户端；gh（可选，写入 secrets 用）
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/backend/.env"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-class_mansys_db}"
TEST_DB="${TEST_DB:-class_manage_sys_test}"
CI_DB_USER="${CI_DB_USER:-ci_runner}"
WRITE_SECRETS=1
[ "${1:-}" = "--no-gh" ] && WRITE_SECRETS=0

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 $ENV_FILE（需要里面的 root 口令来创建账号）" >&2
  exit 1
fi

ROOT_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
ROOT_PASS=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
ROOT_USER=${ROOT_USER:-root}

# 只在 _test 库上授权：库名必须满足测试库约定，防止手滑授权到生产库
case "$TEST_DB" in
  *_test|*_test[0-9]|*_test[0-9][0-9]) ;;
  *) echo "❌ 拒绝操作：$TEST_DB 不是测试库（须以 _test 结尾）" >&2; exit 1 ;;
esac

CI_DB_PASSWORD=$(openssl rand -hex 16)

SQL="CREATE USER IF NOT EXISTS '${CI_DB_USER}'@'%' IDENTIFIED BY '${CI_DB_PASSWORD}';
ALTER USER '${CI_DB_USER}'@'%' IDENTIFIED BY '${CI_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO '${CI_DB_USER}'@'%';
FLUSH PRIVILEGES;"

echo "▶ 在 MySQL 上创建/更新账号 ${CI_DB_USER}（仅 ${TEST_DB} 权限）"
if docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
  docker exec -i -e MYSQL_PWD="$ROOT_PASS" "$MYSQL_CONTAINER" \
    mysql -u"$ROOT_USER" -e "$SQL"
else
  echo "  （未发现容器 $MYSQL_CONTAINER，改用本机 mysql 客户端）"
  MYSQL_PWD="$ROOT_PASS" mysql -h127.0.0.1 -u"$ROOT_USER" -e "$SQL"
fi
echo "✅ 账号就绪"

if [ "$WRITE_SECRETS" = "1" ]; then
  GH="gh"
  command -v gh >/dev/null 2>&1 || { echo "⚠️  未安装 gh，跳过 secrets 写入"; GH=""; }
  if [ -n "$GH" ]; then
    export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:7890}"
    export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:7890}"
    echo "▶ 写入 GitHub Secrets：CI_DB_USER / CI_DB_PASSWORD"
    printf '%s' "$CI_DB_USER" | gh secret set CI_DB_USER
    printf '%s' "$CI_DB_PASSWORD" | gh secret set CI_DB_PASSWORD
    gh secret list
    echo "✅ Secrets 已更新（口令不会打印到终端）"
    exit 0
  fi
fi

echo "CI_DB_USER=$CI_DB_USER"
echo "CI_DB_PASSWORD=$CI_DB_PASSWORD"
echo "（手动写入：printf '%s' '<值>' | gh secret set CI_DB_PASSWORD）"
