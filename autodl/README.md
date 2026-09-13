# AutoDL 训练套件（上传即跑）

目标：把"该动手就动手"这个行为契约训进一个**小模型**，让它同时拿到速度/显存优势和 4B 级的准确率。
验收标准不是训练 loss，而是 backend 那套 **155 条工具选择评测**（见 `docs/AGENT_EVAL.md`）。

## 为什么值得做（有实测依据）

155 条评测上现状 4B 得 **85.8%**，22 条失败里 **11 条是"该动手却用文字回答"**、
4 条选错工具——都是**行为契约**问题，正是 SFT 擅长的；不是知识或推理问题。

## 三个已经做好的前提

1. **数据已生成**：`backend/scripts/gen-agent-dataset.js` → 1770 条
   - 格式与线上**完全一致**：真实工具目录（按角色裁剪）+ 真实静态 system prompt + 真实日期锚点
   - 覆盖 23 个工具 + 追问/越权拒绝/闲聊三类反例
   - **与评测集零重叠**（生成器内置检查，重叠就报错退出）——否则验收成绩毫无意义
2. **评测门禁已有**：155 条，训练完直接拿去验收
3. **平台操作已封装**：`backend/scripts/autodl.js`（计费/破坏性操作需显式 `--yes`）

## 上传什么

```
agent-train/
├── bootstrap.sh           # 在实例上跑这个
├── train_qlora.yaml       # 训练配置（QLoRA / Qwen3-1.7B）
├── dataset_info.json      # LLaMA-Factory 数据集注册
├── agent-full.jsonl       # 1770 条（53MB，由生成器产出）
└── agent-smoke.jsonl      # 98 条（3MB，用于先验流程）
```

本地准备：`cd backend && node scripts/gen-agent-dataset.js --out /tmp/agent-dataset --per-intent 60`
再按上面的目录名打包上传（见 `upload.sh`）。

## 在实例上怎么跑

```bash
cd /root/autodl-tmp/agent-train
bash bootstrap.sh smoke    # 先花几分钟验证流程，别拿正式训练试错
bash bootstrap.sh full     # 正式训练
```

`bootstrap.sh` 每一步都先检查"有没有"再装，尽量走国内源；结束时打印下载适配器的命令。

## 成本控制（余额只有十几块）

| 做法 | 为什么 |
|---|---|
| **先冒烟再正式** | 流程问题在 20 步内暴露，不要拿一小时训练试错 |
| 用 AutoDL **无卡模式**传数据/验环境 | 约 ¥0.1/小时，把 GPU 时间纯留给训练 |
| 底座走 ModelScope | 国内直连，比 HuggingFace 快得多 |
| 训练完**立刻关机** | 计费按小时，闲置也计费 |
| `per_device_train_batch_size: 1` + 梯度累积 16 | 4090 显存有限，靠累积拿等效 batch |

粗估：Qwen3-1.7B QLoRA / 1770 条 / 3 epoch 在 4090 上约 **1~2 小时**（¥2~5）。
如果余额只够一次实验，**优先跑 1.7B**；4B 作为第二轮。

## 训练完之后（本地做，不花钱）

1. 下载 LoRA 适配器
2. 合并并转 GGUF（llama.cpp `convert_hf_to_gguf.py` + `llama-quantize`）
3. **用同一套 155 条评测验收**：`node tests/eval/run.mjs --base-url ...`
4. 达标后再谈上线；上线的路由方式见下

## 上线怎么接（重要的设计点）

我们线上的本地模型是 **Qwen3-VL（能看图）**。微调出来的是**纯文本小模型**，
如果直接替换会**丢掉看图能力**。所以正确接法是**按内容路由**：

- 带图片的请求 → **Qwen3-VL-4B**（保住视觉）
- 纯文本请求 → **微调后的小模型**（更快、更省显存）

`llm.js` 的上游链已经带了 `vision` 能力标记（本轮加的），具备表达"这个上游能不能看图"的能力。
具体接入等验收结果出来再定。
