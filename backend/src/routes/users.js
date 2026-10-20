const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ROLES = ['admin', 'doctor', 'receptionist', 'pharmacist'];

// Everything here is admin-only (FR-1.4)
router.use(requireAuth, requireRole('admin'));

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT user_id, name, username, role, status, created_at FROM users ORDER BY user_id'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load staff accounts.' });
  }
});

// POST /api/users : create a staff account
router.post('/', async (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'Name, username, password and role are all required.' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, username, role, status`,
      [name.trim(), username.trim(), hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
    console.error(err);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

// PATCH /api/users/:id/status : activate or deactivate
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or inactive.' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE users SET status = $1 WHERE user_id = $2 RETURNING user_id, name, username, role, status',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the account.' });
  }
});

// PUT /api/users/:id : admin edits staff name, role, and optional password reset (FR-1.4)
router.put('/:id', async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) return res.status(404).json({ error: 'Account not found.' });

  const { name, role, password } = req.body || {};
  if (!name || !role) {
    return res.status(400).json({ error: 'Name and role are required.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: 'Choose a valid role.' });
  }

  try {
    let query, params;
    if (password && String(password).trim().length > 0) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const hash = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET name = $1, role = $2, password_hash = $3 WHERE user_id = $4 RETURNING user_id, name, username, role, status';
      params = [name.trim(), role, hash, userId];
    } else {
      query = 'UPDATE users SET name = $1, role = $2 WHERE user_id = $3 RETURNING user_id, name, username, role, status';
      params = [name.trim(), role, userId];
    }

    const { rows } = await db.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the account.' });
  }
});

module.exports = router;
