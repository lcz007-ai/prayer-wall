const fs = require('fs');
const path = require('path');
const express = require('express');
const { initDb } = require('./db');
const { createSmsProvider } = require('./sms');
const { sha256, safeEqual } = require('./utils');
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

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));

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
