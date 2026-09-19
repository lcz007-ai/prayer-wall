# 守望贴纸墙 —— 生产镜像
# 单容器同时伺服 API 与前端静态产物；SQLite 数据落盘到 /data（需挂持久卷）
FROM node:22-slim

WORKDIR /app

# 先装依赖（含 devDeps：vite 在前端构建时需要）
COPY package.json package-lock.json ./
RUN npm install --include=dev

# 复制源码并构建前端
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/app.db

# 数据目录（挂载持久卷后数据落在此处）
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["npm", "start"]
