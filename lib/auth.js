// Password hashing (scrypt) and signed session cookies — no extra packages.
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set: logins reset whenever the server restarts.');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored || '').split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}
function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(payload, days = 30) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setCookie(res, name, value, days) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const age = value ? `; Max-Age=${days * 86400}` : '; Max-Age=0';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value || '')}; Path=/; HttpOnly; SameSite=Lax${age}${secure}`);
}

// Simple in-memory limiter for login attempts
const attempts = new Map();
function tooManyAttempts(key, max = 8, windowMs = 15 * 60e3) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  a.push(now); attempts.set(key, a);
  return a.length > max;
}

module.exports = { hashPassword, checkPassword, safeEqual, sign, verify, parseCookies, setCookie, tooManyAttempts };
