const fs = require('fs');
const path = require('path');
const express = require('express');
const { initDb } = require('./db');
const { createSmsProvider } = require('./sms');
const { scheduleCleanup } = require('./cleanup');
const { sha256, safeEqual, createRateLimiter } = require('./utils');
const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const postRoutes = require('./routes/posts');

function accessToken(env) {
  return sha256(`${env.ACCESS_PASSWORD}:${env.SESSION_SECRET || 'secret'}`);
}

function createApp(options = {}) {
  const env = options.env || process.env;
  const db = options.db || initDb(options.dbPath || env.DB_PATH || 'data/app.db');
  const sms = options.sms || createSmsProvider(env);
  scheduleCleanup(db); // 启动清一次 + 每日定时（interval 已 unref，不阻塞退出）

  const app = express();
  app.disable('x-powered-by');
  // 基础安全响应头（零依赖版 helmet：覆盖 API + 静态页）
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  // 宝塔/nginx 反代场景需开启，否则 req.ip 恒为反代 IP，限流会误伤所有用户
  if (env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.use(express.json({ limit: '128kb' }));

  // /api/auth 整体 IP 限流：防换号刷验证码、刷访客账号（默认 60 次/分钟/IP）
  const authLimiter = createRateLimiter({
    windowMs: 60_000,
    max: Number(env.RATE_LIMIT_MAX || 60)
  });
  app.use('/api/auth', authLimiter);

  const corsOrigins = String(env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && corsOrigins.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Allow-Headers', 'Content-Type, x-access-token');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
      }
      next();
    });
  }

  app.post('/api/auth/access', (req, res) => {
    if (!env.ACCESS_PASSWORD) return res.status(404).json({ error: '未启用访问口令' });
    const password = String(req.body?.password || '');
    if (!safeEqual(password, env.ACCESS_PASSWORD)) {
      return res.status(403).json({ error: '访问口令错误' });
    }
    res.json({ token: accessToken(env) });
  });

  app.use('/api', (req, res, next) => {
    if (!env.ACCESS_PASSWORD) return next();
    const token = req.headers['x-access-token'];
    if (typeof token !== 'string' || !safeEqual(token, accessToken(env))) {
      return res.status(403).json({ error: '需要访问口令' });
    }
    next();
  });

  app.use('/api/auth', authRoutes({ db, sms, env }));
  app.use('/api/me', meRoutes({ db, env }));
  app.use('/api/posts', postRoutes({ db, env }));

  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

  const distDir = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  return { app, db };
}

module.exports = { createApp };
