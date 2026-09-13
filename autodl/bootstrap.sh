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
# ⚠️ 非交互式 SSH **不会加载 .bashrc/conda**，PATH 里没有 python。
# AutoDL 镜像的 python 在 conda base 里，必须用绝对路径（这是实测踩到的）。
PY=/root/miniconda3/bin/python
PIP="$PY -m pip"
PIP_ARGS="-i https://pypi.tuna.tsinghua.edu.cn/simple"
export PATH=/root/miniconda3/bin:$PATH
DATA=$WORK/llamafactory-data
MODEL_DIR=$WORK/models
mkdir -p "$DATA" "$MODEL_DIR" "$WORK/out"

echo "== [1/5] 检查环境 =="
[ -x "$PY" ] || { echo "找不到 $PY（不是预期的 AutoDL 镜像？）"; exit 1; }
$PY -c "import torch;print('torch',torch.__version__,'| cuda编译',torch.version.cuda)" || {
  echo "未装 torch，用国内源装"; $PIP install $PIP_ARGS torch || true
}
echo "=== 按需安装训练依赖（缺什么装什么，走清华源）==="
NEED=""
for m in transformers datasets peft trl accelerate bitsandbytes modelscope; do
  $PY -c "import $m" 2>/dev/null || NEED="$NEED $m"
done
if [ -n "$NEED" ]; then
  echo "缺：$NEED"
  # bitsandbytes 单独装（QLoRA 4bit 量化要用）
  $PIP install $PIP_ARGS $NEED
else
  echo "依赖齐全"
fi
if ! $PY -c "import llamafactory" 2>/dev/null; then
  echo "安装 LLaMA-Factory（体积较大，耐心等）"
  # ⚠️ 保护：pip 解析依赖时可能把镜像自带的 torch 2.8.0+cu128 换成别的版本（尤其 CPU 版），
  # 那样 GPU 训练直接废掉，而且要到切了 GPU 模式才会发现、白烧钱。
  # 所以装前记版本、装后核对，不一致就装回来。
  BEFORE=$($PY -c "import torch;print(torch.__version__)" 2>/dev/null || echo none)
  echo "  装前 torch: $BEFORE"
  $PIP install $PIP_ARGS llamafactory
  AFTER=$($PY -c "import torch;print(torch.__version__)" 2>/dev/null || echo none)
  echo "  装后 torch: $AFTER"
  if [ "$BEFORE" != "$AFTER" ]; then
    echo "  ⚠️ torch 被换掉了，装回 $BEFORE"
    $PIP install $PIP_ARGS "torch==${BEFORE%%+*}" || true
    $PY -c "import torch;print('  恢复后 torch:',torch.__version__,'| cuda编译',torch.version.cuda)"
  fi
  # 最终核对：必须是带 cuda 编译信息的版本（torch.version.cuda 非空）
  $PY -c "
import torch,sys
cu=getattr(torch.version,'cuda',None)
print('  最终 torch:',torch.__version__,'| cuda编译版本:',cu)
sys.exit(0 if cu else 1)
" || { echo '  ❌ torch 没有 CUDA 支持，切 GPU 前必须先修好——否则白烧钱'; exit 1; }
fi
$PY -c "import llamafactory;print('llamafactory ok')" 2>/dev/null || echo "⚠️ llamafactory 导入失败，稍后看报错"

echo "== [2/5] 准备底座模型（优先 ModelScope，国内快） =="
# 训的是线上那个 VL-4B（零架构改动直接上线，且只训语言层所以保住看图）
if [ ! -d "$MODEL_DIR/Qwen3-VL-4B-Instruct" ]; then
  pip install -i https://pypi.tuna.tsinghua.edu.cn/simple modelscope >/dev/null 2>&1 || true
  $PY - <<'PY'
from modelscope import snapshot_download
p = snapshot_download('Qwen/Qwen3-VL-4B-Instruct', cache_dir='/root/autodl-tmp/models')
print('下载到', p)
PY
  # 统一放到固定路径（训练配置写死了它）。
  # ⚠️ 修过一次 bug：原来的回退写成 `... || echo .`，而 ModelScope 的缓存目录形如
  #    models/models/Qwen--<name>/snapshots/master，`ls -d` 匹配不到就回落成 "."，
  #    结果建出一个**指向自己的符号链接**，训练时路径解析会失败。
  #    现在改为：按 config.json 真实定位，找不到就直接报错，不猜。
  REAL=$(find "$MODEL_DIR" -maxdepth 6 -name config.json -path "*Qwen3-VL-4B-Instruct*" 2>/dev/null | head -1 | xargs -r dirname)
  if [ -z "$REAL" ]; then echo "❌ 找不到底座真实目录，无法建链接"; exit 1; fi
  echo "  底座真实目录: $REAL"
  ln -sfn "$REAL" "$MODEL_DIR/Qwen3-VL-4B-Instruct"
  $PY -c "import json;json.load(open('$MODEL_DIR/Qwen3-VL-4B-Instruct/config.json'));print('  ✅ 底座可通过固定路径访问')"
  # torchaudio 版本冲突（实测踩到）：llamafactory 会拉 torchaudio（默认最新，编到 CUDA 13），
  # 与镜像的 torch+cu128 不匹配 → 导入即报 libcudart.so.13 找不到。
  # 必须钉到与 torch 同版本。装完核对一次，不匹配立刻修，否则切 GPU 才发现就白烧钱。
  $PY - <<'PY' || true
import torch, subprocess, sys, re, importlib
want = '2.8.0'
try:
    import torchaudio
    ver = torchaudio.__version__
    ok = ver.startswith(want)
    print('  torchaudio', ver, '（期望', want + '）')
    if not ok:
        raise ImportError('版本不匹配')
except Exception as e:
    print('  torchaudio 有问题（' + str(e)[:80] + '），重装匹配版本')
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q',
                    '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple',
                    'torchaudio==' + want])
    importlib.invalidate_caches()
    import torchaudio
    print('  修好后 torchaudio', torchaudio.__version__)
PY
else
  echo "底座已存在"
fi

echo "== [3/5] 注册数据集 =="
cp -f "$WORK/agent-train/dataset_info.json" "$DATA/dataset_info.json"
cp -f "$WORK/agent-train/agent-full.jsonl" "$DATA/agent-full.jsonl"
cp -f "$WORK/agent-train/agent-smoke.jsonl" "$DATA/agent-smoke.jsonl"
ls -la "$DATA" | tail -4
# 条数自检：与生成时对得上才继续（防止上传截断）
echo "full 条数: $(wc -l < "$DATA/agent-full.jsonl")"
echo "smoke 条数: $(wc -l < "$DATA/agent-smoke.jsonl")"
# 格式自检：VL 模型 + tools 字段这套组合能不能被模板接受，是本次最大的未知数之一。
# 先在无卡模式下用极小样本干跑一次预处理，几秒就能暴露问题，不用等 GPU。
python3 - <<'PY'
import json,sys
p='/root/autodl-tmp/llamafactory-data/agent-smoke.jsonl'
bad=0
for i,l in enumerate(open(p)):
    d=json.loads(l)
    if 'tools' not in d or 'conversations' not in d: bad+=1
    else:
        # tools 必须是 JSON 字符串，且能被解析成列表
        try: t=json.loads(d['tools']); assert isinstance(t,list) and t
        except Exception as e: print('  tools 字段异常:',e); bad+=1
print('格式自检：异常',bad,'条')
sys.exit(1 if bad else 0)
PY

# 转换器 + 模板渲染自检：**这一步决定了会不会白训**
# 训练格式与推理格式不一致时，loss 会正常下降但模型学不会实际要的行为——
# 而且要到切了 GPU、烧了钱才发现。这里在无卡模式下用 CPU 把整条链路走一遍。
echo "--- 转换器与模板渲染自检（免费，决定会不会白训）---"
$PY - <<'PY'
import json, sys
from transformers import AutoTokenizer
from llamafactory.data.template import TEMPLATES
from llamafactory.data.parser import DatasetAttr
from llamafactory.data.converter import SharegptDatasetConverter
from llamafactory.hparams import DataArguments
MP = "/root/autodl-tmp/models/Qwen3-VL-4B-Instruct"
name = "qwen3_vl_nothink"
if name not in TEMPLATES:
    print("  ❌ 模板 %s 不存在；含 vl 的有: %s" % (name, [n for n in TEMPLATES if "vl" in n]))
    sys.exit(1)
tok = AutoTokenizer.from_pretrained(MP, trust_remote_code=True)
attr = DatasetAttr(load_from="file", dataset_name="agent_smoke", formatting="sharegpt",
                   messages="conversations", system="system", tools="tools")
row = json.loads(open("/root/autodl-tmp/llamafactory-data/agent-smoke.jsonl").readline())
out = SharegptDatasetConverter(attr, DataArguments())(row)
res = TEMPLATES[name].encode_oneturn(tok, out["_prompt"] + out["_response"],
                                     system=out["_system"], tools=out["_tools"])
txt = tok.decode(res[0] if isinstance(res, tuple) else res)
ok = all(k in txt for k in ("<tools>", "<tool_call>", "<tool_response>"))
print("  token 数:", len(res[0]) if isinstance(res, tuple) else len(res))
print("  含 <tools>/<tool_call>/<tool_response>:", ok)
print("  ✅ 训练格式与 Qwen 工具调用格式一致" if ok else "  ❌ 渲染结果不含工具调用标记，切 GPU 前必须查清")
sys.exit(0 if ok else 1)
PY

# setup：只做环境+底座+数据，**不训练**——用于无卡模式（没有 GPU 时训练跑不了）
if [ "$MODE" = "setup" ]; then
  echo "✅ setup 完成（环境/底座/数据就绪）。切到 GPU 模式后执行：bash $0 smoke"
  exit 0
fi

echo "== [4/5] 冒烟（只跑 20 步，验证 pipeline 通不通） =="
if [ "$MODE" = "smoke" ]; then
  $PY -m llamafactory.cli train "$WORK/agent-train/train_qlora.yaml" \
    --dataset agent_smoke --max_steps 20 --num_train_epochs 1 \
    --output_dir "$WORK/out/smoke" --save_steps 100000 --eval_strategy no --plot_loss false
  echo "✅ 冒烟通过。确认没问题后跑：bash $0 full"
  exit 0
fi

echo "== [5/5] 正式训练 =="
$PY -m llamafactory.cli train "$WORK/agent-train/train_qlora.yaml"
echo "✅ 训练完成，产物在 $WORK/out/qwen3-1.7b-agent-lora"
echo "下载：在本地执行  ssh <实例> 'tar czf - -C $WORK/out qwen3-1.7b-agent-lora' | tar xzf - -C ./out"
