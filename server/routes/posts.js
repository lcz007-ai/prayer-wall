const express = require('express');
const { authRequired } = require('./auth');
const { ALLOWED_TAGS } = require('../tags');

function postRow(row, userId, tags = []) {
  return {
    id: row.id,
    content: row.content,
    nickname: row.nickname || '匿名',
    province: row.province,
    city: row.city,
    district: row.district,
    tags,
    prayCount: row.pray_count,
    prayed: !!row.prayed,
    mine: row.user_id === userId,
    createdAt: row.created_at
  };
}

module.exports = function postRoutes({ db }) {
  const router = express.Router();
  router.use(authRequired(db));

  router.get('/', (req, res) => {
    const scope = req.query.scope === 'all' ? 'all' : 'same-city';
    if (scope === 'same-city' && !req.user.city) {
      return res.json({ posts: [], needsRegion: true });
    }
    const tag = String(req.query.tag || '').trim();
    if (tag && !ALLOWED_TAGS.includes(tag)) {
      return res.status(400).json({ error: '无效的标签' });
    }

    let sql = `
      SELECT posts.*, EXISTS(
        SELECT 1 FROM prayers p WHERE p.post_id = posts.id AND p.user_id = ?
      ) AS prayed
      FROM posts
      WHERE created_at >= datetime('now', '-30 days')
    `;
    const params = [req.user.id];
    if (scope === 'same-city') {
      sql += ` AND posts.province = ? AND posts.city = ?`;
      params.push(req.user.province, req.user.city);
    }
    if (tag) {
      sql += ` AND EXISTS(SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id AND pt.tag = ?)`;
      params.push(tag);
    }
    sql += ` ORDER BY posts.created_at DESC, posts.id DESC`;
    const rows = db.prepare(sql).all(...params);
    const tagsByPost = {};
    if (rows.length) {
      const placeholders = rows.map(() => '?').join(',');
      const tagRows = db
        .prepare(`SELECT post_id, tag FROM post_tags WHERE post_id IN (${placeholders}) ORDER BY id`)
        .all(...rows.map((r) => r.id));
      for (const t of tagRows) {
        (tagsByPost[t.post_id] ||= []).push(t.tag);
      }
    }
    res.json({
      posts: rows.map((r) => postRow(r, req.user.id, tagsByPost[r.id] || [])),
      needsRegion: false
    });
  });

  router.post('/', (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: '请写下代祷内容' });
    if (content.length > 500) return res.status(400).json({ error: '代祷内容不能超过 500 字' });

    const nickname = String(req.body?.nickname || '').trim().slice(0, 20) || req.user.nickname;
    const province = String(req.body?.province || req.user.province || '').trim();
    const city = String(req.body?.city || req.user.city || '').trim();
    const district = String(req.body?.district || req.user.district || '').trim();
    if (!province || !city) return res.status(400).json({ error: '请先选择所在地区' });

    const rawTags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const tags = [...new Set(rawTags.map((t) => String(t).trim()).filter(Boolean))];
    if (tags.some((t) => !ALLOWED_TAGS.includes(t))) {
      return res.status(400).json({ error: '包含无效的标签' });
    }
    if (tags.length > 3) return res.status(400).json({ error: '最多选择 3 个标签' });

    const info = db
      .prepare(
        `INSERT INTO posts (user_id, content, nickname, province, city, district)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, content, nickname, province, city, district);
    for (const tag of tags) {
      db.prepare(`INSERT INTO post_tags (post_id, tag) VALUES (?, ?)`).run(info.lastInsertRowid, tag);
    }
    const row = db.prepare(`SELECT posts.*, 0 AS prayed FROM posts WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ post: postRow(row, req.user.id, tags) });
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: '代祷需求不存在' });
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '没有权限删除这条代祷需求' });
    }
    db.prepare(`DELETE FROM prayers WHERE post_id = ?`).run(id);
    db.prepare(`DELETE FROM post_tags WHERE post_id = ?`).run(id);
    db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
    res.json({ ok: true });
  });

  router.post('/:id/pray', (req, res) => {
    const id = Number(req.params.id);
    const row = db
      .prepare(`SELECT * FROM posts WHERE id = ? AND created_at >= datetime('now', '-30 days')`)
      .get(id);
    if (!row) return res.status(404).json({ error: '代祷需求不存在' });
    if (row.user_id === req.user.id) {
      return res.status(400).json({ error: '不能为自己的代祷需求祷告' });
    }
    const info = db.prepare(`INSERT OR IGNORE INTO prayers (post_id, user_id) VALUES (?, ?)`).run(id, req.user.id);
    const already = info.changes === 0;
    if (!already) {
      db.prepare(`UPDATE posts SET pray_count = pray_count + 1 WHERE id = ?`).run(id);
    }
    const post = db.prepare(`SELECT pray_count FROM posts WHERE id = ?`).get(id);
    res.json({ ok: true, already, prayCount: post.pray_count });
  });

  return router;
};
