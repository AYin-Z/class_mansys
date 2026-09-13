#!/bin/bash
# 本地执行：生成数据集 → 打包 → 上传到 AutoDL 实例
#
# 用法：
#   ./upload.sh <实例SSH> [端口]     # 例：./upload.sh region-1.autodl.com 12345
#
# 说明：AutoDL 每个实例的 SSH 主机/端口都不同（重装/换机会变），所以从命令行传。
# 密码认证的话先手动 ssh 一次确认能连上，或用 sshpass/密钥。
set -euo pipefail
HOST="${1:?用法: ./upload.sh <实例SSH主机> [端口]}"
PORT="${2:-22}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$HERE/../backend"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "== 1/3 本地生成数据集（不花钱） =="
cd "$BACKEND"
node scripts/gen-agent-dataset.js --out "$STAGE" --per-intent 60
node scripts/gen-agent-dataset.js --out "$STAGE" --per-intent 2 >/dev/null   # 冒烟集
# 生成器每次写 agent-tool-calling.jsonl，分别改名
[ -f "$STAGE/agent-tool-calling.jsonl" ] && mv "$STAGE/agent-tool-calling.jsonl" "$STAGE/agent-smoke.jsonl"

echo "== 2/3 组装上传包 =="
cp -f "$HERE/bootstrap.sh" "$HERE/train_qlora.yaml" "$HERE/dataset_info.json" "$STAGE/"
ls -la "$STAGE" | tail -6

echo "== 3/3 上传到 $HOST:$PORT =="
ssh -p "$PORT" -o StrictHostKeyChecking=accept-new "$HOST" 'mkdir -p /root/autodl-tmp/agent-train'
scp -P "$PORT" "$STAGE"/* "$HOST:/root/autodl-tmp/agent-train/"
echo
echo "✅ 上传完成。接着在实例上执行："
echo "   ssh -p $PORT $HOST"
echo "   cd /root/autodl-tmp/agent-train && bash bootstrap.sh smoke"
