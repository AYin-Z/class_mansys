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
MODEL="${LOCAL_LLM_MODEL_PATH:-/home/ayin/models/gguf/Qwen3-VL-4B-Instruct-Q4_K_M.gguf}"
HOST="${LOCAL_LLM_HOST:-127.0.0.1}"
PORT="${LOCAL_LLM_PORT:-8090}"
CTX="${LOCAL_LLM_CTX:-65536}"
PARALLEL="${LOCAL_LLM_PARALLEL:-4}"

if [[ ! -x "$LLAMA_SERVER" ]]; then
  echo "llama-server 不存在或不可执行: $LLAMA_SERVER" >&2
  exit 1
fi
if [[ ! -f "$MODEL" ]]; then
  echo "模型文件不存在: $MODEL" >&2
  exit 1
fi

exec "$LLAMA_SERVER" \
  -m "$MODEL" \
  -ngl 99 \
  --host "$HOST" \
  --port "$PORT" \
  -c "$CTX" \
  -ctk q8_0 -ctv q8_0 \
  --parallel "$PARALLEL" \
  --jinja
