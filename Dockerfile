# 守望贴纸墙 —— 生产镜像
# 单容器同时伺服 API 与前端静态产物；SQLite 数据落盘到 /data（需挂持久卷）
#
# 注意：better-sqlite3 是原生模块，安装时会走 node-gyp 源码编译，
# 需要 python3 / make / g++。这里在构建阶段临时安装，装完依赖后立即清理，
# 避免最终镜像膨胀。

FROM node:22-slim

WORKDIR /app

# 构建期工具链（better-sqlite3 编译需要）
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖（含 devDeps：vite 在前端构建时需要）
COPY package.json package-lock.json ./
RUN npm install --include=dev

# 复制源码并构建前端
COPY . .
RUN npm run build

# 清理编译工具链，减小镜像体积（依赖已编译完成，运行时不再需要）
RUN apt-get purge -y python3 make g++ && apt-get autoremove -y \
    && rm -rf /root/.cache /root/.node-gyp /tmp/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/app.db

# 数据目录（挂载持久卷后数据落在此处）
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["npm", "start"]
