const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// FR-5.4: Diagnoses and medical records are visible to doctors only
router.use(requireAuth, requireRole('doctor'));

// POST /api/records : record consultation, prescription, and complete appointment in ONE transaction (FR-5.1, FR-5.2, FR-5.3)
router.post('/', async (req, res) => {
  const { appointment_id, symptoms, diagnosis, notes, prescription } = req.body || {};
  const apptId = Number(appointment_id);

  if (!Number.isInteger(apptId)) {
    return res.status(400).json({ error: 'Valid appointment ID is required.' });
  }

  const cleanDiag = String(diagnosis || '').trim();
  if (!cleanDiag) {
    return res.status(400).json({ error: 'Diagnosis is required.' });
  }

  const items = Array.isArray(prescription) ? prescription : [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const medId = Number(item.medicine_id);
    const qty = Number(item.quantity !== undefined ? item.quantity : 1);
    if (!Number.isInteger(medId)) {
      return res.status(400).json({ error: `Item ${i + 1}: Select a valid medicine.` });
    }
    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ error: `Item ${i + 1}: Quantity must be at least 1.` });
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and verify the appointment
    const apptRes = await client.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.status, d.user_id AS doctor_user_id
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE a.appointment_id = $1
       FOR UPDATE`,
      [apptId]
    );

    if (!apptRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const appt = apptRes.rows[0];

    // Must be own appointment
    if (appt.doctor_user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only record consultations for your own appointments.' });
    }

    // Must be Scheduled
    if (appt.status !== 'Scheduled') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Only Scheduled appointments can be consulted. This appointment is already ${appt.status}.`,
      });
    }

    // 2. Check one record per appointment
    const recCheck = await client.query(
      'SELECT record_id FROM medical_records WHERE appointment_id = $1',
      [apptId]
    );
    if (recCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A medical record already exists for this appointment.' });
    }

    // 3. Verify medicines exist
    for (const it of items) {
      const medCheck = await client.query('SELECT name FROM medicines WHERE medicine_id = $1', [Number(it.medicine_id)]);
      if (!medCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Medicine ID ${it.medicine_id} not found in inventory.` });
      }
    }

    // 4. Create medical_records
    const medRecRes = await client.query(
      `INSERT INTO medical_records (appointment_id, symptoms, diagnosis, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING record_id, appointment_id, symptoms, diagnosis, notes`,
      [
        apptId,
        symptoms ? String(symptoms).trim() : null,
        cleanDiag,
        notes ? String(notes).trim() : null,
      ]
    );
    const createdRecord = medRecRes.rows[0];

    // 5. Create prescription & items if any
    let createdPrescription = null;
    const createdItems = [];

    if (items.length > 0) {
      const presRes = await client.query(
        `INSERT INTO prescriptions (record_id, dispensed)
         VALUES ($1, FALSE)
         RETURNING prescription_id, record_id, dispensed`,
        [createdRecord.record_id]
      );
      createdPrescription = presRes.rows[0];

      for (const it of items) {
        const itemRes = await client.query(
          `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration, quantity)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING item_id, prescription_id, medicine_id, dosage, duration, quantity`,
          [
            createdPrescription.prescription_id,
            Number(it.medicine_id),
            it.dosage ? String(it.dosage).trim() : null,
            it.duration ? String(it.duration).trim() : null,
            Number(it.quantity || 1),
          ]
        );
        createdItems.push(itemRes.rows[0]);
      }
    }

    // 6. Mark appointment Completed
    await client.query(
      "UPDATE appointments SET status = 'Completed' WHERE appointment_id = $1",
      [apptId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      record: createdRecord,
      prescription: createdPrescription
        ? {
            ...createdPrescription,
            items: createdItems,
          }
        : null,
      appointment_status: 'Completed',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Could not save consultation record.' });
  } finally {
    client.release();
  }
});

// GET /api/records/patient/:patient_id : doctor views all past records for a patient (FR-5.4)
router.get('/patient/:patient_id', async (req, res) => {
  const patientId = Number(req.params.patient_id);
  if (!Number.isInteger(patientId)) {
    return res.status(404).json({ error: 'Patient not found.' });
  }

  try {
    const patCheck = await db.query('SELECT patient_id, name FROM patients WHERE patient_id = $1', [patientId]);
    if (!patCheck.rows[0]) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const { rows: records } = await db.query(
      `SELECT m.record_id, m.appointment_id, m.symptoms, m.diagnosis, m.notes,
              a.date, a.time_slot, a.status AS appointment_status,
              u.name AS doctor_name, d.specialization,
              pr.prescription_id, pr.dispensed
       FROM medical_records m
       JOIN appointments a ON a.appointment_id = m.appointment_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       LEFT JOIN prescriptions pr ON pr.record_id = m.record_id
       WHERE a.patient_id = $1
       ORDER BY a.date DESC, a.time_slot DESC, m.record_id DESC`,
      [patientId]
    );

    if (records.length === 0) {
      return res.json([]);
    }

    const prescriptionIds = records
      .map((r) => r.prescription_id)
      .filter((id) => id !== null && id !== undefined);

    let itemsMap = {};
    if (prescriptionIds.length > 0) {
      const { rows: items } = await db.query(
        `SELECT pi.item_id, pi.prescription_id, pi.medicine_id, pi.dosage, pi.duration, pi.quantity,
                med.name AS medicine_name, med.price AS medicine_price
         FROM prescription_items pi
         JOIN medicines med ON med.medicine_id = pi.medicine_id
         WHERE pi.prescription_id = ANY($1::int[])
         ORDER BY pi.item_id ASC`,
        [prescriptionIds]
      );

      itemsMap = items.reduce((acc, item) => {
        if (!acc[item.prescription_id]) acc[item.prescription_id] = [];
        acc[item.prescription_id].push({
          ...item,
          medicine_price: Number(item.medicine_price),
        });
        return acc;
      }, {});
    }

    const result = records.map((r) => ({
      ...r,
      prescription: r.prescription_id
        ? {
            prescription_id: r.prescription_id,
            dispensed: r.dispensed,
            items: itemsMap[r.prescription_id] || [],
          }
        : null,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load patient medical records.' });
  }
});

// GET /api/records/appointment/:appointment_id : doctor gets record for a specific appointment
router.get('/appointment/:appointment_id', async (req, res) => {
  const apptId = Number(req.params.appointment_id);
  if (!Number.isInteger(apptId)) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT m.record_id, m.appointment_id, m.symptoms, m.diagnosis, m.notes,
              a.date, a.time_slot, a.status AS appointment_status,
              p.name AS patient_name, p.patient_id,
              u.name AS doctor_name, d.specialization,
              pr.prescription_id, pr.dispensed
       FROM medical_records m
       JOIN appointments a ON a.appointment_id = m.appointment_id
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       LEFT JOIN prescriptions pr ON pr.record_id = m.record_id
       WHERE m.appointment_id = $1`,
      [apptId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'No medical record found for this appointment.' });
    }

    const record = rows[0];
    let items = [];
    if (record.prescription_id) {
      const itemsRes = await db.query(
        `SELECT pi.item_id, pi.prescription_id, pi.medicine_id, pi.dosage, pi.duration, pi.quantity,
                med.name AS medicine_name, med.price AS medicine_price
         FROM prescription_items pi
         JOIN medicines med ON med.medicine_id = pi.medicine_id
         WHERE pi.prescription_id = $1
         ORDER BY pi.item_id ASC`,
        [record.prescription_id]
      );
      items = itemsRes.rows.map((it) => ({
        ...it,
        medicine_price: Number(it.medicine_price),
      }));
    }

    res.json({
      ...record,
      prescription: record.prescription_id
        ? {
            prescription_id: record.prescription_id,
            dispensed: record.dispensed,
            items,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointment medical record.' });
  }
});

module.exports = router;
