const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db/database');
const { jwt: jwtConfig } = require('../config');

const BCRYPT_ROUNDS = 12;

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    jwtConfig.accessSecret,
    { expiresIn: jwtConfig.accessExpires }
  );
}

function signRefreshToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, type: 'refresh' },
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshExpires }
  );
}

function parseDurationMs(value) {
  const match = String(value || '7d').match(/^(\d+)([dhms])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return n * (multipliers[unit] || 86400000);
}

function getRefreshExpiryDate() {
  return new Date(Date.now() + parseDurationMs(jwtConfig.refreshExpires)).toISOString();
}

async function register({ name, email, password }) {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');

  if (!trimmedName || !trimmedEmail || pwd.length < 6) {
    const err = new Error('Name, valid email, and password (min 6 chars) are required.');
    err.status = 400;
    throw err;
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
  if (exists) {
    const err = new Error('Email is already registered.');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
  const user = {
    id: uuid(),
    name: trimmedName,
    email: trimmedEmail,
    password_hash: passwordHash
  };

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash) VALUES (@id, @name, @email, @password_hash)'
  ).run(user);

  return { id: user.id, name: user.name, email: user.email };
}

async function login({ email, password }, userAgent = '') {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(trimmedEmail);
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(pwd, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  return createSession(user, userAgent);
}

function createSession(user, userAgent = '') {
  const sessionId = uuid();
  const refreshToken = signRefreshToken(user, sessionId);
  const refreshHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshExpiryDate();

  db.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, user.id, refreshHash, userAgent.slice(0, 255), expiresAt);

  const accessToken = signAccessToken(user);
  return {
    accessToken,
    refreshToken,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email }
  };
}

function refreshSession(refreshToken, userAgent = '') {
  let payload;
  try {
    payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);
  } catch {
    const err = new Error('Invalid refresh token.');
    err.status = 401;
    throw err;
  }

  if (payload.type !== 'refresh') {
    const err = new Error('Invalid refresh token.');
    err.status = 401;
    throw err;
  }

  const refreshHash = hashRefreshToken(refreshToken);
  const session = db
    .prepare(
      `SELECT s.*, u.name, u.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.refresh_token_hash = ?`
    )
    .get(payload.sid, refreshHash);

  if (!session) {
    const err = new Error('Session not found or revoked.');
    err.status = 401;
    throw err;
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    const err = new Error('Session expired. Please log in again.');
    err.status = 401;
    throw err;
  }

  const user = { id: session.user_id, name: session.name, email: session.email };
  const accessToken = signAccessToken(user);

  return {
    accessToken,
    refreshToken,
    expiresAt: session.expires_at,
    user: { id: user.id, name: user.name, email: user.email }
  };
}

function logout(refreshToken) {
  if (!refreshToken) return;

  try {
    const payload = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(payload.sid);
  } catch {
    const hash = hashRefreshToken(refreshToken);
    db.prepare('DELETE FROM sessions WHERE refresh_token_hash = ?').run(hash);
  }
}

function logoutAll(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function getUserById(id) {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(id);
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  return user;
}

module.exports = {
  register,
  login,
  refreshSession,
  logout,
  logoutAll,
  getUserById
};
