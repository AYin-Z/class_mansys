#!/usr/bin/env bash
# ============================================================
# ci-version.sh — 生成 versionCode + versionName
# 在 CI 中运行，输出 Gradle project properties。
#
# versionCode = YYMMDD * 100 + 当日构建序号（从 1 开始）
#   ⚠️ 不能用 YYYYMMDD + 4 位序号：那是 12 位数字（如 202609110003），
#   超过 Android versionCode 的 32 位上限 2147483647，
#   Gradle 调 toInteger() 时会抛 "For input string: ..." 直接构建失败。
#   本方案产出 8 位数字（如 26091101），且保证严格递增（见文件末尾的兜底）。
# versionName = 从 package.json 读取
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取前端 versionName（从 package.json）
VERSION_NAME=$(node -p "require('${PROJECT_DIR}/frontend-v3/package.json').version" 2>/dev/null || echo "0.0.0")

# 生成 versionCode 基线: YYMMDD
BASE_CODE=$(date +%y%m%d)

# 当日序号：从库的 /tmp 计数器读取 + 自增
COUNTER_FILE="/tmp/class-mansys-version-counter"
if [ -f "$COUNTER_FILE" ]; then
  COUNT=$(cat "$COUNTER_FILE")
  COUNT=$((COUNT + 1))
else
  COUNT=1
fi
echo "$COUNT" > "$COUNTER_FILE"

# 序号填零至 2 位（同日最多 99 次构建）→ 得到 8 位 versionCode，远小于 32 位上限
VERSION_CODE=$(( 10#$BASE_CODE * 100 + COUNT ))

# 兜底：确保相对上一次构建严格递增（/tmp 计数器可能被清理，或日期回退）
PREV_CODE=0
PREV_FILE="$PROJECT_DIR/scripts/.versionCode"
if [ -f "$PREV_FILE" ]; then
  PREV_CODE=$(tr -dc '0-9' < "$PREV_FILE" || true)
  PREV_CODE=${PREV_CODE:-0}
  # 旧方案（YYYYMMDD+4 位）留下的 12 位值本身就越界，不能当作递增基线，
  # 否则会把错误值传染给下一次构建。
  if [ "$PREV_CODE" -ge 2147483647 ]; then
    PREV_CODE=0
  fi
fi
if [ "$PREV_CODE" -ge "$VERSION_CODE" ]; then
  VERSION_CODE=$((PREV_CODE + 1))
fi

# 输出为 Gradle -P 属性格式
echo "versionCode=$VERSION_CODE"
echo "versionName=$VERSION_NAME"
echo "apkFileName=class-mansys-v${VERSION_NAME}-${VERSION_CODE}.apk"
echo "aabFileName=class-mansys-v${VERSION_NAME}-${VERSION_CODE}.aab"

# 也写入到文件供后续步骤 read
echo "$VERSION_CODE" > "$PROJECT_DIR/scripts/.versionCode"
echo "$VERSION_NAME" > "$PROJECT_DIR/scripts/.versionName"
