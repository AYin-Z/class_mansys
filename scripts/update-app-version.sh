#!/usr/bin/env bash
# ============================================================
# update-app-version.sh — 构建后更新 app-version.json
# 由 CI 在 APK/AAB 构建完成后调用。
#
# 用法：
#   update-app-version.sh <versionName> <versionCode> [apkSize] [changelog] [apkFileName]
#
# 约定（2026-09-11 修正）：
#   - 第 4 个参数是**原始文本**，JSON 转义由本脚本负责。
#     历史上调用方先做了一次 json.dumps（自带引号），脚本又用 "..." 包了一层，
#     结果写出 "changelog": ""xxx"" 这种非法 JSON，前端解析直接失败。
#   - 第 5 个参数可选：本次发布的 APK 文件名。不传则退化为「发布目录里最新的
#     class-mansys-v*.apk」，多版本并存时可能指错文件。
#   - minVersionCode 默认沿用现有 app-version.json 里的值（只升不降需显式传
#     MIN_VERSION_CODE），避免每次构建都把自己设成强制更新门槛。
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APK_DIR="${APK_OUT_DIR:-/home/ayin/class-mansys-artifacts/apk}"
VERSION_FILE="$PROJECT_DIR/backend/data/app-version.json"

VERSION_NAME="${1:-}"
VERSION_CODE="${2:-}"
APK_SIZE="${3:-0}"
CHANGELOG="${4:-}"
APK_FILENAME_ARG="${5:-}"

if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ]; then
  echo "Usage: $0 <versionName> <versionCode> [apkSize] [changelog] [apkFileName]" >&2
  exit 1
fi

case "$VERSION_CODE" in
  ''|*[!0-9]*) echo "❌ versionCode 必须是整数，收到：$VERSION_CODE" >&2; exit 1 ;;
esac
# Android versionCode 是 32 位有符号整数，超过 2147483647 会导致 Gradle 构建失败
if [ "$VERSION_CODE" -gt 2147483647 ]; then
  echo "❌ versionCode=$VERSION_CODE 超过 Android 上限 2147483647" >&2
  exit 1
fi

# JSON 转义（含外层引号）：优先 python3，退化到 sed
json_string() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
  else
    printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}' | sed -e 's/\\n$//')"
  fi
}

CHANGELOG_JSON=$(printf '%s' "$CHANGELOG" | json_string)
[ -n "$CHANGELOG_JSON" ] || CHANGELOG_JSON='""'
VERSION_NAME_JSON=$(printf '%s' "$VERSION_NAME" | json_string)

# 确定 APK 文件名与大小
APK_FILENAME="$APK_FILENAME_ARG"
if [ -z "$APK_FILENAME" ]; then
  APK_FILE=$(ls -t "$APK_DIR"/class-mansys-v*.apk 2>/dev/null | head -1 || true)
  APK_FILENAME=$(basename "${APK_FILE:-}" 2>/dev/null || echo "")
fi
if [ "$APK_SIZE" = "0" ] && [ -n "$APK_FILENAME" ] && [ -f "$APK_DIR/$APK_FILENAME" ]; then
  APK_SIZE=$(stat -c%s "$APK_DIR/$APK_FILENAME" 2>/dev/null || echo 0)
fi
DOWNLOAD_URL="https://cls.ayinserver.xin/apk/${APK_FILENAME}"
TODAY=$(date +%Y-%m-%d)

# minVersionCode：默认沿用旧值（字符串匹配，避免引入 jq 依赖）
MIN_VERSION_CODE="${MIN_VERSION_CODE:-}"
if [ -z "$MIN_VERSION_CODE" ] && [ -f "$VERSION_FILE" ]; then
  MIN_VERSION_CODE=$(grep -o '"minVersionCode"[[:space:]]*:[[:space:]]*[0-9]*' "$VERSION_FILE" | grep -o '[0-9]*$' | head -1 || true)
fi
[ -n "$MIN_VERSION_CODE" ] || MIN_VERSION_CODE=100

cat > "$VERSION_FILE" << JSONEOF
{
  "android": {
    "versionName": $VERSION_NAME_JSON,
    "versionCode": $VERSION_CODE,
    "minVersionCode": $MIN_VERSION_CODE,
    "downloadUrl": "$DOWNLOAD_URL",
    "apkSize": $APK_SIZE,
    "releasedAt": "$TODAY",
    "forceUpdate": false,
    "changelog": $CHANGELOG_JSON
  },
  "ios": {
    "versionName": "",
    "versionCode": 0,
    "downloadUrl": "",
    "changelog": ""
  }
}
JSONEOF

# 写出来的必须是合法 JSON，否则前端「检查更新」会直接崩，宁可构建失败
if command -v python3 >/dev/null 2>&1; then
  if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$VERSION_FILE"; then
    echo "❌ 生成的 $VERSION_FILE 不是合法 JSON，已中止（请检查 changelog 参数是否已手动转义）" >&2
    exit 1
  fi
fi

echo "Updated $VERSION_FILE"
echo "  versionName: $VERSION_NAME"
echo "  versionCode: $VERSION_CODE"
echo "  minVersionCode: $MIN_VERSION_CODE"
echo "  apkSize: $APK_SIZE"
echo "  downloadUrl: $DOWNLOAD_URL"
