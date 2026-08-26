const express = require('express');
const {
  PHONE_RE,
  sha256,
  randomCode,
  randomToken,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  sqlTime
} = require('../utils');

const SESSION_DAYS = 30;
const codeStore = new Map();

function checkSendRate(phone) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (!codeStore.has(phone) || codeStore.get(phone).day !== today) {
    codeStore.set(phone, { day: today, count: 0, lastSentAt: 0 });
  }
  const rec = codeStore.get(phone);
  if (now - rec.lastSentAt < 60 * 1000) {
    return { error: '请 60 秒后再发送', status: 429 };
  }
  if (rec.count >= 10) {
    return { error: '今日发送次数已达上限', status: 429 };
  }
  return null;
}

function authRequired(db) {
  return (req, res, next) => {
    const token = parseCookies(req).sid;
    if (!token) return res.status(401).json({ error: '请先登录' });
    const row = db
      .prepare(
        `SELECT u.id AS id, u.phone, u.nickname, u.province, u.city, u.district, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > datetime('now')`
      )
      .get(token);
    if (!row) return res.status(401).json({ error: '登录已过期，请重新登录' });
    req.user = row;
    next();
  };
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    province: user.province,
    city: user.city,
    district: user.district,
    role: user.role
  };
}

module.exports = function authRoutes({ db, sms, env }) {
  const router = express.Router();

  router.post('/send-code', async (req, res, next) => {
    try {
      const phone = String(req.body?.phone || '');
      if (!PHONE_RE.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' });
      const rate = checkSendRate(phone);
      if (rate) return res.status(rate.status).json({ error: rate.error });

      const code = randomCode();
      const expiresAt = sqlTime(new Date(Date.now() + 5 * 60 * 1000));
      db.prepare(
        `DELETE FROM verification_codes WHERE consumed_at IS NOT NULL OR expires_at < datetime('now')`
      ).run();
      db.prepare(`INSERT INTO verification_codes (phone, code_hash, expires_at) VALUES (?, ?, ?)`).run(
        phone,
        sha256(code),
        expiresAt
      );

      const rec = codeStore.get(phone);
      rec.count += 1;
      rec.lastSentAt = Date.now();

      const result = await sms.send(phone, code);
      res.json({ ok: true, ...(result.devCode ? { devCode: result.devCode } : {}) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', (req, res) => {
    const phone = String(req.body?.phone || '');
    const code = String(req.body?.code || '').trim();
    if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '请输入正确的手机号和验证码' });
    }

    const row = db
      .prepare(
        `SELECT id, code_hash FROM verification_codes
         WHERE phone = ? AND consumed_at IS NULL AND expires_at > datetime('now')
         ORDER BY id DESC LIMIT 1`
      )
      .get(phone);
    if (!row || row.code_hash !== sha256(code)) {
      return res.status(401).json({ error: '验证码错误或已过期' });
    }
    db.prepare(`UPDATE verification_codes SET consumed_at = datetime('now') WHERE id = ?`).run(row.id);

    let user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
    const admins = String(env.ADMIN_PHONES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const role = admins.includes(phone) ? 'admin' : user?.role === 'admin' ? 'admin' : 'user';
    if (!user) {
      const info = db.prepare(`INSERT INTO users (phone, role) VALUES (?, ?)`).run(phone, role);
      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    } else if (user.role !== role) {
      db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, user.id);
      user.role = role;
    }

    const token = randomToken();
    const expiresAt = sqlTime(new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000));
    db.prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`).run(
      user.id,
      token,
      expiresAt
    );
    setSessionCookie(res, token, env);
    res.json({ user: publicUser(user) });
  });

  router.get('/me', authRequired(db), (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  router.post('/logout', authRequired(db), (req, res) => {
    const token = parseCookies(req).sid;
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    clearSessionCookie(res, env);
    res.json({ ok: true });
  });

  return router;
};

module.exports.authRequired = authRequired;
module.exports.publicUser = publicUser;
