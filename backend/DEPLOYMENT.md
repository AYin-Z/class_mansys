# 区队管理系统后端部署指南

## 1. 部署架构

```
Internet (HTTPS)
    │
    ▼
Cloudflare Tunnel (cloudflared)
    │
    ▼
Nginx (:8083 反向代理)
    │
    ▼
Express (localhost:3002, systemd 管理)
    │
    ▼
MySQL 8.0 (localhost:3306)
```

- **域名**: `cls.ayinserver.xin`
- **前端**: Vite 构建产物 → `frontend-v3/dist/`，由 Nginx 代理到 Express 静态文件服务
- **后端**: Express 监听 `localhost:3002`，systemd 守护进程
- **数据库**: 本地 MySQL 8.0，数据库名 `class_manage_sys`

## 2. 环境准备

### 2.1 依赖安装

```bash
# Node.js 22+
# MySQL 8.0
# cloudflared (Cloudflare Tunnel)
# nginx
```

### 2.2 项目目录

后端代码位于仓库根目录下的 `backend/`，所有命令从 `backend/` 目录执行。

## 3. 数据库初始化

### 3.1 创建数据库并导入表结构

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS class_manage_sys CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p class_manage_sys < database_init.sql
```

### 3.2 验证

```sql
USE class_manage_sys;
SHOW TABLES;       -- 应显示 31 张表
SELECT * FROM classes;  -- 应显示 6 个默认班级
```

## 4. 后端配置

### 4.1 环境变量 (`backend/.env`)

```bash
# 数据库配置
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=<your_password>
DB_NAME=class_manage_sys
DB_PORT=3306

# JWT 配置
JWT_SECRET=<random_secret>
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=3002
NODE_ENV=production

# 微信小程序配置（如有）
APPID=<wechat_appid>
APPSECRET=<wechat_appsecret>

# 文件上传配置
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=5mb
```

### 4.2 安装依赖

```bash
cd backend
npm install --production
```

## 5. systemd 服务配置

### 5.1 创建服务文件 `/etc/systemd/system/class-mansys.service`

```ini
[Unit]
Description=区队管理系统后端
After=network.target mysql.service

[Service]
Type=simple
User=<deploy_user>
WorkingDirectory=/home/<deploy_user>/Current_Works/class_mansys/backend
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 5.2 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable class-mansys
sudo systemctl start class-mansys
```

## 6. Nginx 配置

配置文件：`nginx-cls.conf`（仓库根目录）

```nginx
server {
    listen 127.0.0.1:8083;
    server_name cls.ayinserver.xin;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;

    # 静态资源（Vite hashed = 长期缓存）
    location /assets/ {
        proxy_pass http://127.0.0.1:3002;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_read_timeout 300s;
        add_header Cache-Control "no-store";
    }

    # 上传文件
    location /uploads/ { proxy_pass http://127.0.0.1:3002; }

    # APK 下载
    location /apk/ { proxy_pass http://127.0.0.1:3002; }

    # 健康检查
    location /health { proxy_pass http://127.0.0.1:3002; }

    # SPA fallback
    location / { proxy_pass http://127.0.0.1:3002; }
}
```

## 7. Cloudflare Tunnel

```bash
cloudflared tunnel create class-mansys
cloudflared tunnel route dns class-mansys cls.ayinserver.xin
cloudflared tunnel run --url http://localhost:8083 class-mansys
```

## 8. 前端构建与部署

### 8.1 构建

```bash
cd frontend-v3
npm install
npm run build
# 产物: frontend-v3/dist/
```

### 8.2 部署

Nginx 将 SPA 请求代理到 Express，Express 的 `app.js` 自动从 `frontend-v3/dist/` 提供静态文件。构建完成后无需额外部署步骤。

## 9. 健康检查

```bash
curl https://cls.ayinserver.xin/health
# 应返回: {"status":"ok","timestamp":"..."}
```

## 10. 常见问题

### 数据库连接失败
- 检查 MySQL 服务是否运行：`sudo systemctl status mysql`
- 验证 `.env` 中的数据库密码
- 确认 `class_manage_sys` 数据库已创建

### 服务 502/504
- 检查 Express 是否运行：`sudo systemctl status class-mansys`
- 查看日志：`journalctl -u class-mansys -f`

### 前端白屏
- 确认 `frontend-v3/dist/` 存在且包含 `index.html`
- 检查 Nginx 是否代理到正确端口

## 11. 备份策略

- **数据库**: `mysqldump -u root -p class_manage_sys > backup_$(date +%Y%m%d).sql`
- **上传文件**: 备份 `backend/uploads/` 目录
- **配置**: 备份 `.env` 和 Nginx 配置

---

_最后更新：2026-06 · 基于本地 systemd + Nginx + CF Tunnel 部署_
