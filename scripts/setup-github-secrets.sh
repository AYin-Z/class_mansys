#!/usr/bin/env bash
# ============================================================
# setup-github-secrets.sh — 一键设置 GitHub Secrets
# 用于 class_mansys CI/CD 需要的所有密钥。
#
# 前置条件：已安装 gh CLI 并登录 (gh auth login)
# ============================================================
set -euo pipefail

REPO="AYin-Z/class_mansys"
KEYSTORE_FILE="/home/ayin/android-key/class-mansys-release.keystore"

echo "=========================================="
echo " class_mansys — GitHub Secrets 设置向导"
echo "=========================================="
echo ""

if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "❌ keystore 不存在: $KEYSTORE_FILE"
  echo "请先运行: keytool -genkey ... 生成 release keystore"
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "❌ 未安装 gh CLI，请先安装:"
  echo "  sudo apt install gh && gh auth login"
  exit 1
fi

echo "✅ keystore 已就绪: $KEYSTORE_FILE"
echo ""

# ── 1. KEYSTORE_BASE64 ──
echo "[1/5] 上传 KEYSTORE_BASE64 ..."
BASE64=$(base64 -w0 "$KEYSTORE_FILE")
echo "$BASE64" | gh secret set KEYSTORE_BASE64 --repo "$REPO"
echo "  ✓ KEYSTORE_BASE64 已设置"

# ── 2. KEYSTORE_PASSWORD ──
echo "[2/5] 设置 KEYSTORE_PASSWORD ..."
read -s -p "  输入 keystore 密码: " KS_PASS
echo ""
gh secret set KEYSTORE_PASSWORD --body "$KS_PASS" --repo "$REPO"
echo "  ✓ KEYSTORE_PASSWORD 已设置"

# ── 3. KEY_ALIAS ──
echo "[3/5] 设置 KEY_ALIAS ..."
read -p "  输入 key 别名 (默认: class-mansys): " KEY_ALIAS_INPUT
KEY_ALIAS="${KEY_ALIAS_INPUT:-class-mansys}"
gh secret set KEY_ALIAS --body "$KEY_ALIAS" --repo "$REPO"
echo "  ✓ KEY_ALIAS = $KEY_ALIAS"

# ── 4. KEY_PASSWORD ──
echo "[4/5] 设置 KEY_PASSWORD ..."
read -s -p "  输入 key 密码 (与 keystore 密码相同则直接回车): " KEY_PASS_INPUT
echo ""
KEY_PASS="${KEY_PASS_INPUT:-$KS_PASS}"
gh secret set KEY_PASSWORD --body "$KEY_PASS" --repo "$REPO"
echo "  ✓ KEY_PASSWORD 已设置"

# ── 5. VITE_API_BASE_URL ──
echo "[5/5] 设置 VITE_API_BASE_URL ..."
read -p "  输入 API 地址 (默认: https://cls.ayinserver.xin): " API_URL
API_URL="${API_URL:-https://cls.ayinserver.xin}"
gh secret set VITE_API_BASE_URL --body "$API_URL" --repo "$REPO"
echo "  ✓ VITE_API_BASE_URL = $API_URL"

echo ""
echo "=========================================="
echo " ✅ 所有 GitHub Secrets 设置完成!"
echo "=========================================="
echo ""
echo "当前 Secrets 列表:"
gh secret list --repo "$REPO"
