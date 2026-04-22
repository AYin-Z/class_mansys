# 应用内更新模块使用指南

## 架构总览

```
┌──────────────┐    GET /api/app/latest     ┌───────────────┐
│  Android APP ├───────────────────────────>│  CloudRun 后端 │
│              │<───────────────────────────┤               │
└──────┬───────┘   { versionName, downloadUrl, ... }         └───────┬───────┘
       │                                                             │
       │ plus.downloader                                              │ 读取
       v                                                              v
   手机下载 APK                                          backend/data/app-version.json
       │
       v
   plus.runtime.install()  →  系统弹安装界面
```

## 前端组件

- `src/utils/update-checker.ts`：核心工具，仅在 `#ifdef APP-PLUS` 下生效
  - `checkAppUpdate({ silent })`：检查 + 弹框 + 下载 + 安装一条龙
  - `getCurrentAppVersion()`：读取当前 APK 的 versionName / versionCode
- `src/App.vue` → `onLaunch`：启动后 3s 静默检查（失败不打扰用户）
- `src/pages/profile/index.vue` → "检查更新" 菜单项：手动触发

H5 / 小程序不会编译这些代码进产物，零副作用。

## 后端接口

### `GET /api/app/latest?platform=android`

返回示例：

```json
{
  "success": true,
  "data": {
    "versionName": "1.0.1",
    "versionCode": 101,
    "minVersionCode": 100,
    "downloadUrl": "https://cdn.example.com/class-manage-v1.0.1.apk",
    "apkSize": 15728640,
    "releasedAt": "2026-05-01",
    "forceUpdate": false,
    "changelog": "- 修复请假单审批失败的问题\n- 优化启动速度"
  }
}
```

字段说明：

| 字段 | 说明 |
| ------ | ------ |
| `versionName` | 给用户看的版本号（如 `1.0.1`） |
| `versionCode` | 整数递增版本号，用于比对（新版本必须大于旧版本） |
| `minVersionCode` | 低于此值的客户端将被强制升级 |
| `downloadUrl` | APK 直链（必须是 https） |
| `apkSize` | APK 大小（字节），用于 UI 显示 |
| `forceUpdate` | 是否强制升级（弹框不可取消） |
| `changelog` | 更新说明，支持 `\n` 换行 |

## 发布新版本流程

### 1. 构建新版 APK

在 HBuilderX 打包时：
1. 修改 `src/manifest.json`：
   - `versionName` → `"1.0.1"`
   - `versionCode` → `"101"`（整数递增）
2. 菜单 → 发行 → 原生App-云打包（或本地打包）
3. 得到 `class_manage_sys_v1.0.1.apk`

### 2. 上传 APK 到 CDN

推荐方案（按成本从低到高）：

- **腾讯云 COS**：最便宜，2 元/月起，支持防盗链
  ```
  上传 → 设置 Object 为公有读 → 拷贝永久链接
  ```
- **蒲公英 (pgyer.com)**：免费，但有下载次数限制
- **自建 Nginx**：只需要能 https 访问即可

**注意**：`downloadUrl` 必须是 https，否则 Android 9+ 会拒绝下载。

### 3. 更新服务器端版本配置

编辑 `backend/data/app-version.json`：

```json
{
  "android": {
    "versionName": "1.0.1",
    "versionCode": 101,
    "minVersionCode": 100,
    "downloadUrl": "https://your-cdn.com/class-manage-v1.0.1.apk",
    "apkSize": 15728640,
    "releasedAt": "2026-05-01",
    "forceUpdate": false,
    "changelog": "- 修复请假单审批失败的问题\n- 优化启动速度"
  }
}
```

然后重新部署后端（CloudBase Run 会自动热更新）：

```bash
tcb cloudrun deploy
# 或通过 HBuilderX / 云开发控制台手动触发
```

### 4. 用户体验

- 老版本 App 启动后 3 秒自动弹框，告知有新版本
- 用户点"立即更新"：
  - 应用开始后台下载 APK
  - 进度条显示在加载遮罩上
  - 下载完成后自动拉起系统安装界面
  - 用户确认后安装，旧版本自动被覆盖
- 用户点"稍后"：
  - 本次启动不再提示
  - 下次启动会再提示一次
  - 如果用户明确忽略过这个版本（点"稍后"），该版本不会再次弹框；发新版本后重新计算
- 用户长期不升级：
  - 提升 `minVersionCode` 到较新版本
  - 老版本启动时会弹"必须升级"的强制弹框

## 强制更新策略

```
当前 versionCode = 100
最新 versionCode = 105
minVersionCode = 103
```

→ 用户必须升级到至少 103 才能继续使用。弹框的"取消"按钮变成"退出"，点击后 `plus.runtime.quit()` 关闭应用。

## 常见问题

### Q: 下载失败 / 无法安装

1. 确认 `downloadUrl` 是 **https**（http 会被 Android 9+ 拦截）
2. 确认 APK 没有损坏（md5 比对）
3. 确认签名一致：旧 APK 和新 APK 必须用 **同一个签名**，否则 Android 会拒绝升级安装

### Q: 安装需要权限吗？

Android 8+ 需要"允许此来源安装未知应用"权限。首次安装时系统会弹框让用户授权，之后就不用管。

不需要在 `manifest.json` 里声明，`plus.runtime.install` 会自动处理。

### Q: 要不要做静默安装？

不建议。静默安装需要 root 权限或系统签名，普通应用做不到，硬做就是滥用权限，会被安全软件报警。现在这套"后台下载 + 弹安装界面"是最稳妥的方案。

### Q: 如果用户拒绝安装怎么办？

APK 已经下载到本地 `_doc/update/`，下次用户点"检查更新"时，会重新下载（可以优化为检查本地已有 apk 跳过下载，这是后续优化点）。

## 后续优化方向

- [ ] 管理员后台增加"发版管理"页面，可视化修改版本配置（免去改 JSON）
- [ ] 下载前检查本地是否已有相同版本 APK，避免重复下载
- [ ] 增加断点续传（`plus.downloader.createDownload` 原生支持）
- [ ] iOS 版本接入 App Store 跳转链（不能直接安装 .ipa）
- [ ] 增加 wgt 热更新（只更新资源不换壳，用户无感知，但业务代码改动受限）

## 回滚

如果新版本有严重 bug：

1. 把 `backend/data/app-version.json` 里的 `versionCode` **调小**到上一版（比如从 101 回到 100）
2. 重新部署后端
3. 新启动的客户端就不会再弹"升级"提示
4. 已经升级到 101 的用户，需要引导手动从 CDN 下载旧版 APK 覆盖安装（**提醒：这要求两个版本签名一致**）
