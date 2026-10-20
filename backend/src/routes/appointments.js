const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDayOfWeek, generateSlots, isPastDateTime, parseAvailability } = require('../utils/slots');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-show'];

// Helper to validate date format YYYY-MM-DD
function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// GET /api/appointments : list appointments
// - Doctors see only their own appointments (can filter by ?date=)
// - Receptionists and Admins see appointments across doctors (can filter by ?date=, ?doctor_id=, ?patient_id=, ?status=)
router.get('/', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const { date, doctor_id, patient_id, status } = req.query || {};

  try {
    let doctorFilterId = null;

    if (req.user.role === 'doctor') {
      const docRes = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [req.user.id]);
      if (!docRes.rows[0]) return res.json([]);
      doctorFilterId = docRes.rows[0].doctor_id;
    } else if (doctor_id) {
      const parsedDocId = Number(doctor_id);
      if (Number.isInteger(parsedDocId)) doctorFilterId = parsedDocId;
    }

    let query = `
      SELECT a.appointment_id, a.patient_id, a.doctor_id, a.date, a.time_slot, a.status,
             p.name AS patient_name, p.phone AS patient_phone, p.gender AS patient_gender, p.age AS patient_age,
             u.name AS doctor_name, d.specialization AS doctor_specialization, d.fee AS doctor_fee
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      WHERE 1=1
    `;
    const params = [];

    if (doctorFilterId) {
      params.push(doctorFilterId);
      query += ` AND a.doctor_id = $${params.length}`;
    }

    if (date && isValidDate(date)) {
      params.push(date);
      query += ` AND a.date = $${params.length}`;
    }

    if (patient_id) {
      const pId = Number(patient_id);
      if (Number.isInteger(pId)) {
        params.push(pId);
        query += ` AND a.patient_id = $${params.length}`;
      }
    }

    if (status && ALLOWED_STATUSES.includes(status)) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    query += ' ORDER BY a.date DESC, a.time_slot ASC, a.appointment_id DESC';

    const { rows } = await db.query(query, params);
    res.json(rows.map((r) => ({
      ...r,
      doctor_fee: Number(r.doctor_fee),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointments.' });
  }
});

// GET /api/appointments/:id : get single appointment
router.get('/:id', requireRole('admin', 'receptionist', 'doctor'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Appointment not found.' });

  try {
    const { rows } = await db.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.date, a.time_slot, a.status,
              p.name AS patient_name, p.phone AS patient_phone, p.gender AS patient_gender, p.age AS patient_age,
              u.name AS doctor_name, d.user_id AS doctor_user_id, d.specialization AS doctor_specialization, d.fee AS doctor_fee
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       WHERE a.appointment_id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found.' });

    // If doctor, can only view if it's their appointment
    if (req.user.role === 'doctor' && rows[0].doctor_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this appointment.' });
    }

    res.json({
      ...rows[0],
      doctor_fee: Number(rows[0].doctor_fee),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointment.' });
  }
});

// POST /api/appointments : receptionist books an appointment (FR-4.1)
router.post('/', requireRole('receptionist'), async (req, res) => {
  const { patient_id, doctor_id, date, time_slot } = req.body || {};
  const patientId = Number(patient_id);
  const doctorId = Number(doctor_id);

  if (!Number.isInteger(patientId) || !Number.isInteger(doctorId)) {
    return res.status(400).json({ error: 'Valid patient ID and doctor ID are required.' });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
  }
  if (!time_slot || !/^\d{2}:\d{2}$/.test(time_slot)) {
    return res.status(400).json({ error: 'Time slot must be in HH:MM format.' });
  }

  // Reject past dates and times
  if (isPastDateTime(date, time_slot)) {
    return res.status(400).json({ error: 'Cannot book an appointment for a past date or time.' });
  }

  try {
    // Check patient exists
    const patRes = await db.query('SELECT patient_id FROM patients WHERE patient_id = $1', [patientId]);
    if (!patRes.rows[0]) return res.status(404).json({ error: 'Patient not found.' });

    // Check doctor exists and is active
    const docRes = await db.query(
      `SELECT d.doctor_id, u.name, d.availability
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.doctor_id = $1 AND u.status = 'active'`,
      [doctorId]
    );
    if (!docRes.rows[0]) return res.status(404).json({ error: 'Doctor not found or inactive.' });

    const doc = docRes.rows[0];
    const avail = parseAvailability(doc.availability);
    const weekday = getDayOfWeek(date);

    if (!avail.days.includes(weekday)) {
      return res.status(400).json({ error: `Doctor ${doc.name} is not available on ${weekday}s.` });
    }

    const validSlots = generateSlots(avail.start, avail.end);
    if (!validSlots.includes(time_slot)) {
      return res.status(400).json({ error: 'Selected time slot is outside doctor working hours.' });
    }

    // Insert appointment
    const { rows } = await db.query(
      `INSERT INTO appointments (patient_id, doctor_id, date, time_slot, status)
       VALUES ($1, $2, $3, $4, 'Scheduled')
       RETURNING *`,
      [patientId, doctorId, date, time_slot]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      // Unique index uniq_active_slot violation
      return res.status(409).json({ error: 'This time slot is already booked for this doctor.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not book the appointment.' });
  }
});

// PATCH /api/appointments/:id/reschedule : receptionist reschedules an appointment (FR-4.3)
router.patch('/:id/reschedule', requireRole('receptionist'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Appointment not found.' });

  const { date, time_slot } = req.body || {};
  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
  }
  if (!time_slot || !/^\d{2}:\d{2}$/.test(time_slot)) {
    return res.status(400).json({ error: 'Time slot must be in HH:MM format.' });
  }

  // Reject past dates/times
  if (isPastDateTime(date, time_slot)) {
    return res.status(400).json({ error: 'Cannot reschedule to a past date or time.' });
  }

  try {
    const apptRes = await db.query(
      `SELECT a.*, d.availability, u.name AS doctor_name
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       WHERE a.appointment_id = $1`,
      [id]
    );
    if (!apptRes.rows[0]) return res.status(404).json({ error: 'Appointment not found.' });

    const appt = apptRes.rows[0];
    if (appt.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Only Scheduled appointments can be rescheduled.' });
    }

    // Verify doctor availability for new date and time
    const avail = parseAvailability(appt.availability);
    const weekday = getDayOfWeek(date);

    if (!avail.days.includes(weekday)) {
      return res.status(400).json({ error: `Doctor ${appt.doctor_name} is not available on ${weekday}s.` });
    }

    const validSlots = generateSlots(avail.start, avail.end);
    if (!validSlots.includes(time_slot)) {
      return res.status(400).json({ error: 'Selected time slot is outside doctor working hours.' });
    }

    // Check if new slot is already booked (excluding this appointment if date and slot are identical)
    if (appt.date === date && appt.time_slot === time_slot) {
      return res.json(appt);
    }

    const { rows } = await db.query(
      `UPDATE appointments
       SET date = $1, time_slot = $2
       WHERE appointment_id = $3 AND status = 'Scheduled'
       RETURNING *`,
      [date, time_slot, id]
    );

    if (!rows[0]) {
      return res.status(400).json({ error: 'Only Scheduled appointments can be rescheduled.' });
    }

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This time slot is already booked for this doctor.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not reschedule appointment.' });
  }
});

// PATCH /api/appointments/:id/cancel : receptionist cancels appointment (FR-4.4)
router.patch('/:id/cancel', requireRole('receptionist'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Appointment not found.' });

  try {
    const existing = await db.query('SELECT status FROM appointments WHERE appointment_id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Appointment not found.' });

    if (existing.rows[0].status !== 'Scheduled') {
      return res.status(400).json({ error: 'Only Scheduled appointments can be cancelled.' });
    }

    const { rows } = await db.query(
      `UPDATE appointments SET status = 'Cancelled' WHERE appointment_id = $1 RETURNING *`,
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not cancel appointment.' });
  }
});

// PATCH /api/appointments/:id/status : change appointment status
// - Receptionist can mark Cancelled or No-show
// - Doctor can mark Completed or No-show for their own appointments
// - Only Scheduled appointments can change status
router.patch('/:id/status', requireRole('receptionist', 'doctor'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Appointment not found.' });

  const { status } = req.body || {};
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Provide a valid status (Completed, Cancelled, or No-show).' });
  }

  try {
    const apptRes = await db.query(
      `SELECT a.*, d.user_id AS doctor_user_id
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       WHERE a.appointment_id = $1`,
      [id]
    );
    if (!apptRes.rows[0]) return res.status(404).json({ error: 'Appointment not found.' });

    const appt = apptRes.rows[0];

    // Status can only be changed if currently Scheduled
    if (appt.status !== 'Scheduled') {
      return res.status(400).json({ error: `Only Scheduled appointments can be changed. This appointment is already ${appt.status}.` });
    }

    // Role-specific allowed transitions
    if (req.user.role === 'doctor') {
      if (appt.doctor_user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update your own appointments.' });
      }
      if (!['Completed', 'No-show'].includes(status)) {
        return res.status(400).json({ error: 'Doctors can only mark appointments as Completed or No-show.' });
      }
    } else if (req.user.role === 'receptionist') {
      if (!['Cancelled', 'No-show'].includes(status)) {
        return res.status(400).json({ error: 'Receptionists can only cancel or mark appointments as No-show.' });
      }
    }

    const { rows } = await db.query(
      `UPDATE appointments SET status = $1 WHERE appointment_id = $2 RETURNING *`,
      [status, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update appointment status.' });
  }
});

module.exports = router;
