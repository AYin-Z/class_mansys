#!/usr/bin/env bash
# ============================================================
# ci-version.sh — 生成 versionCode + versionName
# 在 CI 中运行，输出 Gradle project properties。
#
# versionCode = YYYYMMDD + 当日构建序号（从 1 开始）
# versionName = 从 package.json 读取
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取前端 versionName（从 package.json）
VERSION_NAME=$(node -p "require('${PROJECT_DIR}/frontend-v3/package.json').version" 2>/dev/null || echo "0.0.0")

# 生成 versionCode: YYYYMMDD
BASE_CODE=$(date +%Y%m%d)

# 当日序号：从库的 /tmp 计数器读取 + 自增
COUNTER_FILE="/tmp/class-mansys-version-counter"
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE")
  COUNT=$((COUNT + 1))
else
  COUNT=1
fi
echo "$COUNT" > "$COUNTER_FILE"

# 序号填零至 4 位
VERSION_CODE="${BASE_CODE}$(printf '%04d' $COUNT)"

# 输出为 Gradle -P 属性格式
echo "versionCode=$VERSION_CODE"
echo "versionName=$VERSION_NAME"
echo "apkFileName=class-mansys-v${VERSION_NAME}-${VERSION_CODE}.apk"
echo "aabFileName=class-mansys-v${VERSION_NAME}-${VERSION_CODE}.aab"

# 也写入到文件供后续步骤 read
echo "$VERSION_CODE" > "$PROJECT_DIR/scripts/.versionCode"
echo "$VERSION_NAME" > "$PROJECT_DIR/scripts/.versionName"
