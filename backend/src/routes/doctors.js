const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDayOfWeek, generateSlots, isPastDateTime, parseAvailability, DAYS } = require('../utils/slots');

const router = express.Router();
router.use(requireAuth);

const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Helper to validate availability object
function validateAvailability(avail) {
  if (!avail || typeof avail !== 'object') {
    return { error: 'Availability must be an object with days, start, and end time.' };
  }
  const { days, start, end } = avail;
  if (!Array.isArray(days) || days.length === 0) {
    return { error: 'Select at least one available working day.' };
  }
  for (const d of days) {
    if (!VALID_DAYS.includes(d)) {
      return { error: `Invalid day "${d}". Choose from: ${VALID_DAYS.join(', ')}.` };
    }
  }
  if (!start || !/^\d{2}:\d{2}$/.test(start)) {
    return { error: 'Start time must be in HH:MM format.' };
  }
  if (!end || !/^\d{2}:\d{2}$/.test(end)) {
    return { error: 'End time must be in HH:MM format.' };
  }
  if (start >= end) {
    return { error: 'Start time must be earlier than end time.' };
  }
  return { data: { days, start, end } };
}

// GET /api/doctors/candidates : admin gets doctor users without doctor profiles
router.get('/candidates', requireRole('admin'), async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.user_id, u.name, u.username
       FROM users u
       LEFT JOIN doctors d ON d.user_id = u.user_id
       WHERE u.role = 'doctor' AND d.doctor_id IS NULL AND u.status = 'active'
       ORDER BY u.name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctor candidates.' });
  }
});

// GET /api/doctors/me : doctor gets their own profile
router.get('/me', requireRole('doctor'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.doctor_id, d.user_id, u.name, d.specialization, d.qualification, d.fee, d.availability
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.user_id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor profile not found.' });
    res.json({
      ...rows[0],
      fee: Number(rows[0].fee),
      availability: parseAvailability(rows[0].availability),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load your doctor profile.' });
  }
});

// GET /api/doctors : list doctors filtered by specialization and/or date
router.get('/', async (req, res) => {
  const spec = String(req.query.specialization || '').trim();
  const dateStr = String(req.query.date || '').trim();

  try {
    let query = `
      SELECT d.doctor_id, d.user_id, u.name, u.status AS user_status,
             d.specialization, d.qualification, d.fee, d.availability
      FROM doctors d
      JOIN users u ON u.user_id = d.user_id
      WHERE u.status = 'active'
    `;
    const params = [];

    if (spec) {
      params.push(`%${spec}%`);
      query += ` AND d.specialization ILIKE $${params.length}`;
    }

    query += ' ORDER BY u.name ASC';

    const { rows } = await db.query(query, params);

    let doctors = rows.map((r) => ({
      ...r,
      fee: Number(r.fee),
      availability: parseAvailability(r.availability),
    }));

    // If date is provided, filter for doctors working on that weekday
    if (dateStr) {
      const weekday = getDayOfWeek(dateStr);
      if (weekday) {
        doctors = doctors.filter((doc) => doc.availability.days.includes(weekday));
      }
    }

    res.json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctors.' });
  }
});

// GET /api/doctors/:id : single doctor details
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Doctor not found.' });

  try {
    const { rows } = await db.query(
      `SELECT d.doctor_id, d.user_id, u.name, u.status AS user_status,
              d.specialization, d.qualification, d.fee, d.availability
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.doctor_id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found.' });

    res.json({
      ...rows[0],
      fee: Number(rows[0].fee),
      availability: parseAvailability(rows[0].availability),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load doctor details.' });
  }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD : generate 30-minute slots and check booked status
router.get('/:id/slots', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Doctor not found.' });

  const dateStr = String(req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Please provide a valid date in YYYY-MM-DD format.' });
  }

  try {
    const docRes = await db.query(
      `SELECT d.doctor_id, u.name, d.availability
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       WHERE d.doctor_id = $1 AND u.status = 'active'`,
      [id]
    );
    if (!docRes.rows[0]) return res.status(404).json({ error: 'Doctor not found.' });

    const doc = docRes.rows[0];
    const avail = parseAvailability(doc.availability);
    const weekday = getDayOfWeek(dateStr);

    const working = avail.days.includes(weekday);
    if (!working) {
      return res.json({
        date: dateStr,
        weekday,
        working: false,
        message: `Doctor does not work on ${weekday}s.`,
        slots: [],
      });
    }

    const allSlots = generateSlots(avail.start, avail.end);

    // Fetch already booked (Scheduled) slots for this doctor on this date
    const apptRes = await db.query(
      `SELECT time_slot FROM appointments
       WHERE doctor_id = $1 AND date = $2 AND status = 'Scheduled'`,
      [id, dateStr]
    );
    const bookedSet = new Set(apptRes.rows.map((r) => r.time_slot));

    const slots = allSlots.map((time) => {
      const isPast = isPastDateTime(dateStr, time);
      const isBooked = bookedSet.has(time);
      return {
        time,
        booked: isBooked,
        past: isPast,
        available: !isBooked && !isPast,
      };
    });

    res.json({
      date: dateStr,
      weekday,
      working: true,
      slots,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointment slots.' });
  }
});

// POST /api/doctors : admin creates a doctor profile (FR-3.1)
router.post('/', requireRole('admin'), async (req, res) => {
  const { user_id, specialization, qualification, fee, availability } = req.body || {};
  const userId = Number(user_id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Select a valid staff user for the doctor profile.' });
  }
  if (!specialization || !String(specialization).trim()) {
    return res.status(400).json({ error: 'Specialization is required.' });
  }
  const feeNum = fee !== undefined && fee !== '' ? Number(fee) : 0;
  if (isNaN(feeNum) || feeNum < 0) {
    return res.status(400).json({ error: 'Consultation fee must be 0 or a positive number.' });
  }

  // Validate user has doctor role
  const userRes = await db.query('SELECT user_id, role, status FROM users WHERE user_id = $1', [userId]);
  if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found.' });
  if (userRes.rows[0].role !== 'doctor') {
    return res.status(400).json({ error: 'The selected account does not have the doctor role.' });
  }

  let availData = { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00', end: '13:00' };
  if (availability) {
    const check = validateAvailability(availability);
    if (check.error) return res.status(400).json({ error: check.error });
    availData = check.data;
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO doctors (user_id, specialization, qualification, fee, availability)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, specialization.trim(), qualification ? String(qualification).trim() : null, feeNum, JSON.stringify(availData)]
    );
    res.status(201).json({
      ...rows[0],
      fee: Number(rows[0].fee),
      availability: parseAvailability(rows[0].availability),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A doctor profile already exists for this user.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not create doctor profile.' });
  }
});

// PUT /api/doctors/:id : admin updates profile details & availability, OR doctor updates own availability
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Doctor not found.' });

  try {
    const existing = await db.query('SELECT * FROM doctors WHERE doctor_id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Doctor not found.' });
    const current = existing.rows[0];

    const isAdmin = req.user.role === 'admin';
    const isSelfDoctor = req.user.role === 'doctor' && req.user.id === current.user_id;

    if (!isAdmin && !isSelfDoctor) {
      return res.status(403).json({ error: 'You do not have permission to edit this doctor profile.' });
    }

    let specialization = current.specialization;
    let qualification = current.qualification;
    let feeNum = Number(current.fee);
    let availData = parseAvailability(current.availability);

    // If admin, can update specialization, qualification, fee
    if (isAdmin) {
      if (req.body.specialization !== undefined) {
        if (!String(req.body.specialization).trim()) {
          return res.status(400).json({ error: 'Specialization cannot be blank.' });
        }
        specialization = String(req.body.specialization).trim();
      }
      if (req.body.qualification !== undefined) {
        qualification = String(req.body.qualification).trim() || null;
      }
      if (req.body.fee !== undefined) {
        const parsedFee = Number(req.body.fee);
        if (isNaN(parsedFee) || parsedFee < 0) {
          return res.status(400).json({ error: 'Consultation fee must be 0 or a positive number.' });
        }
        feeNum = parsedFee;
      }
    }

    // Both admin and self-doctor can update availability
    if (req.body.availability !== undefined) {
      const check = validateAvailability(req.body.availability);
      if (check.error) return res.status(400).json({ error: check.error });
      availData = check.data;
    }

    const { rows } = await db.query(
      `UPDATE doctors
       SET specialization = $1, qualification = $2, fee = $3, availability = $4
       WHERE doctor_id = $5
       RETURNING *`,
      [specialization, qualification, feeNum, JSON.stringify(availData), id]
    );

    res.json({
      ...rows[0],
      fee: Number(rows[0].fee),
      availability: parseAvailability(rows[0].availability),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update doctor profile.' });
  }
});

module.exports = router;
