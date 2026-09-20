const fs = require('fs');
const path = require('path');
const { initDb } = require('../server/db');

const root = path.resolve(__dirname, '..');
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(root, 'data', 'app.db');
const seedPath = path.join(root, 'seed', 'prayer-posts.json');
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

const db = initDb(dbPath);
const phones = seed.posts.map((_, i) => `139${String(10000000 + i).slice(-8)}`);
const existing = [];
for (let i = 0; i < phones.length; i += 400) {
  const chunk = phones.slice(i, i + 400);
  const placeholders = chunk.map(() => '?').join(',');
  existing.push(
    ...db.prepare(`SELECT phone, id FROM users WHERE phone IN (${placeholders})`).all(...chunk)
  );
}

for (const user of existing) {
  db.prepare('DELETE FROM prayers WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)').run(user.id);
  db.prepare('DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)').run(user.id);
  db.prepare('DELETE FROM posts WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
}

const insertUser = db.prepare(
  `INSERT INTO users (phone, nickname, province, city, district, role)
   VALUES (?, ?, ?, ?, ?, 'user')`
);
const insertPost = db.prepare(
  `INSERT INTO posts (user_id, content, nickname, province, city, district, pray_count, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
);
const insertTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)');

const counts = {};
seed.posts.forEach((item, i) => {
  const phone = phones[i];
  const userInfo = insertUser.run(phone, item.nickname || '', item.province, item.city, item.district || '');
  const postInfo = insertPost.run(
    userInfo.lastInsertRowid,
    item.content,
    item.nickname || '',
    item.province,
    item.city,
    item.district || '',
    item.prayCount || 0,
    `-${item.createdDaysAgo || 0} days`
  );
  for (const tag of item.tags) {
    insertTag.run(postInfo.lastInsertRowid, tag);
    counts[tag] = (counts[tag] || 0) + 1;
  }
});

console.log(`已导入 ${seed.posts.length} 条祷告事项：`);
for (const tag of Object.keys(counts)) console.log(`  ${tag}: ${counts[tag]} 条`);
// 强制将 WAL 中的数据合入主库并截断，确保后续进程/网络文件系统上立即可见
try {
  db.pragma('wal_checkpoint(TRUNCATE)');
} catch {}
db.close();
