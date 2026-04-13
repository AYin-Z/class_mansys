# 使用 Node.js 16 作为基础镜像
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建 uploads 目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "app.js"]