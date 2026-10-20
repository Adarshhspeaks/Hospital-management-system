const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const VALID_PAYMENT_MODES = ['cash', 'card', 'upi'];
const VALID_STATUSES = ['Pending', 'Paid'];

// GET /api/bills/preview/:appointment_id : preview breakdown before generating bill (FR-6.1)
router.get('/preview/:appointment_id', requireRole('receptionist', 'admin'), async (req, res) => {
  const apptId = Number(req.params.appointment_id);
  if (!Number.isInteger(apptId)) return res.status(404).json({ error: 'Appointment not found.' });

  try {
    // 1. Fetch appointment, patient, and doctor
    const apptRes = await db.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.date, a.time_slot, a.status AS appointment_status,
              p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender,
              u.name AS doctor_name, d.specialization AS doctor_specialization, d.fee AS doctor_fee
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       WHERE a.appointment_id = $1`,
      [apptId]
    );

    if (!apptRes.rows[0]) return res.status(404).json({ error: 'Appointment not found.' });
    const appt = apptRes.rows[0];

    // 2. Check if already billed
    const billRes = await db.query('SELECT bill_id, status, total, payment_mode FROM bills WHERE appointment_id = $1', [apptId]);
    if (billRes.rows[0]) {
      return res.json({
        already_billed: true,
        existing_bill: {
          ...billRes.rows[0],
          total: Number(billRes.rows[0].total),
        },
        appointment: appt,
      });
    }

    const consultationFee = Number(appt.doctor_fee || 0);

    // 3. Fetch dispensed prescription items (if any)
    const presRes = await db.query(
      `SELECT pr.prescription_id, pr.dispensed,
              pi.item_id, pi.quantity, pi.dosage, pi.duration,
              med.name AS medicine_name, med.price AS unit_price,
              (pi.quantity * med.price) AS line_total
       FROM medical_records m
       JOIN prescriptions pr ON pr.record_id = m.record_id
       JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE m.appointment_id = $1 AND pr.dispensed = TRUE`,
      [apptId]
    );

    const items = presRes.rows.map((it) => ({
      ...it,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      line_total: Number(it.line_total),
    }));

    const medicineCharges = items.reduce((sum, it) => sum + it.line_total, 0);
    const suggestedTotal = consultationFee + medicineCharges;

    res.json({
      already_billed: false,
      appointment: appt,
      consultation_fee: consultationFee,
      medicine_charges: medicineCharges,
      prescription_items: items,
      suggested_total: suggestedTotal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bill preview.' });
  }
});

// GET /api/bills/unbilled : list appointments eligible for billing (FR-6.1)
router.get('/unbilled', requireRole('receptionist', 'admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.date, a.time_slot, a.status,
              p.name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name, d.specialization AS doctor_specialization, d.fee AS doctor_fee
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       LEFT JOIN bills b ON b.appointment_id = a.appointment_id
       WHERE b.bill_id IS NULL AND a.status IN ('Completed', 'Scheduled')
       ORDER BY (a.status = 'Completed') DESC, a.date DESC, a.time_slot DESC`
    );
    res.json(rows.map((r) => ({
      ...r,
      doctor_fee: Number(r.doctor_fee),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load unbilled appointments.' });
  }
});

// GET /api/bills : list bills with filters (FR-6.2)
router.get('/', requireRole('receptionist', 'admin'), async (req, res) => {
  const { status, patient_id, date, q } = req.query || {};

  try {
    let query = `
      SELECT b.bill_id, b.patient_id, b.appointment_id,
             b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
             b.status, b.payment_mode, b.date,
             p.name AS patient_name, p.phone AS patient_phone,
             a.date AS appointment_date, a.time_slot,
             u.name AS doctor_name, d.specialization AS doctor_specialization
      FROM bills b
      JOIN patients p ON p.patient_id = b.patient_id
      LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      LEFT JOIN users u ON u.user_id = d.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    if (patient_id) {
      const pId = Number(patient_id);
      if (Number.isInteger(pId)) {
        params.push(pId);
        query += ` AND b.patient_id = $${params.length}`;
      }
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.push(date);
      query += ` AND b.date = $${params.length}`;
    }

    if (q) {
      params.push(`%${q.trim()}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.phone LIKE $${params.length})`;
    }

    query += ' ORDER BY b.date DESC, b.bill_id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows.map((r) => ({
      ...r,
      consultation_fee: Number(r.consultation_fee),
      medicine_charges: Number(r.medicine_charges),
      other_charges: Number(r.other_charges),
      total: Number(r.total),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bills.' });
  }
});

// GET /api/bills/patient/:patient_id : per-patient payment history (FR-6.3)
router.get('/patient/:patient_id', requireRole('receptionist', 'admin', 'doctor'), async (req, res) => {
  const patientId = Number(req.params.patient_id);
  if (!Number.isInteger(patientId)) return res.status(404).json({ error: 'Patient not found.' });

  try {
    const patCheck = await db.query('SELECT patient_id, name FROM patients WHERE patient_id = $1', [patientId]);
    if (!patCheck.rows[0]) return res.status(404).json({ error: 'Patient not found.' });

    const { rows } = await db.query(
      `SELECT b.bill_id, b.patient_id, b.appointment_id,
              b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
              b.status, b.payment_mode, b.date,
              a.date AS appointment_date, a.time_slot,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM bills b
       LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
       LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN users u ON u.user_id = d.user_id
       WHERE b.patient_id = $1
       ORDER BY b.date DESC, b.bill_id DESC`,
      [patientId]
    );

    res.json(rows.map((r) => ({
      ...r,
      consultation_fee: Number(r.consultation_fee),
      medicine_charges: Number(r.medicine_charges),
      other_charges: Number(r.other_charges),
      total: Number(r.total),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load patient payment history.' });
  }
});

// POST /api/bills : receptionist generates a bill (FR-6.1)
router.post('/', requireRole('receptionist', 'admin'), async (req, res) => {
  const { appointment_id, other_charges = 0, status = 'Pending', payment_mode } = req.body || {};
  const apptId = Number(appointment_id);

  if (!Number.isInteger(apptId)) {
    return res.status(400).json({ error: 'Valid appointment ID is required.' });
  }

  const otherNum = Number(other_charges || 0);
  if (isNaN(otherNum) || otherNum < 0) {
    return res.status(400).json({ error: 'Other charges must be 0 or a positive number.' });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status must be Pending or Paid.' });
  }

  if (status === 'Paid') {
    if (!payment_mode || !VALID_PAYMENT_MODES.includes(payment_mode)) {
      return res.status(400).json({ error: 'Choose a valid payment mode (cash, card, or upi) for Paid bills.' });
    }
  }

  try {
    // 1. Fetch appointment details
    const apptRes = await db.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, d.fee AS doctor_fee
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE a.appointment_id = $1`,
      [apptId]
    );
    if (!apptRes.rows[0]) return res.status(404).json({ error: 'Appointment not found.' });

    const appt = apptRes.rows[0];
    const consultationFee = Number(appt.doctor_fee || 0);

    // 2. Calculate medicine charges from dispensed prescription items
    const medRes = await db.query(
      `SELECT COALESCE(SUM(pi.quantity * med.price), 0) AS med_total
       FROM medical_records m
       JOIN prescriptions pr ON pr.record_id = m.record_id
       JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE m.appointment_id = $1 AND pr.dispensed = TRUE`,
      [apptId]
    );
    const medicineCharges = Number(medRes.rows[0].med_total || 0);

    // 3. Compute total = sum of the three
    const total = consultationFee + medicineCharges + otherNum;

    // 4. Insert bill
    const { rows } = await db.query(
      `INSERT INTO bills (patient_id, appointment_id, consultation_fee, medicine_charges, other_charges, total, status, payment_mode, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
       RETURNING *`,
      [
        appt.patient_id,
        apptId,
        consultationFee,
        medicineCharges,
        otherNum,
        total,
        status,
        status === 'Paid' ? payment_mode : null,
      ]
    );

    res.status(201).json({
      ...rows[0],
      consultation_fee: Number(rows[0].consultation_fee),
      medicine_charges: Number(rows[0].medicine_charges),
      other_charges: Number(rows[0].other_charges),
      total: Number(rows[0].total),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A bill has already been generated for this appointment.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not generate bill.' });
  }
});

// PATCH /api/bills/:id/pay : mark a pending bill as Paid (FR-6.1)
router.patch('/:id/pay', requireRole('receptionist', 'admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Bill not found.' });

  const { payment_mode } = req.body || {};
  if (!payment_mode || !VALID_PAYMENT_MODES.includes(payment_mode)) {
    return res.status(400).json({ error: 'Choose a valid payment mode (cash, card, or upi).' });
  }

  try {
    const existing = await db.query('SELECT bill_id, status FROM bills WHERE bill_id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Bill not found.' });

    if (existing.rows[0].status === 'Paid') {
      return res.status(400).json({ error: 'This bill has already been marked as Paid.' });
    }

    const { rows } = await db.query(
      `UPDATE bills
       SET status = 'Paid', payment_mode = $1
       WHERE bill_id = $2
       RETURNING *`,
      [payment_mode, id]
    );

    res.json({
      ...rows[0],
      consultation_fee: Number(rows[0].consultation_fee),
      medicine_charges: Number(rows[0].medicine_charges),
      other_charges: Number(rows[0].other_charges),
      total: Number(rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update bill payment.' });
  }
});

// GET /api/bills/:id : get bill details with breakdown
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Bill not found.' });

  try {
    const { rows } = await db.query(
      `SELECT b.bill_id, b.patient_id, b.appointment_id,
              b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
              b.status, b.payment_mode, b.date,
              p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender, p.address AS patient_address,
              a.date AS appointment_date, a.time_slot,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM bills b
       JOIN patients p ON p.patient_id = b.patient_id
       LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
       LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN users u ON u.user_id = d.user_id
       WHERE b.bill_id = $1`,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Bill not found.' });
    const bill = rows[0];

    // Fetch dispensed prescription items for itemized view
    const itemsRes = await db.query(
      `SELECT med.name AS medicine_name, pi.quantity, med.price AS unit_price,
              (pi.quantity * med.price) AS line_total
       FROM medical_records m
       JOIN prescriptions pr ON pr.record_id = m.record_id
       JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE m.appointment_id = $1 AND pr.dispensed = TRUE`,
      [bill.appointment_id]
    );

    res.json({
      ...bill,
      consultation_fee: Number(bill.consultation_fee),
      medicine_charges: Number(bill.medicine_charges),
      other_charges: Number(bill.other_charges),
      total: Number(bill.total),
      prescription_items: itemsRes.rows.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load bill details.' });
  }
});

// GET /api/bills/:id/pdf : downloadable PDF invoice using pdfkit (FR-6.4)
router.get('/:id/pdf', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Bill not found.' });

  try {
    const { rows } = await db.query(
      `SELECT b.bill_id, b.patient_id, b.appointment_id,
              b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
              b.status, b.payment_mode, b.date,
              p.name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender,
              a.date AS appointment_date, a.time_slot,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM bills b
       JOIN patients p ON p.patient_id = b.patient_id
       LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
       LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN users u ON u.user_id = d.user_id
       WHERE b.bill_id = $1`,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Bill not found.' });
    const bill = rows[0];

    const itemsRes = await db.query(
      `SELECT med.name AS medicine_name, pi.quantity, med.price AS unit_price,
              (pi.quantity * med.price) AS line_total
       FROM medical_records m
       JOIN prescriptions pr ON pr.record_id = m.record_id
       JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
       JOIN medicines med ON med.medicine_id = pi.medicine_id
       WHERE m.appointment_id = $1 AND pr.dispensed = TRUE`,
      [bill.appointment_id]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-B${String(bill.bill_id).padStart(4, '0')}.pdf"`);

    doc.pipe(res);

    // Hospital Header
    doc.fontSize(20).text('CITY HOSPITAL', { align: 'center' });
    doc.fontSize(10).fillColor('#5a6f7a').text('Medical Invoice & Payment Receipt', { align: 'center' });
    doc.moveDown(1.5);

    // Bill Meta & Patient Info
    doc.fillColor('#10242f').fontSize(11);
    doc.text(`Invoice No: INV-B${String(bill.bill_id).padStart(4, '0')}`);
    doc.text(`Invoice Date: ${bill.date}`);
    doc.text(`Payment Status: ${bill.status.toUpperCase()}${bill.payment_mode ? ` (${bill.payment_mode.toUpperCase()})` : ''}`);
    doc.moveDown(0.5);

    doc.text(`Patient: ${bill.patient_name} (P-${String(bill.patient_id).padStart(4, '0')})`);
    doc.text(`Contact: ${bill.patient_phone || 'N/A'}`);
    doc.text(`Doctor: ${bill.doctor_name || 'Hospital Staff'} (${bill.doctor_specialization || 'General'})`);
    doc.moveDown(1.5);

    // Table Header
    doc.fontSize(10).text('Description', 50, doc.y, { width: 300 });
    doc.text('Amount (INR)', 400, doc.y, { width: 140, align: 'right' });
    doc.moveDown(0.5);
    doc.strokeColor('#d6dfe3').lineWidth(1).moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.5);

    // Line items
    doc.text('Doctor Consultation Fee', 50, doc.y, { width: 300 });
    doc.text(`Rs. ${Number(bill.consultation_fee).toFixed(2)}`, 400, doc.y, { width: 140, align: 'right' });
    doc.moveDown(0.5);

    if (Number(bill.medicine_charges) > 0) {
      doc.text('Pharmacy Medicines (Dispensed):', 50, doc.y, { width: 300 });
      doc.text(`Rs. ${Number(bill.medicine_charges).toFixed(2)}`, 400, doc.y, { width: 140, align: 'right' });
      doc.moveDown(0.3);

      itemsRes.rows.forEach((it) => {
        doc.fontSize(9).fillColor('#5a6f7a').text(`  - ${it.medicine_name} (${it.quantity} x Rs. ${Number(it.unit_price).toFixed(2)})`, 50, doc.y, { width: 300 });
        doc.text(`Rs. ${Number(it.line_total).toFixed(2)}`, 400, doc.y, { width: 140, align: 'right' });
        doc.moveDown(0.3);
      });
      doc.fillColor('#10242f').fontSize(10);
    }

    if (Number(bill.other_charges) > 0) {
      doc.text('Other / Service Charges', 50, doc.y, { width: 300 });
      doc.text(`Rs. ${Number(bill.other_charges).toFixed(2)}`, 400, doc.y, { width: 140, align: 'right' });
      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);
    doc.strokeColor('#d6dfe3').lineWidth(1).moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.8);

    // Total
    doc.fontSize(13).text('Total Amount Due / Paid:', 50, doc.y, { width: 300 });
    doc.text(`Rs. ${Number(bill.total).toFixed(2)}`, 400, doc.y, { width: 140, align: 'right' });
    doc.moveDown(2);

    doc.fontSize(9).fillColor('#5a6f7a').text('Thank you for choosing City Hospital. For questions, contact reception.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate invoice PDF.' });
  }
});

module.exports = router;
