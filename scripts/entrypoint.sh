#!/bin/sh
# 启动脚本：空库时自动填充演示数据
# - 数据库已存在（挂载了持久卷且有数据）→ 直接启动，绝不覆盖
# - 数据库不存在（首次部署/新卷）→ 跑一次 seed 填充演示内容

set -e

DB_FILE="${DB_PATH:-/data/app.db}"

if [ ! -f "$DB_FILE" ]; then
  echo "[entrypoint] 数据库不存在，正在填充演示数据 (npm run seed)..."
  npm run seed
  echo "[entrypoint] 演示数据填充完成"
else
  echo "[entrypoint] 已有数据库 ($DB_FILE)，跳过 seed"
fi

exec npm start
