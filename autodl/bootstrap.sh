#!/bin/bash
# 在 AutoDL 实例上跑一次：准备环境 → 拉底座 → 注册数据集 → 冒烟 → 正式训练
#
# 设计原则：**把 GPU 时间只留给训练**。镜像里通常已带 torch/LLaMA-Factory，
# 所以这里每步都先检查"有没有"，没有才装。装依赖尽量走国内源。
#
# 用法（在实例上）：
#   bash /root/autodl-tmp/agent-train/bootstrap.sh smoke   # 先验证流程（几分钟）
#   bash /root/autodl-tmp/agent-train/bootstrap.sh full    # 正式训练
set -euo pipefail
MODE="${1:-smoke}"
WORK=/root/autodl-tmp
DATA=$WORK/llamafactory-data
MODEL_DIR=$WORK/models
mkdir -p "$DATA" "$MODEL_DIR" "$WORK/out"

echo "== [1/5] 检查环境 =="
python3 -c "import torch;print('torch',torch.__version__,'cuda',torch.cuda.is_available())" 2>/dev/null || {
  echo "未装 torch，用国内源装（若镜像已带可跳过）"
  pip install -i https://pypi.tuna.tsinghua.edu.cn/simple torch --index-url https://download.pytorch.org/whl/cu121 || true
}
if ! command -v llamafactory-cli >/dev/null 2>&1; then
  echo "未装 LLaMA-Factory，从国内镜像装"
  pip install -i https://pypi.tuna.tsinghua.edu.cn/simple llamafactory || pip install -i https://pypi.tuna.tsinghua.edu.cn/simple "llamafactory[torch,metrics]"
fi
llamafactory-cli version 2>/dev/null | head -3 || true

echo "== [2/5] 准备底座模型（优先 ModelScope，国内快） =="
if [ ! -d "$MODEL_DIR/Qwen3-1.7B" ]; then
  pip install -i https://pypi.tuna.tsinghua.edu.cn/simple modelscope >/dev/null 2>&1 || true
  python3 - <<'PY'
from modelscope import snapshot_download
p = snapshot_download('Qwen/Qwen3-1.7B', cache_dir='/root/autodl-tmp/models')
print('下载到', p)
PY
  # 统一放到固定路径，训练配置里写死了这个路径
  [ -d "$MODEL_DIR/Qwen3-1.7B" ] || ln -sfn "$(ls -d $MODEL_DIR/Qwen/Qwen3-1.7B 2>/dev/null | head -1 || echo .)" "$MODEL_DIR/Qwen3-1.7B"
else
  echo "底座已存在"
fi

echo "== [3/5] 注册数据集 =="
cp -f "$WORK/agent-train/dataset_info.json" "$DATA/dataset_info.json"
cp -f "$WORK/agent-train/agent-full.jsonl" "$DATA/agent-full.jsonl"
cp -f "$WORK/agent-train/agent-smoke.jsonl" "$DATA/agent-smoke.jsonl"
ls -la "$DATA" | tail -4
# 条数自检：与生成时对得上才继续（防止上传截断）
echo "full 条数: $(wc -l < "$DATA/agent-full.jsonl")（应为 1770）"
echo "smoke 条数: $(wc -l < "$DATA/agent-smoke.jsonl")（应为 98）"

echo "== [4/5] 冒烟（只跑 20 步，验证 pipeline 通不通） =="
if [ "$MODE" = "smoke" ]; then
  llamafactory-cli train "$WORK/agent-train/train_qlora.yaml" \
    --dataset agent_smoke --max_steps 20 --num_train_epochs 1 \
    --output_dir "$WORK/out/smoke" --save_steps 100000 --eval_strategy no --plot_loss false
  echo "✅ 冒烟通过。确认没问题后跑：bash $0 full"
  exit 0
fi

echo "== [5/5] 正式训练 =="
llamafactory-cli train "$WORK/agent-train/train_qlora.yaml"
echo "✅ 训练完成，产物在 $WORK/out/qwen3-1.7b-agent-lora"
echo "下载：在本地执行  ssh <实例> 'tar czf - -C $WORK/out qwen3-1.7b-agent-lora' | tar xzf - -C ./out"
