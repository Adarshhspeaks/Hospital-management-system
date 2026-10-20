const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/prescriptions : list prescriptions with items and available medicine stock (FR-7.2)
// Accessible to pharmacist and admin
router.get('/', requireRole('pharmacist', 'admin'), async (req, res) => {
  const status = String(req.query.status || '').trim(); // 'pending', 'dispensed', or all
  const q = String(req.query.q || '').trim();

  try {
    let query = `
      SELECT pr.prescription_id, pr.record_id, pr.dispensed,
             a.appointment_id, a.date, a.time_slot,
             p.patient_id, p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender,
             u.name AS doctor_name, d.specialization AS doctor_specialization
      FROM prescriptions pr
      JOIN medical_records m ON m.record_id = pr.record_id
      JOIN appointments a ON a.appointment_id = m.appointment_id
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status === 'pending') {
      query += ' AND pr.dispensed = FALSE';
    } else if (status === 'dispensed') {
      query += ' AND pr.dispensed = TRUE';
    }

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.phone LIKE $${params.length})`;
    }

    query += ' ORDER BY pr.dispensed ASC, a.date DESC, pr.prescription_id DESC';

    const { rows: prescriptions } = await db.query(query, params);

    if (prescriptions.length === 0) {
      return res.json([]);
    }

    const presIds = prescriptions.map((p) => p.prescription_id);

    // Fetch items with current medicine stock
    const { rows: items } = await db.query(
      `SELECT pi.item_id, pi.prescription_id, pi.medicine_id, pi.dosage, pi.duration, pi.quantity AS prescribed_quantity,
              med.name AS medicine_name, med.quantity AS available_stock, med.price AS unit_price
       FROM prescription_items pi
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE pi.prescription_id = ANY($1::int[])
       ORDER BY pi.item_id ASC`,
      [presIds]
    );

    const itemsMap = items.reduce((acc, it) => {
      if (!acc[it.prescription_id]) acc[it.prescription_id] = [];
      const prescribed = Number(it.prescribed_quantity);
      const available = Number(it.available_stock);
      acc[it.prescription_id].push({
        ...it,
        prescribed_quantity: prescribed,
        available_stock: available,
        unit_price: Number(it.unit_price),
        has_sufficient_stock: available >= prescribed,
      });
      return acc;
    }, {});

    const result = prescriptions.map((pr) => {
      const prItems = itemsMap[pr.prescription_id] || [];
      const canDispense = !pr.dispensed && prItems.length > 0 && prItems.every((it) => it.has_sufficient_stock);
      return {
        ...pr,
        items: prItems,
        can_dispense: canDispense,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load prescriptions.' });
  }
});

// GET /api/prescriptions/:id : single prescription with items and stock
router.get('/:id', requireRole('pharmacist', 'admin', 'doctor'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Prescription not found.' });

  try {
    const { rows: prescriptions } = await db.query(
      `SELECT pr.prescription_id, pr.record_id, pr.dispensed,
              a.appointment_id, a.date, a.time_slot,
              p.patient_id, p.name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM prescriptions pr
       JOIN medical_records m ON m.record_id = pr.record_id
       JOIN appointments a ON a.appointment_id = m.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       WHERE pr.prescription_id = $1`,
      [id]
    );

    if (!prescriptions[0]) return res.status(404).json({ error: 'Prescription not found.' });

    const { rows: items } = await db.query(
      `SELECT pi.item_id, pi.prescription_id, pi.medicine_id, pi.dosage, pi.duration, pi.quantity AS prescribed_quantity,
              med.name AS medicine_name, med.quantity AS available_stock, med.price AS unit_price
       FROM prescription_items pi
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE pi.prescription_id = $1
       ORDER BY pi.item_id ASC`,
      [id]
    );

    const formattedItems = items.map((it) => ({
      ...it,
      prescribed_quantity: Number(it.prescribed_quantity),
      available_stock: Number(it.available_stock),
      unit_price: Number(it.unit_price),
      has_sufficient_stock: Number(it.available_stock) >= Number(it.prescribed_quantity),
    }));

    res.json({
      ...prescriptions[0],
      items: formattedItems,
      can_dispense: !prescriptions[0].dispensed && formattedItems.length > 0 && formattedItems.every((it) => it.has_sufficient_stock),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load prescription.' });
  }
});

// POST /api/prescriptions/:id/dispense : dispense medicines in ONE transaction with row locking (FR-7.4)
router.post('/:id/dispense', requireRole('pharmacist'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Prescription not found.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock prescription row to prevent double-dispensing race conditions
    const presRes = await client.query(
      'SELECT prescription_id, record_id, dispensed FROM prescriptions WHERE prescription_id = $1 FOR UPDATE',
      [id]
    );

    if (!presRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prescription not found.' });
    }

    const prescription = presRes.rows[0];

    // Check if already dispensed
    if (prescription.dispensed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This prescription has already been dispensed.' });
    }

    // 2. Fetch and row-lock all prescription items and medicines
    const itemsRes = await client.query(
      `SELECT pi.item_id, pi.medicine_id, pi.quantity AS prescribed_quantity,
              m.name AS medicine_name, m.quantity AS available_stock
       FROM prescription_items pi
       JOIN medicines m ON m.medicine_id = pi.medicine_id
       WHERE pi.prescription_id = $1
       FOR UPDATE OF m`,
      [id]
    );

    const items = itemsRes.rows;
    if (items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This prescription contains no items to dispense.' });
    }

    // 3. Check stock for EVERY item before modifying any stock
    for (const item of items) {
      const prescribed = Number(item.prescribed_quantity);
      const stock = Number(item.available_stock);
      if (stock < prescribed) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for "${item.medicine_name}". Prescribed: ${prescribed}, Available in inventory: ${stock}.`,
        });
      }
    }

    // 4. All stock checks passed -> deduct stock for each medicine
    for (const item of items) {
      const prescribed = Number(item.prescribed_quantity);
      await client.query(
        'UPDATE medicines SET quantity = quantity - $1 WHERE medicine_id = $2',
        [prescribed, item.medicine_id]
      );
    }

    // 5. Mark prescription as dispensed
    const updatedPres = await client.query(
      'UPDATE prescriptions SET dispensed = TRUE WHERE prescription_id = $1 RETURNING prescription_id, dispensed',
      [id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Prescription dispensed successfully and medicine stock updated.',
      prescription: updatedPres.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not dispense prescription.' });
  } finally {
    client.release();
  }
});

module.exports = router;
