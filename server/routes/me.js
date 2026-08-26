const express = require('express');
const { authRequired, publicUser } = require('./auth');

module.exports = function meRoutes({ db }) {
  const router = express.Router();
  router.use(authRequired(db));

  router.patch('/', (req, res) => {
    const body = req.body || {};
    const fields = [];
    const values = [];

    if (typeof body.nickname === 'string') {
      fields.push('nickname = ?');
      values.push(body.nickname.trim().slice(0, 20));
    }
    for (const key of ['province', 'city', 'district']) {
      if (typeof body[key] === 'string') {
        fields.push(`${key} = ?`);
        values.push(body[key].trim().slice(0, 30));
      }
    }
    if (!fields.length) return res.status(400).json({ error: '没有可更新的字段' });

    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    res.json({ user: publicUser(user) });
  });

  return router;
};
