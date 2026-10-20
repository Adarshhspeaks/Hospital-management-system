const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Helper to validate medicine input data
function validateMedicine(body = {}) {
  const name = String(body.name || '').trim();
  const quantity = Number(body.quantity);
  const price = Number(body.price);
  const threshold = body.threshold !== undefined && body.threshold !== '' ? Number(body.threshold) : 10;
  const expiryDate = body.expiry_date ? String(body.expiry_date).trim() : null;

  if (!name) {
    return { error: 'Medicine name is required.' };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: 'Quantity must be 0 or a positive whole number.' };
  }
  if (isNaN(price) || price < 0) {
    return { error: 'Price must be 0 or a positive number.' };
  }
  if (!Number.isInteger(threshold) || threshold < 0) {
    return { error: 'Low-stock threshold must be 0 or a positive whole number.' };
  }
  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    return { error: 'Expiry date must be in YYYY-MM-DD format.' };
  }

  return {
    data: {
      name,
      quantity,
      price,
      threshold,
      expiry_date: expiryDate,
    },
  };
}

// GET /api/medicines/alerts : count of low stock, near expiry, and expired medicines
router.get('/alerts', async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(CASE WHEN quantity <= threshold THEN 1 END)::int AS low_stock,
         COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= $1::date THEN 1 END)::int AS expired,
         COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date > $1::date AND expiry_date <= ($1::date + INTERVAL '30 days') THEN 1 END)::int AS near_expiry
       FROM medicines`,
      [today]
    );
    res.json(rows[0] || { total: 0, low_stock: 0, expired: 0, near_expiry: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load medicine stock alerts.' });
  }
});

// GET /api/medicines : list medicines with stock and expiry flags (accessible to doctor, pharmacist, admin, receptionist)
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = String(req.query.status || '').trim(); // 'low_stock', 'near_expiry', 'expired'
  const today = new Date().toISOString().slice(0, 10);

  try {
    let query = `
      SELECT medicine_id, name, quantity, price, expiry_date, threshold,
             (quantity <= threshold) AS is_low_stock,
             (expiry_date IS NOT NULL AND expiry_date <= $1::date) AS is_expired,
             (expiry_date IS NOT NULL AND expiry_date > $1::date AND expiry_date <= ($1::date + INTERVAL '30 days')) AS is_near_expiry
      FROM medicines
      WHERE 1=1
    `;
    const params = [today];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND name ILIKE $${params.length}`;
    }

    if (filter === 'low_stock') {
      query += ` AND quantity <= threshold`;
    } else if (filter === 'expired') {
      query += ` AND expiry_date IS NOT NULL AND expiry_date <= $1::date`;
    } else if (filter === 'near_expiry') {
      query += ` AND expiry_date IS NOT NULL AND expiry_date > $1::date AND expiry_date <= ($1::date + INTERVAL '30 days')`;
    }

    query += ' ORDER BY name ASC';

    const { rows } = await db.query(query, params);
    res.json(rows.map((r) => ({
      ...r,
      price: Number(r.price),
      quantity: Number(r.quantity),
      threshold: Number(r.threshold),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load medicines.' });
  }
});

// GET /api/medicines/:id : get single medicine details
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Medicine not found.' });

  const today = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await db.query(
      `SELECT medicine_id, name, quantity, price, expiry_date, threshold,
              (quantity <= threshold) AS is_low_stock,
              (expiry_date IS NOT NULL AND expiry_date <= $1::date) AS is_expired,
              (expiry_date IS NOT NULL AND expiry_date > $1::date AND expiry_date <= ($1::date + INTERVAL '30 days')) AS is_near_expiry
       FROM medicines
       WHERE medicine_id = $2`,
      [today, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Medicine not found.' });

    res.json({
      ...rows[0],
      price: Number(rows[0].price),
      quantity: Number(rows[0].quantity),
      threshold: Number(rows[0].threshold),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load medicine.' });
  }
});

// POST /api/medicines : pharmacist adds a new medicine (FR-7.1)
router.post('/', requireRole('pharmacist'), async (req, res) => {
  const { error, data } = validateMedicine(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const { rows } = await db.query(
      `INSERT INTO medicines (name, quantity, price, expiry_date, threshold)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.quantity, data.price, data.expiry_date, data.threshold]
    );

    res.status(201).json({
      ...rows[0],
      price: Number(rows[0].price),
      quantity: Number(rows[0].quantity),
      threshold: Number(rows[0].threshold),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add medicine.' });
  }
});

// PUT /api/medicines/:id : pharmacist edits a medicine (FR-7.1)
router.put('/:id', requireRole('pharmacist'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Medicine not found.' });

  const { error, data } = validateMedicine(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const { rows } = await db.query(
      `UPDATE medicines
       SET name = $1, quantity = $2, price = $3, expiry_date = $4, threshold = $5
       WHERE medicine_id = $6
       RETURNING *`,
      [data.name, data.quantity, data.price, data.expiry_date, data.threshold, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Medicine not found.' });

    res.json({
      ...rows[0],
      price: Number(rows[0].price),
      quantity: Number(rows[0].quantity),
      threshold: Number(rows[0].threshold),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update medicine.' });
  }
});

// DELETE /api/medicines/:id : pharmacist deletes a medicine
// Block deletion if referenced in prescription_items (FR-7.1)
router.delete('/:id', requireRole('pharmacist'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Medicine not found.' });

  try {
    const existing = await db.query('SELECT name FROM medicines WHERE medicine_id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Medicine not found.' });

    // Check if referenced in prescription_items
    const refCheck = await db.query('SELECT 1 FROM prescription_items WHERE medicine_id = $1 LIMIT 1', [id]);
    if (refCheck.rows.length > 0) {
      return res.status(400).json({
        error: `Cannot delete "${existing.rows[0].name}" because it is referenced in past prescriptions. You can set its stock quantity to 0 instead.`,
      });
    }

    await db.query('DELETE FROM medicines WHERE medicine_id = $1', [id]);
    res.json({ message: `"${existing.rows[0].name}" has been removed from inventory.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete medicine.' });
  }
});

module.exports = router;
