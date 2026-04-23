# 项目进度说明（快照）

> 最后更新：2026-04-23（以本仓库 `main` 分支为准）

本文档描述**当前迭代阶段**与**阻塞项**，与全景说明 [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) 互补。

---

## 已完成

- **前端**：uni-app Vue3 + Vite；自定义导航栏与底部 Tab；H5 / App-plus / 微信小程序条件编译；CloudBase 登录与业务 API 封装。
- **后端**：Express + MySQL（CloudBase Serverless MySQL）；JWT；已部署至 CloudRun；健康检查与业务接口可用。
- **Android 适配方向**：HBuilderX **云打包**在 uni-app **CLI + Vite** 项目上无法稳定走通（manifest 转换报错 `reading 'plus'`、打包任务无后续等），已**正式放弃**该路径。
- **新打包路径**：引入 **Capacitor 8**，以 **H5 生产构建**（`dist/build/h5`）作为 WebView 资源，在本地用 **Android Studio / Gradle** 出 APK；`capacitor.config.ts` 与 npm 脚本已就绪。
- **工程卫生**：`.gitignore` 排除 `dist/`、`unpackage/`、签名文件与 Capacitor 构建产物；移除误跟踪的构建产物；`docs/android-build-guide.md` 顶部已标注弃用并指向 Capacitor 方案。

---

## 进行中 / 待办

| 项 | 状态 |
|---|---|
| 安装 **Android Studio** 与 **Android SDK**（本机） | 待用户完成 |
| `npx cap add android` → `npx cap sync android` | 依赖上一步 |
| 配置 **Release 签名**（复用既有 `clamansys.keystore` 或新建） | 待执行 |
| `./gradlew assembleRelease` 产出可分发 APK | 待执行 |
| 补充 **`docs/capacitor-build-guide.md`**（逐步截图/命令） | APK 跑通后撰写 |

---

## 环境与密钥（不入库）

- 生产 API 等通过 **`.env.production`**（已 git 忽略）或部署平台注入；仓库内勿提交真实密钥与 keystore。
- 参考：`.env.example` / `.env.development`（若存在）。

---

## 版本与分支提示

- 小程序基线可参考历史 tag / 分支（如 `v1.0.0-mp-weixin`、`archive/mp-weixin-v1.0.0`），以仓库实际 tag 为准。
