# Android APK 打包与分发指南

> 适用于本项目（uni-app + Vue3 + CloudBase）打包成 Android 安装包并自助分发，无需任何企业资质审核。

## 目录
1. [迁移背景](#迁移背景)
2. [代码改动一览](#代码改动一览)
3. [HBuilderX 云打包（推荐）](#hbuilderx-云打包推荐)
4. [打正式版 APK](#打正式版-apk)
5. [APK 分发渠道](#apk-分发渠道)
6. [常见问题](#常见问题)
7. [回滚到小程序版本](#回滚到小程序版本)

---

## 迁移背景

微信小程序对"团队/班级管理"类工具有较严的资质要求：个人开发者无法通过审核。
本项目从 v1.0.0 起改为 **Android APK 自助分发**：
- 不需要任何资质或备案
- 不需要走应用商店（也可上架）
- 用户从下载链接 / 二维码安装即可使用
- 后端、数据库、业务代码与小程序版本**完全共用**

迁移前的小程序完整功能版本已封存为 git tag `v1.0.0-mp-weixin` 与分支 `archive/mp-weixin-v1.0.0`。

---

## 代码改动一览

> 以下改动已在 main 分支完成，不需要再手动调整。

| 文件 | 改动 |
|---|---|
| `src/utils/cloudbase.ts` | 移除 App 端 `appSign/appSecret` 占位字符串。改为：仅当 `VITE_APP_SIGN / VITE_APP_ACCESS_KEY_ID / VITE_APP_ACCESS_KEY` 三项环境变量齐全时才注入，否则统一走 PublishableKey。 |
| `src/pages/auth/register.vue` | 用 `// #ifdef MP-WEIXIN` 包裹"微信快速登录"按钮 + `wechatLogin()` 函数。App 端不显示该按钮，也不会编译进产物。 |
| `src/pages/login/index.vue` | 同上，包裹"微信 OpenID 登录"和"微信手机号一键登录"两个按钮 + 对应函数 + 相关 import。 |
| `src/manifest.json` | 改 `name` 为 "区队管理系统"；精简 Android 权限到必需 8 项；`abiFilters` 仅保留 `arm64-v8a`；新增 `minSdkVersion=21 / targetSdkVersion=30`。 |
| `package.json` | 把默认 `build`/`dev` 脚本切到 `--platform app`。 |

App 端可用的登录方式：
- 手机号 + 密码 / 邮箱 + 密码 / 用户名 + 密码
- 手机号 验证码 OTP
- 邮箱 验证码 OTP
- 匿名登录

如需 App 端的微信登录，需另行申请微信开放平台「移动应用」，本指南不涵盖。

---

## HBuilderX 云打包（推荐）

零环境配置，全程在 HBuilderX 内点鼠标完成。

### 1. 安装 HBuilderX

- 下载地址：https://www.dcloud.io/hbuilderx.html
- 选 **「App 开发版」**（约 200MB）
- 安装后启动，注册并登录 DCloud 账号（云打包要用）

### 2. 导入项目

- HBuilderX 菜单：**文件 → 导入 → 从本地目录导入**
- 选择本仓库根目录 `class_manage_sys`

### 3. 配置 manifest.json

双击 `src/manifest.json`，HBuilderX 会用图形界面打开。

**基础配置**
- 应用名称：区队管理系统
- AppID：点 **「重新获取」** 自动生成（不要手填，否则云打包会失败）
- 版本名称：`1.0.0`
- 版本号：`100`（每次发布递增 1）

**App 图标配置**
- 上传一张 1024×1024 PNG
- 点 **「自动生成所有图标」**，HBuilderX 会一次性生成所有尺寸

**App 启动界面配置**
- 用默认即可，或上传一张启动图

**App 模块配置（重要：不勾的不打入包）**
- 推送、统计、地图、蓝牙、扫码、人脸、AR、Speech、SQLite、ZIP 等**全部不勾**
- 默认产物 ~15MB

**App 权限配置（Android）**
- 已经在源码视图里配好了 8 项必需权限，图形界面会自动同步勾选
- 不要乱勾其他权限，越少越好

### 4. 制作自定义调试基座（首次必做）

正式打包前先做调试基座，方便边写代码边在真机上预览。

- 菜单：**发行 → 原生 App-制作自定义调试基座 → Android**
- 证书选 **「使用公共测试证书」**（免费，仅自己测试用）
- 等 3-5 分钟云端编译

### 5. 真机调试

- Android 手机打开 **「USB 调试」** 模式（开发者选项里）
- 用数据线连电脑
- HBuilderX 菜单：**运行 → 运行到手机或模拟器 → 运行到 Android App 基座**
- 首次会自动安装基座到手机
- 之后改代码会通过 HMR 实时刷新到手机上

---

## 打正式版 APK

测试通过后，正式打包用于分发。

### 步骤

- HBuilderX 菜单：**发行 → 原生 App-云打包**
- **包名**：`com.yinzheng.classmanage`（域名反写格式，唯一标识；以后**不要再改**，否则用户无法升级覆盖安装）
- **证书**：
  - **自己分发** / 内测：选 **「使用公共测试证书」** 即可
  - **上应用商店**（小米、华为、应用宝、酷安）：必须 **「使用自有证书」**
    - 现场点 **「云端证书」** 让 HBuilderX 帮你生成（最简单）
    - **证书文件务必备份！** 丢失后无法升级版本，只能换包名重新发布
- **渠道包**：勾「Android-通用」一个就行
- **打包类型**：**「正式版」**
- **广告**：全部不勾
- 点 **「打包」**，等 5-10 分钟

完成后控制台会输出 APK 下载链接，下载下来传到手机即可安装。

---

## APK 分发渠道

> ⚠️ 直接在微信/QQ 里发 `.apk` 链接会被拦截显示"已停止访问"。

推荐方案（按从简到繁）：

| 方案 | 说明 | 适合场景 |
|---|---|---|
| **蒲公英** ([pgyer.com](https://www.pgyer.com)) | 上传 APK → 自动生成下载页 + 二维码 + 安装链接，免费版够用 | **强烈推荐**，新手首选 |
| **fir.im** | 同蒲公英，老牌内测平台 | 同上 |
| **腾讯云 COS / 阿里云 OSS** | 自建下载页面，绑定自己域名 | 量大、有自己域名 |
| **应用宝 / 华为 / 小米 应用商店** | 正式上架，需要软件著作权 | 想要"正式发布"光环 |

蒲公英分发示意：
1. 注册账号 → 上传 APK
2. 平台生成 `https://www.pgyer.com/xxxx` 的下载页
3. 生成二维码，分享给同学扫码安装

---

## 常见问题

### Q1：构建产物在哪里？
本地命令 `npm run build:app` 的产物在 `dist/build/app/`，但**这只是前端资源（wgt 包）**，不是 APK。
APK 必须通过 HBuilderX 的「云打包」或「Android 离线打包」生成。

### Q2：CloudBase 后端要改吗？
不用。后端依然是部署在腾讯云 CloudRun 上的 Express 服务，App 端走 HTTPS 调用，与小程序完全一样。

### Q3：HTTPS 域名要备案吗？
你已经有 `class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com` 的官方默认域名，App 端调用**不需要备案**。
小程序需要备案是因为微信平台的合规要求；Android App 调 HTTPS 接口没有这个限制。

### Q4：微信登录怎么办？
当前版本 App 端不提供微信登录。用户用 **手机号/邮箱 + 密码** 或 **手机号 + 验证码** 登录即可。
后续如确实需要微信登录，需：
1. 去微信开放平台 [open.weixin.qq.com](https://open.weixin.qq.com) 申请「移动应用」（个人也能申请）
2. 拿到 AppID/AppSecret 后填到 manifest.json 的「OAuth 微信登录」模块
3. 改造代码用 `uni.login({ provider: 'weixin' })`

### Q5：升级用户的 APK 怎么办？
两种方式：
1. **手动**：在群里发新版下载链接，让用户重新下载安装（包名相同会自动覆盖）
2. **自动**：在 App 内集成「检查更新」逻辑，调用后端接口比对版本号，下载新 APK 后调起 `plus.runtime.install` 自动安装。可选，后续做。

### Q6：能直接在 Android Studio 里改原生代码吗？
能，但需要走 **「Android 离线打包」** 流程：下载 DCloud 离线 SDK + Android Studio 项目壳 + 把 wgt 包套进去。本指南不展开，参考 https://nativesupport.dcloud.net.cn/AppDocs/usesdk/android

---

## 回滚到小程序版本

如果哪天又想拿小程序版本继续发布，可以随时回到封存点：

```bash
# 查看小程序版本（只读，不影响 main）
git checkout v1.0.0-mp-weixin

# 或基于归档分支重开发布线
git checkout -b release/mp-weixin archive/mp-weixin-v1.0.0
```

回到 main 继续 Android 工作：

```bash
git checkout main
```
