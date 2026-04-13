# 微信云托管后端部署指南

## 1. 准备工作

### 1.1 环境准备
- 微信小程序账号
- 微信云托管服务开通
- MySQL 数据库（可以使用腾讯云数据库或本地数据库）
- Node.js 环境（本地开发用）

### 1.2 配置文件修改
1. **修改 `.env` 文件**
   ```bash
   # 数据库配置
   DB_HOST=your_db_host
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=class_manage_sys
   DB_PORT=3306

   # JWT配置
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=24h

   # 服务器配置
   PORT=3000
   NODE_ENV=production

   # 微信小程序配置
   APPID=your_wechat_appid
   APPSECRET=your_wechat_appsecret
   ```

2. **修改 `package.json`**
   - 确认依赖版本正确

## 2. 数据库初始化

### 2.1 执行数据库初始化脚本
1. 登录 MySQL 数据库
2. 创建数据库：`CREATE DATABASE class_manage_sys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
3. 执行初始化脚本：
   ```bash
   mysql -u username -p class_manage_sys < database_init.sql
   ```

### 2.2 验证数据库
- 确认所有表已创建
- 确认默认数据已插入

## 3. 微信云托管部署

### 3.1 登录微信云托管
1. 进入 [微信云托管控制台](https://cloud.weixin.qq.com/cloudrun)
2. 创建新的服务

### 3.2 部署配置
1. **代码仓库**
   - 选择 `本地代码上传`
   - 上传 `backend` 目录

2. **构建配置**
   - 构建目录：`/`
   - 构建命令：`npm install --production`
   - 启动命令：`node app.js`
   - 端口：`3000`

3. **环境变量**
   在云托管控制台配置环境变量：
   - `DB_HOST`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `JWT_SECRET`
   - `APPID`
   - `APPSECRET`

4. **存储配置**
   - 开启文件存储
   - 配置存储路径：`/app/uploads`

### 3.3 部署服务
1. 点击「部署」按钮
2. 等待部署完成
3. 获取服务访问地址

## 4. 前端配置

### 4.1 修改前端 API 地址
在前端项目中修改 API 基础地址：

```javascript
// api.js 或类似文件
const API_BASE_URL = 'https://your-cloudrun-service-url';

export const api = {
  login: `${API_BASE_URL}/api/auth/login`,
  getNotices: `${API_BASE_URL}/api/notice`,
  // 其他API地址
};
```

### 4.2 配置微信小程序
1. 在小程序管理后台配置服务器域名
   - 添加云托管服务域名到 `request合法域名`
   - 添加云托管服务域名到 `uploadFile合法域名`

2. 配置 AppID 和 AppSecret
   - 在后端 `.env` 文件中配置
   - 在小程序管理后台确认配置

## 5. 测试验证

### 5.1 健康检查
访问 `https://your-cloudrun-service-url/health`
- 应返回：`{"status":"ok","timestamp":"2026-04-09T12:00:00Z"}`

### 5.2 API 测试
使用 Postman 或 curl 测试 API：

1. **登录测试**
   ```bash
   curl -X POST https://your-cloudrun-service-url/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"code": "your_wechat_code", "userInfo": {"nickName": "测试用户", "avatarUrl": "https://example.com/avatar.jpg"}}'
   ```

2. **获取通知测试**
   ```bash
   curl -X GET https://your-cloudrun-service-url/api/notice \
   -H "Authorization: Bearer your_jwt_token"
   ```

## 6. 常见问题

### 6.1 数据库连接失败
- 检查数据库地址、用户名、密码是否正确
- 检查数据库是否允许远程连接
- 检查防火墙设置

### 6.2 微信登录失败
- 检查 AppID 和 AppSecret 是否正确
- 检查小程序代码是否正确获取 code
- 检查网络连接

### 6.3 文件上传失败
- 检查存储配置是否正确
- 检查文件大小是否超过限制
- 检查文件类型是否允许

### 6.4 权限问题
- 检查 JWT 令牌是否有效
- 检查用户角色权限
- 检查中间件配置

## 7. 监控与维护

### 7.1 日志查看
- 在微信云托管控制台查看应用日志
- 配置日志报警

### 7.2 性能监控
- 监控 API 响应时间
- 监控数据库连接数
- 监控服务器资源使用

### 7.3 备份策略
- 定期备份数据库
- 备份重要配置文件
- 备份用户上传的文件

## 8. 扩展功能

### 8.1 添加新功能
1. 创建新的模型文件
2. 创建新的控制器文件
3. 创建新的路由文件
4. 更新数据库初始化脚本

### 8.2 性能优化
- 数据库索引优化
- API 缓存
- 代码优化

## 9. 安全建议

### 9.1 安全配置
- 定期更新依赖包
- 使用 HTTPS
- 配置 CORS 策略
- 防止 SQL 注入

### 9.2 权限管理
- 严格的角色权限控制
- 敏感操作日志记录
- 定期权限审计

## 10. 联系方式

如有问题，请联系技术支持：
- 邮箱：2792715318@qq.com
- 电话：13800138000

---

**部署完成后，请确保：**
1. 所有 API 接口可正常访问
2. 数据库连接正常
3. 前端能正常调用后端 API
4. 微信登录功能正常
5. 文件上传功能正常