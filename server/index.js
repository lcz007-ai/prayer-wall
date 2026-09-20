require('dotenv').config();
const { createApp } = require('./app');

const app = createApp({ env: process.env }).app;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

// 启动时输出数据库状态（排障用）
try {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH || 'data/app.db';
  const db = new Database(dbPath, { readonly: true });
  const u = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const p = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  db.close();
  console.log(`[startup] DB_PATH=${dbPath} users=${u} posts=${p}`);
} catch (e) {
  console.log(`[startup] DB 检查失败: ${e.message}`);
}

app.listen(port, host, () => {
  console.log(`prayer-wall running at http://${host}:${port}`);
});
