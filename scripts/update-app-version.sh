#!/usr/bin/env bash
# ============================================================
# update-app-version.sh — 构建后更新 app-version.json
# 由 CI 在 APK/AAB 构建完成后调用。
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APK_DIR="$PROJECT_DIR/backend/apk"
VERSION_FILE="$PROJECT_DIR/backend/data/app-version.json"

VERSION_NAME="${1:-}"
VERSION_CODE="${2:-}"
APK_SIZE="${3:-0}"
CHANGELOG="${4:-}"

if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ]; then
  echo "Usage: $0 <versionName> <versionCode> [apkSize] [changelog]"
  exit 1
fi

# 查找生成的 APK 文件
APK_FILE=$(ls -t "$APK_DIR"/class-mansys-v*.apk 2>/dev/null | head -1)
if [ -n "$APK_FILE" ] && [ "$APK_SIZE" = "0" ]; then
  APK_SIZE=$(stat -c%s "$APK_FILE" 2>/dev/null || echo 0)
fi

APK_FILENAME=$(basename "$APK_FILE" 2>/dev/null || echo "")
DOWNLOAD_URL="https://cls.ayinserver.xin/apk/${APK_FILENAME}"
TODAY=$(date +%Y-%m-%d)

# 构建新版本数据
cat > "$VERSION_FILE" << JSONEOF
{
  "android": {
    "versionName": "$VERSION_NAME",
    "versionCode": $VERSION_CODE,
    "minVersionCode": $VERSION_CODE,
    "downloadUrl": "$DOWNLOAD_URL",
    "apkSize": $APK_SIZE,
    "releasedAt": "$TODAY",
    "forceUpdate": false,
    "changelog": "$CHANGELOG"
  },
  "ios": {
    "versionName": "",
    "versionCode": 0,
    "downloadUrl": "",
    "changelog": ""
  }
}
JSONEOF

echo "Updated $VERSION_FILE"
echo "  versionName: $VERSION_NAME"
echo "  versionCode: $VERSION_CODE"
echo "  apkSize: $APK_SIZE"
echo "  downloadUrl: $DOWNLOAD_URL"
