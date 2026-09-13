#!/usr/bin/env bash
# 本地对话模型服务（llama-server，OpenAI 兼容）
#
# 为什么需要它：系统内的对话助手（services/agent）在 hybrid 模式下优先走本地模型，
# 把 DeepSeek 的按量计费降为零边际成本；本地不可用时由 llm.js 自动回落到远端，
# 所以这个进程挂掉只会让成本回到 API 计费，不会让功能不可用。
#
# 参数为什么这么定（实测依据，改动前请重测）：
#   -c 65536 --parallel 4  每槽 16K。工具表 + 内联 guide 约占 6~6.5K token，
#                          再叠加会话历史（agentService 会带最近 30 条消息），
#                          每槽 8K 会在长对话里直接 400（exceeds context size）。
#                          实测 -c 32768 --parallel 4（每槽 8K）请求全部失败。
#   -ctk/-ctv q8_0         KV 量化，64K 从 9.4G 压到 4.7G，否则和 Hermes 的 9B 抢显存会 OOM。
#   --jinja                让工具调用走 Qwen 的 chat template（否则 tool_calls 格式不对）。
#   -ngl 99                全部层上 GPU；纯 CPU 推理约 0.5 tok/s，不可用。
#
# 实测（RTX 5060 Ti 16G，与 Hermes 9B 并存，显存占用约 12.8G/16.3G）：
#   - 单轮工具选择 17/17，平均 0.6s，热前缀缓存下 8 并发吞吐约 9.7 req/s
#   - 4 并发时每请求约 4.2s（未命中前缀缓存）
set -euo pipefail

LLAMA_SERVER="${LLAMA_SERVER:-/home/ayin/llama.cpp/build4/bin/llama-server}"
# 视觉投影器：我们的模型是 Qwen3-VL（视觉模型），加上它才真的能看图。
# 实测（2026-09-12）：给一张请假证明照片，模型能读出姓名/类型/时间/事由并直接生成
# 正确的 apply_leave 调用；热态 1.0~1.5s（纯文本约 0.67s），prompt 多约 1500 token。
# 首次请求要 28s（加载并初始化视觉编码器），之后正常——所以重启后第一条图片请求会慢。
MMPROJ="${LOCAL_LLM_MMPROJ:-/home/ayin/models/gguf/mmproj-F16.gguf}"
MODEL="${LOCAL_LLM_MODEL_PATH:-/home/ayin/models/gguf/Qwen3-VL-4B-Instruct-Q4_K_M.gguf}"
HOST="${LOCAL_LLM_HOST:-127.0.0.1}"
PORT="${LOCAL_LLM_PORT:-8090}"
# 2026-09-12 修正：原来配 64K/4 槽（KV 约 4.9G），是按"显存最空闲时"估的。
# 实测 Hermes 的 9B 常驻占 8G 后只剩 7.7G 可用，llama-server 因装不下直接 abort，
# 服务卡在 activating —— 本地模型静默不可用，全部请求回落 DeepSeek（要花钱）。
# 现在按"Hermes 在跑时也能起来"来配：模型 2.4G + 32K/q8 KV 2.4G ≈ 4.8G，留足余量。
# 需求侧只有约 0.8 轮/秒，而修好前缀缓存后单槽就够快，2 槽完全够用。
# 上下文按**当前可用显存**自动定档，而不是写死。
# 教训：原来写死 64K/4 槽，Hermes 的 9B 一起来就装不下，llama-server 直接 abort，
# systemd 反复重启形成崩溃循环（实测一晚 26 次），本地模型静默不可用、全部请求走了要花钱的 API。
# 宁可上下文小一点，也不要起不来——起不来是"功能静默降级"，比慢更糟。
if [[ -z "${LOCAL_LLM_CTX:-}" ]]; then
  FREE_MIB=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1 || echo 0)
  if   (( FREE_MIB >= 11000 )); then CTX=65536; PARALLEL=4
  elif (( FREE_MIB >= 8000  )); then CTX=32768; PARALLEL=4
  elif (( FREE_MIB >= 6000  )); then CTX=32768; PARALLEL=2
  else                               CTX=16384; PARALLEL=1
  fi
  echo "[serve-local-llm] 可用显存 ${FREE_MIB}MiB → 上下文 ${CTX} / ${PARALLEL} 槽"
fi
CTX="${LOCAL_LLM_CTX:-$CTX}"
PARALLEL="${LOCAL_LLM_PARALLEL:-$PARALLEL}"

if [[ ! -x "$LLAMA_SERVER" ]]; then
  echo "llama-server 不存在或不可执行: $LLAMA_SERVER" >&2
  exit 1
fi
if [[ ! -f "$MODEL" ]]; then
  echo "模型文件不存在: $MODEL" >&2
  exit 1
fi

MMPROJ_ARGS=()
# Qwen-VL 官方要求：grounding/文档识别类任务至少给 1024 个图像 token，否则精度会掉
if [[ -f "$MMPROJ" ]]; then
  MMPROJ_ARGS=(--mmproj "$MMPROJ" --image-min-tokens 1024)
else
  echo "[serve-local-llm] 未找到视觉投影器 $MMPROJ，本次以纯文本模式启动" >&2
fi

exec "$LLAMA_SERVER" \
  -m "$MODEL" \
  "${MMPROJ_ARGS[@]}" \
  -ngl 99 \
  --host "$HOST" \
  --port "$PORT" \
  -c "$CTX" \
  -ctk q8_0 -ctv q8_0 \
  --parallel "$PARALLEL" \
  --jinja
