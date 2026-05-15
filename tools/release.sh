#!/bin/bash
# ═══════════════════════════════════════════════════
# class_mansys APK 版本发布工具
# 使用: bash tools/release.sh <versionName> <versionCode>
# 示例: bash tools/release.sh 1.1.0 110
# ═══════════════════════════════════════════════════
set -e

if [ $# -lt 2 ]; then
  echo "用法: bash tools/release.sh <versionName> <versionCode>"
  echo "示例: bash tools/release.sh 1.1.0 110"
  exit 1
fi

VERSION_NAME="$1"
VERSION_CODE="$2"
MIN_VERSION_CODE="${3:-$VERSION_CODE}"
TIMESTAMP=$(date +%Y-%m-%d)
APK_NAME="class-mansys-v${VERSION_NAME}.apk"
APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DST="backend/apk/${APK_NAME}"
JSON_FILE="backend/data/app-version.json"

cd "$(dirname "$0")/.."

echo "════════════════════════════════════════"
echo "  class_mansys v${VERSION_NAME} 发布"
echo "════════════════════════════════════════"

# 1. 构建前端
echo "→ 构建前端..."
npm run build
echo "  ✓ 前端构建完成"

# 2. 同步 Capacitor
echo "→ 同步 Capacitor..."
npx cap sync android
echo "  ✓ Capacitor 同步完成"

# 3. 构建 APK
echo "→ 构建 APK..."
cd android
./gradlew assembleDebug
cd ..
echo "  ✓ APK 构建完成"

# 4. 复制 APK 到发布目录
echo "→ 部署 APK..."
if [ ! -f "$APK_SRC" ]; then
  echo "  ✗ APK 文件未找到: $APK_SRC"
  exit 1
fi

cp "$APK_SRC" "$APK_DST"
APK_SIZE=$(stat --printf="%s" "$APK_DST")
echo "  ✓ 已部署: ${APK_DST} ($(echo "scale=1; $APK_SIZE/1024/1024" | bc)MB)"

# 5. 更新版本配置
echo "→ 更新版本配置..."
cat > "$JSON_FILE" << EOF
{
  "android": {
    "versionName": "${VERSION_NAME}",
    "versionCode": ${VERSION_CODE},
    "minVersionCode": ${MIN_VERSION_CODE},
    "downloadUrl": "https://cls.ayinserver.xin/apk/${APK_NAME}",
    "apkSize": ${APK_SIZE},
    "releasedAt": "${TIMESTAMP}",
    "forceUpdate": false,
    "changelog": "请手动编辑 backend/data/app-version.json 补充更新日志"
  },
  "ios": {
    "versionName": "",
    "versionCode": 0,
    "downloadUrl": "",
    "changelog": ""
  }
}
EOF
echo "  ✓ 版本配置已更新"

# 6. 清缓存
echo "→ 清理 CDN 缓存（APK 路径）..."
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/e05b6562cf26162c5202e04282642e50/purge_cache" \
  -H "Authorization: Bearer $(grep -m1 'd1_ayin_key' ~/.hermes/hermes-agent/config.yaml 2>/dev/null | awk '{print $2}' || echo '')" \
  -H "Content-Type: application/json" \
  -d "{\"files\":[\"https://cls.ayinserver.xin/apk/${APK_NAME}\"]}" > /dev/null 2>&1 || true
echo "  ✓ CDN 缓存清理完成"

echo ""
echo "════════════════════════════════════════"
echo "  发布完成!"
echo "  APK: https://cls.ayinserver.xin/apk/${APK_NAME}"
echo "  API: https://cls.ayinserver.xin/api/app/latest?platform=android"
echo "════════════════════════════════════════"
echo ""
echo "⚠️  记得:"
echo "  1. git add backend/data/app-version.json backend/apk/"
echo "  2. 手动编辑 changelog (版本配置中已留占位)"
echo "  3. git commit -m 'release: v${VERSION_NAME}'"
