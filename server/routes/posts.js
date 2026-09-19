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
    status: row.status || 'open',
    prayCount: row.pray_count,
    prayed: !!row.prayed,
    saved: !!row.saved,
    commentCount: row.comment_count || 0,
    mine: row.user_id === userId,
    createdAt: row.created_at
  };
}

function memberOnly(req, res, next) {
  if (req.user.role === 'guest') {
    return res.status(403).json({ error: '访客只能浏览，请先用手机号登录' });
  }
  return next();
}

module.exports = function postRoutes({ db }) {
  const router = express.Router();
  router.use(authRequired(db));

  router.get('/', (req, res) => {
    const rawScope = String(req.query.scope || 'same-city');
    const scope = ['same-city', 'all', 'saved', 'mine'].includes(rawScope) ? rawScope : 'same-city';
    if (scope === 'same-city' && !req.user.city) {
      return res.json({ posts: [], needsRegion: true });
    }
    const tag = String(req.query.tag || '').trim();
    if (tag && !ALLOWED_TAGS.includes(tag)) {
      return res.status(400).json({ error: '无效的标签' });
    }
    const query = String(req.query.q || '').trim().slice(0, 50);
    // 游标分页：before = 上一页最后一条的 id；limit 默认 30，上限 50
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(Math.trunc(limitRaw), 50) : 30;
    const beforeRaw = Number(req.query.before);
    const before = Number.isInteger(beforeRaw) && beforeRaw > 0 ? beforeRaw : null;

    let sql = `
      SELECT posts.*, EXISTS(
        SELECT 1 FROM prayers p WHERE p.post_id = posts.id AND p.user_id = ?
      ) AS prayed
      , EXISTS(
        SELECT 1 FROM post_saves s WHERE s.post_id = posts.id AND s.user_id = ?
      ) AS saved
      , (
        SELECT COUNT(*) FROM post_comments c WHERE c.post_id = posts.id
      ) AS comment_count
      FROM posts
    `;
    let params = [req.user.id, req.user.id];
    if (scope === 'saved') {
      sql += ` WHERE EXISTS(SELECT 1 FROM post_saves s WHERE s.post_id = posts.id AND s.user_id = ?)`;
      params.push(req.user.id);
    } else if (scope === 'mine') {
      sql += ` WHERE posts.user_id = ?`;
      params.push(req.user.id);
    } else {
      sql += ` WHERE created_at >= datetime('now', '-30 days')`;
      if (scope === 'same-city') {
        sql += ` AND posts.province = ? AND posts.city = ?`;
        params.push(req.user.province, req.user.city);
      }
    }
    if (before) {
      sql += ` AND posts.id < ?`;
      params.push(before);
    }
    if (query) {
      const keyword = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
      sql += ` AND (posts.content LIKE ? ESCAPE '\\' OR posts.nickname LIKE ? ESCAPE '\\')`;
      params.push(keyword, keyword);
    }
    if (tag) {
      sql += ` AND EXISTS(SELECT 1 FROM post_tags pt WHERE pt.post_id = posts.id AND pt.tag = ?)`;
      params.push(tag);
    }
    sql += ` ORDER BY posts.created_at DESC, posts.id DESC LIMIT ?`;
    params.push(limit);
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
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      needsRegion: false
    });
  });

  router.post('/', memberOnly, (req, res) => {
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

    const created = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO posts (user_id, content, nickname, province, city, district)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, content, nickname, province, city, district);
      for (const tag of tags) {
        db.prepare(`INSERT INTO post_tags (post_id, tag) VALUES (?, ?)`).run(info.lastInsertRowid, tag);
      }
      return info.lastInsertRowid;
    });
    const postId = created();
    const row = db.prepare(`SELECT posts.*, 0 AS prayed FROM posts WHERE id = ?`).get(postId);
    res.status(201).json({ post: postRow({ ...row, saved: 0, comment_count: 0 }, req.user.id, tags) });
  });

  router.delete('/:id', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: '代祷需求不存在' });
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '没有权限删除这条代祷需求' });
    }
    db.transaction((id) => {
      db.prepare(`DELETE FROM prayers WHERE post_id = ?`).run(id);
      db.prepare(`DELETE FROM post_tags WHERE post_id = ?`).run(id);
      db.prepare(`DELETE FROM post_comments WHERE post_id = ?`).run(id);
      db.prepare(`DELETE FROM post_saves WHERE post_id = ?`).run(id);
      db.prepare(`DELETE FROM posts WHERE id = ?`).run(id);
    })(id);
    res.json({ ok: true });
  });

  router.post('/:id/pray', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const row = db
      .prepare(
        `SELECT *, created_at >= datetime('now', '-30 days') AS active FROM posts WHERE id = ?`
      )
      .get(id);
    if (!row) return res.status(404).json({ error: '代祷需求不存在' });
    if (!row.active) return res.status(410).json({ error: '该代祷需求已归档' });
    if (row.user_id === req.user.id) {
      return res.status(400).json({ error: '不能为自己的代祷需求祷告' });
    }
    // INSERT OR IGNORE 保证幂等（UNIQUE(post_id, user_id)），计数与插入同事务，防中途崩溃导致计数不同步
    const already = db.transaction(() => {
      const info = db.prepare(`INSERT OR IGNORE INTO prayers (post_id, user_id) VALUES (?, ?)`).run(id, req.user.id);
      const dup = info.changes === 0;
      if (!dup) {
        db.prepare(`UPDATE posts SET pray_count = pray_count + 1 WHERE id = ?`).run(id);
      }
      return dup;
    })();
    const post = db.prepare(`SELECT pray_count FROM posts WHERE id = ?`).get(id);
    res.json({ ok: true, already, prayCount: post.pray_count });
  });

  router.post('/:id/answer', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: '代祷需求不存在' });
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有发布人可以标记蒙应允状态' });
    }
    const status = String(req.body?.status || '');
    if (!['open', 'answered'].includes(status)) {
      return res.status(400).json({ error: '无效的状态' });
    }
    db.prepare(`UPDATE posts SET status = ? WHERE id = ?`).run(status, id);
    res.json({ ok: true, status });
  });

  router.get('/:id/comments', (req, res) => {
    const id = Number(req.params.id);
    const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!post) return res.status(404).json({ error: '代祷需求不存在' });
    const rows = db
      .prepare(`SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC, id ASC`)
      .all(id);
    const comments = rows.map((row) => ({
      id: row.id,
      content: row.content,
      nickname: row.nickname || '匿名',
      mine: row.user_id === req.user.id,
      canDelete: row.user_id === req.user.id || post.user_id === req.user.id || req.user.role === 'admin',
      createdAt: row.created_at
    }));
    res.json({ comments });
  });

  router.post('/:id/comments', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!post) return res.status(404).json({ error: '代祷需求不存在' });
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: '请写下回应内容' });
    if (content.length > 200) return res.status(400).json({ error: '回应内容不能超过 200 字' });
    const nickname = String(req.body?.nickname || '').trim().slice(0, 20) || req.user.nickname;
    db.prepare(
      `INSERT INTO post_comments (post_id, user_id, content, nickname) VALUES (?, ?, ?, ?)`
    ).run(id, req.user.id, content, nickname);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?`).get(id).c;
    res.status(201).json({ ok: true, commentCount: count });
  });

  router.delete('/:id/comments/:commentId', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    const comment = db.prepare(`SELECT * FROM post_comments WHERE id = ? AND post_id = ?`).get(commentId, id);
    if (!post || !comment) return res.status(404).json({ error: '回应不存在' });
    const allowed = comment.user_id === req.user.id || post.user_id === req.user.id || req.user.role === 'admin';
    if (!allowed) return res.status(403).json({ error: '没有权限删除这条回应' });
    db.prepare(`DELETE FROM post_comments WHERE id = ?`).run(commentId);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM post_comments WHERE post_id = ?`).get(id).c;
    res.json({ ok: true, commentCount: count });
  });

  router.post('/:id/save', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    if (!post) return res.status(404).json({ error: '代祷需求不存在' });
    db.prepare(`INSERT OR IGNORE INTO post_saves (post_id, user_id) VALUES (?, ?)`).run(id, req.user.id);
    res.json({ ok: true, saved: true });
  });

  router.delete('/:id/save', memberOnly, (req, res) => {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM post_saves WHERE post_id = ? AND user_id = ?`).run(id, req.user.id);
    res.json({ ok: true, saved: false });
  });

  return router;
};
