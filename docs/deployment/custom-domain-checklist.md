# 自定义域名绑定 Checklist（小程序正式发版专用）

微信小程序审核/发布时，**不接受** `*.sh.run.tcloudbase.com` 这类平台共享测试域名。必须使用你自己备案、绑到 CloudRun 服务上的**自定义 HTTPS 域名**，同时把该域名加进小程序的服务器域名白名单。

下面按顺序打勾即可。

---

## 阶段 A · 域名备案与解析

> 备案在整个流程里最慢，至少预留 **3 – 20 个工作日**，其余步骤都很快。

- [ ] 名下有一个待用的顶级域名（示例：`yinzheng.top`）
- [ ] 已通过 **腾讯云备案中心**（或其他备案服务商）完成 ICP 备案，
      主体与阿里云 / 腾讯云账号一致
- [ ] 规划好二级域名（示例：`api.yinzheng.top`），预留给本服务
- [ ] DNS 解析已指向腾讯云：在腾讯云 DNSPod 管理该域名，或将 NS 切到 DNSPod
- [ ] **暂不要**自己在 DNSPod 里添加 A/CNAME 记录 —— 让 CloudBase
      在下一步自动写解析，避免记录冲突

## 阶段 B · CloudRun 绑定自定义域名

- [ ] 登录 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
      → 选择环境 `clamansys-xxxxxxxx`
- [ ] 左侧菜单：`云托管 → 服务列表 → class-manage-sys`
- [ ] 顶部标签：`访问服务 → 自定义域名 → 添加域名`
- [ ] 填写 `api.yinzheng.top`（保持 `https://` 开头，**不带路径、不带端口**）
- [ ] 证书选择：
  - [ ] 平台免费证书（推荐，Let's Encrypt，CloudBase 自动续期）
  - [ ] 或自备 SSL 证书上传 `.pem` + `.key`
- [ ] 等待状态变为 `已生效`（1–5 分钟，有 DNS 缓存会久一点）
- [ ] 在浏览器访问 `https://api.yinzheng.top/health` 应返回
      `{"status":"ok","timestamp":"..."}`（`backend/app.js` 里的健康检查接口）

## 阶段 C · 后端 CORS & 允许来源

在 `backend/app.js` 的 CORS `allowedOrigins` 数组里加上新域名：

- [ ] `http://localhost:5173`（Vite 开发）
- [ ] `https://api.yinzheng.top`（后端自身；少数请求会自我回源时用到）
- [ ] 小程序官方不走浏览器 CORS，不需要登记，但自定义域名和 Web 管理台都要有
- [ ] 部署更新后的后端镜像（CloudBase CLI 或控制台一键重新部署）

## 阶段 D · 前端环境变量切换

项目现在 **完全由 `VITE_API_BASE_URL` 驱动**，不再有硬编码 fallback。

- [ ] 编辑 `.env.production`，把
      `VITE_API_BASE_URL=https://class-manage-sys-247928-5-1420593393.sh.run.tcloudbase.com`
      改成
      `VITE_API_BASE_URL=https://api.yinzheng.top`
- [ ] `.env.development` 可以维持用 tcloudbase 测试域名，也可以同步切成自定义域名
- [ ] 本机构建一次验证：
      ```bash
      npm run build:mp-weixin
      ```
      产物里 `request.js` 搜一下应已不含 `tcloudbase.com`

## 阶段 E · 微信公众平台服务器域名白名单

- [ ] 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
      → 小程序对应 AppID 登录
- [ ] 侧栏：`开发管理 → 开发设置 → 服务器域名`
- [ ] 完成「身份验证」步骤（扫码 / 短信）
- [ ] `request合法域名`：填 `https://api.yinzheng.top`
      - 不要带尾部 `/`
      - 不要带分号（除非你在填多条）
- [ ] 如果后端涉及文件 / 图片上传：`uploadFile合法域名` 同步填一份
- [ ] 如果有 WebSocket：`socket合法域名` 填 `wss://api.yinzheng.top`
- [ ] 点 `保存并提交` —— 一天最多改 5 次，30 分钟内全量生效

## 阶段 F · 小程序上传与提交审核

- [ ] 微信开发者工具打开项目 → `上传版本`
- [ ] 在 `体验版` / `开发版` 里先用真机验证：注册 / 请假 / 成员管理等核心流走一遍
- [ ] 确认控制台无 `url not in domain list` 报错
- [ ] `版本管理 → 提交审核`，审核通过后「发布」

---

## 常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 真机报 `url not in domain list` | 当前小程序 request 合法域名里没有后端域名；或刚保存还在生效中 | 阶段 E 重新配置、等 30 分钟 |
| 红字「云托管域名仅供测试使用」 | 填的是 `*.sh.run.tcloudbase.com` | 必须换阶段 B 得到的自定义域名 |
| 自定义域名证书一直 `签发中` | 解析记录没生效 / 域名未备案 / 域名归属校验失败 | 回阶段 A，用 `dig api.yinzheng.top` 看 DNS 是否指向 CloudBase |
| 换了域名后接口 CORS 报错 | `backend/app.js` allowedOrigins 没同步加 | 阶段 C，重新部署 |
| 小程序发布后偶尔失败 | 多端都连了测试域名，tcloudbase 的 `sh.run` 区域被限流 | 彻底换到自定义域名 |

## 一句话总结

> 自定义域名做完阶段 B 之后，**代码里不需要再改任何东西**，只要在
> `.env.production` 里把 `VITE_API_BASE_URL` 换成新域名并重新构建发布即可。
