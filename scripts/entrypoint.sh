#!/bin/sh
# 启动脚本：确保数据库就绪
# 优先级：持久卷已有库 > 从镜像内置的演示库复制 > 现场跑 seed
# 已有库时绝不覆盖，保护线上数据。

set -e

DB_FILE="${DB_PATH:-/data/app.db}"
BUNDLED="/app/seed-db/app.db"

mkdir -p "$(dirname "$DB_FILE")"

# 重置模式：RESET_DB=true 时强制用镜像内置库覆盖（用于数据损坏/恢复演示数据）
if [ "$RESET_DB" = "true" ] && [ -f "$BUNDLED" ]; then
  echo "[entrypoint] RESET_DB=true，重置为演示数据库..."
  rm -f "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
fi

if [ -f "$DB_FILE" ]; then
  echo "[entrypoint] 已有数据库 ($DB_FILE)，直接启动"
else
  if [ -f "$BUNDLED" ]; then
    echo "[entrypoint] 从镜像复制演示数据库到 $DB_FILE ..."
    cp "$BUNDLED" "$DB_FILE"
    rm -f "$DB_FILE-wal" "$DB_FILE-shm"
    echo "[entrypoint] 演示数据就绪"
  else
    echo "[entrypoint] 镜像内无预置库，运行 npm run seed ..."
    npm run seed
    echo "[entrypoint] seed 完成"
  fi
fi

exec npm start
