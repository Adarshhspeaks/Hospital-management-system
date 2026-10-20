const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for login: 10 attempts per 15 minutes per IP (Correction 4)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.headers['x-test-ip'] || req.ip,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// POST /api/auth/login  (FR-1.1)
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Enter your username and password.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const user = rows[0];

    // Same message for unknown user and wrong password, so usernames cannot be guessed
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'Username or password is incorrect.' });
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account is deactivated. Contact the admin.' });
    }

    const payload = { id: user.user_id, role: user.role, name: user.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h', // FR-1.5: sessions end after a set time
    });

    res.json({ token, user: { id: user.user_id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
  }
});

// GET /api/auth/me : who am I (used to restore the session on page refresh)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT user_id, name, username, role, status FROM users WHERE user_id = $1',
      [req.user.id]
    );
    const u = rows[0];
    if (!u || u.status !== 'active') return res.status(401).json({ error: 'Account not available.' });
    res.json({ user: { id: u.user_id, name: u.name, username: u.username, role: u.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' });
  }
});

module.exports = router;
