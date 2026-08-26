const crypto = require('crypto');

const PHONE_RE = /^1[3-9]\d{9}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomCode(length = 6) {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

function safeEqual(a, b) {
  const ha = Buffer.from(sha256(a), 'hex');
  const hb = Buffer.from(sha256(b), 'hex');
  return crypto.timingSafeEqual(ha, hb);
}

function parseCookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function setSessionCookie(res, token, env) {
  const crossSite = env.COOKIE_CROSS_SITE === 'true';
  const secure = crossSite || env.COOKIE_SECURE === 'true';
  const sameSite = crossSite ? 'None' : 'Lax';
  res.setHeader(
    'Set-Cookie',
    `sid=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=2592000${secure ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res, env) {
  const crossSite = env.COOKIE_CROSS_SITE === 'true';
  const secure = crossSite || env.COOKIE_SECURE === 'true';
  const sameSite = crossSite ? 'None' : 'Lax';
  res.setHeader('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure ? '; Secure' : ''}`);
}

function sqlTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

module.exports = {
  PHONE_RE,
  sha256,
  randomToken,
  randomCode,
  safeEqual,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  sqlTime
};
