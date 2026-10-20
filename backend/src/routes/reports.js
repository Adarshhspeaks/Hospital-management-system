const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Helper to escape values for RFC 4180 CSV
function generateCsv(columns, data) {
  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const headerRow = columns.map((c) => escape(c.label)).join(',');
  const dataRows = data.map((row) =>
    columns.map((c) => escape(typeof c.getter === 'function' ? c.getter(row) : row[c.key])).join(',')
  );
  return [headerRow, ...dataRows].join('\r\n');
}

// Helper to validate date format YYYY-MM-DD
function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// -------------------------------------------------------------
// GET /api/reports/dashboard : role-appropriate KPI metrics (FR-8.1)
// -------------------------------------------------------------
router.get('/dashboard', async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    if (role === 'admin') {
      // 1. Overall counts
      const [patRes, docRes, staffRes, medRes] = await Promise.all([
        db.query('SELECT COUNT(*) AS count FROM patients'),
        db.query('SELECT COUNT(*) AS count FROM doctors'),
        db.query("SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
        db.query('SELECT COUNT(*) AS count FROM medicines'),
      ]);

      // 2. Today's appointments breakdown
      const todayApptRes = await db.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'Scheduled') AS scheduled,
           COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'Cancelled') AS cancelled,
           COUNT(*) FILTER (WHERE status = 'No-show') AS no_show
         FROM appointments
         WHERE date = CURRENT_DATE`
      );

      // 3. Financial overview
      const [todayRevRes, totalRevRes, pendingBillRes] = await Promise.all([
        db.query("SELECT COALESCE(SUM(total), 0) AS revenue FROM bills WHERE status = 'Paid' AND date = CURRENT_DATE"),
        db.query("SELECT COALESCE(SUM(total), 0) AS revenue FROM bills WHERE status = 'Paid'"),
        db.query("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount FROM bills WHERE status = 'Pending'"),
      ]);

      // 4. Pharmacy alert counts
      const stockRes = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE quantity <= threshold AND quantity > 0) AS low_stock,
           COUNT(*) FILTER (WHERE quantity = 0) AS out_of_stock,
           COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired
         FROM medicines`
      );

      // 5. Recent appointments
      const recentApptsRes = await db.query(
        `SELECT a.appointment_id, a.date, a.time_slot, a.status,
                p.patient_id, p.name AS patient_name,
                u.name AS doctor_name, d.specialization AS doctor_specialization
         FROM appointments a
         JOIN patients p ON p.patient_id = a.patient_id
         JOIN doctors d ON d.doctor_id = a.doctor_id
         JOIN users u ON u.user_id = d.user_id
         ORDER BY a.date DESC, a.time_slot DESC
         LIMIT 6`
      );

      // 6. Recent bills
      const recentBillsRes = await db.query(
        `SELECT b.bill_id, b.date, b.total, b.status, b.payment_mode,
                p.name AS patient_name
         FROM bills b
         JOIN patients p ON p.patient_id = b.patient_id
         ORDER BY b.date DESC, b.bill_id DESC
         LIMIT 6`
      );

      return res.json({
        role: 'admin',
        counts: {
          patients: Number(patRes.rows[0].count),
          doctors: Number(docRes.rows[0].count),
          staff: Number(staffRes.rows[0].count),
          medicines: Number(medRes.rows[0].count),
        },
        today: {
          appointments_total: Number(todayApptRes.rows[0].total),
          scheduled: Number(todayApptRes.rows[0].scheduled),
          completed: Number(todayApptRes.rows[0].completed),
          cancelled: Number(todayApptRes.rows[0].cancelled),
          no_show: Number(todayApptRes.rows[0].no_show),
          revenue: Number(todayRevRes.rows[0].revenue),
        },
        financial: {
          total_revenue: Number(totalRevRes.rows[0].revenue),
          pending_bills_count: Number(pendingBillRes.rows[0].count),
          pending_bills_amount: Number(pendingBillRes.rows[0].amount),
        },
        pharmacy: {
          low_stock: Number(stockRes.rows[0].low_stock),
          out_of_stock: Number(stockRes.rows[0].out_of_stock),
          expired: Number(stockRes.rows[0].expired),
        },
        recent_appointments: recentApptsRes.rows,
        recent_bills: recentBillsRes.rows.map((r) => ({ ...r, total: Number(r.total) })),
      });
    }

    if (role === 'doctor') {
      const docRes = await db.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [userId]);
      if (!docRes.rows[0]) {
        return res.json({ role: 'doctor', today: { appointments_total: 0, scheduled: 0, completed: 0 } });
      }
      const doctorId = docRes.rows[0].doctor_id;

      const [todayRes, totalPatientsRes, upcomingRes] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'Scheduled') AS scheduled,
             COUNT(*) FILTER (WHERE status = 'Completed') AS completed
           FROM appointments
           WHERE doctor_id = $1 AND date = CURRENT_DATE`,
          [doctorId]
        ),
        db.query(
          `SELECT COUNT(DISTINCT patient_id) AS count
           FROM appointments
           WHERE doctor_id = $1 AND status = 'Completed'`,
          [doctorId]
        ),
        db.query(
          `SELECT a.appointment_id, a.date, a.time_slot, a.status,
                  p.patient_id, p.name AS patient_name, p.phone AS patient_phone
           FROM appointments a
           JOIN patients p ON p.patient_id = a.patient_id
           WHERE a.doctor_id = $1 AND a.date >= CURRENT_DATE AND a.status = 'Scheduled'
           ORDER BY a.date ASC, a.time_slot ASC
           LIMIT 5`,
          [doctorId]
        ),
      ]);

      return res.json({
        role: 'doctor',
        today: {
          appointments_total: Number(todayRes.rows[0].total),
          scheduled: Number(todayRes.rows[0].scheduled),
          completed: Number(todayRes.rows[0].completed),
        },
        total_patients_seen: Number(totalPatientsRes.rows[0].count),
        upcoming_appointments: upcomingRes.rows,
      });
    }

    if (role === 'receptionist') {
      const [todayApptRes, patRes, pendingBillRes, unbilledRes] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'Scheduled') AS scheduled,
             COUNT(*) FILTER (WHERE status = 'Completed') AS completed
           FROM appointments
           WHERE date = CURRENT_DATE`
        ),
        db.query('SELECT COUNT(*) AS count FROM patients'),
        db.query("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount FROM bills WHERE status = 'Pending'"),
        db.query(
          `SELECT COUNT(*) AS count
           FROM appointments a
           LEFT JOIN bills b ON b.appointment_id = a.appointment_id
           WHERE b.bill_id IS NULL AND a.status = 'Completed'`
        ),
      ]);

      return res.json({
        role: 'receptionist',
        today: {
          appointments_total: Number(todayApptRes.rows[0].total),
          scheduled: Number(todayApptRes.rows[0].scheduled),
          completed: Number(todayApptRes.rows[0].completed),
        },
        total_patients: Number(patRes.rows[0].count),
        pending_bills_count: Number(pendingBillRes.rows[0].count),
        pending_bills_amount: Number(pendingBillRes.rows[0].amount),
        unbilled_completed_count: Number(unbilledRes.rows[0].count),
      });
    }

    if (role === 'pharmacist') {
      const [presRes, stockRes] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) FILTER (WHERE dispensed = FALSE) AS pending_prescriptions,
             COUNT(*) FILTER (WHERE dispensed = TRUE) AS dispensed_count
           FROM prescriptions`
        ),
        db.query(
          `SELECT
             COUNT(*) FILTER (WHERE quantity <= threshold AND quantity > 0) AS low_stock,
             COUNT(*) FILTER (WHERE quantity = 0) AS out_of_stock,
             COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired
           FROM medicines`
        ),
      ]);

      return res.json({
        role: 'pharmacist',
        prescriptions: {
          pending: Number(presRes.rows[0].pending_prescriptions),
          dispensed: Number(presRes.rows[0].dispensed_count),
        },
        inventory: {
          low_stock: Number(stockRes.rows[0].low_stock),
          out_of_stock: Number(stockRes.rows[0].out_of_stock),
          expired: Number(stockRes.rows[0].expired),
        },
      });
    }

    res.json({ role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load dashboard metrics.' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/appointments : appointments analytics (FR-8.2)
// -------------------------------------------------------------
router.get('/appointments', requireRole('admin', 'receptionist'), async (req, res) => {
  const { from_date, to_date, doctor_id, status } = req.query || {};

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (from_date && isValidDate(from_date)) {
      params.push(from_date);
      whereClause += ` AND a.date >= $${params.length}`;
    }

    if (to_date && isValidDate(to_date)) {
      params.push(to_date);
      whereClause += ` AND a.date <= $${params.length}`;
    }

    if (doctor_id) {
      const docId = Number(doctor_id);
      if (Number.isInteger(docId)) {
        params.push(docId);
        whereClause += ` AND a.doctor_id = $${params.length}`;
      }
    }

    if (status && ['Scheduled', 'Completed', 'Cancelled', 'No-show'].includes(status)) {
      params.push(status);
      whereClause += ` AND a.status = $${params.length}`;
    }

    // 1. Overall Summary
    const summaryRes = await db.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE a.status = 'Completed') AS completed,
         COUNT(*) FILTER (WHERE a.status = 'Scheduled') AS scheduled,
         COUNT(*) FILTER (WHERE a.status = 'Cancelled') AS cancelled,
         COUNT(*) FILTER (WHERE a.status = 'No-show') AS no_show
       FROM appointments a
       ${whereClause}`,
      params
    );

    const total = Number(summaryRes.rows[0].total);
    const completed = Number(summaryRes.rows[0].completed);
    const cancelled = Number(summaryRes.rows[0].cancelled);
    const scheduled = Number(summaryRes.rows[0].scheduled);
    const noShow = Number(summaryRes.rows[0].no_show);

    const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
    const cancellationRate = total > 0 ? Number(((cancelled / total) * 100).toFixed(1)) : 0;

    // 2. Breakdown By Doctor
    const byDocRes = await db.query(
      `SELECT
         d.doctor_id, u.name AS doctor_name, d.specialization,
         COUNT(a.appointment_id) AS total,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'Completed') AS completed,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'Scheduled') AS scheduled,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'Cancelled') AS cancelled,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'No-show') AS no_show
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id ${whereClause.replace(/a\./g, 'a.')}
       GROUP BY d.doctor_id, u.name, d.specialization
       ORDER BY total DESC, u.name ASC`,
      params
    );

    // 3. Breakdown By Date (Daily trend)
    const byDateRes = await db.query(
      `SELECT
         a.date,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE a.status = 'Completed') AS completed,
         COUNT(*) FILTER (WHERE a.status = 'Cancelled') AS cancelled
       FROM appointments a
       ${whereClause}
       GROUP BY a.date
       ORDER BY a.date ASC`,
      params
    );

    // 4. Appointments list
    const apptsRes = await db.query(
      `SELECT a.appointment_id, a.date, a.time_slot, a.status,
              p.patient_id, p.name AS patient_name, p.phone AS patient_phone,
              d.doctor_id, u.name AS doctor_name, d.specialization, d.fee AS doctor_fee
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       ${whereClause}
       ORDER BY a.date DESC, a.time_slot DESC
       LIMIT 500`,
      params
    );

    res.json({
      summary: {
        total,
        completed,
        scheduled,
        cancelled,
        no_show: noShow,
        completion_rate: completionRate,
        cancellation_rate: cancellationRate,
      },
      by_doctor: byDocRes.rows.map((r) => ({
        ...r,
        total: Number(r.total),
        completed: Number(r.completed),
        scheduled: Number(r.scheduled),
        cancelled: Number(r.cancelled),
        no_show: Number(r.no_show),
      })),
      by_date: byDateRes.rows.map((r) => ({
        ...r,
        total: Number(r.total),
        completed: Number(r.completed),
        cancelled: Number(r.cancelled),
      })),
      appointments: apptsRes.rows.map((r) => ({ ...r, doctor_fee: Number(r.doctor_fee) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate appointments report.' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/appointments/csv : download appointments CSV (FR-8.2)
// -------------------------------------------------------------
router.get('/appointments/csv', requireRole('admin', 'receptionist'), async (req, res) => {
  const { from_date, to_date, doctor_id, status } = req.query || {};

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (from_date && isValidDate(from_date)) {
      params.push(from_date);
      whereClause += ` AND a.date >= $${params.length}`;
    }

    if (to_date && isValidDate(to_date)) {
      params.push(to_date);
      whereClause += ` AND a.date <= $${params.length}`;
    }

    if (doctor_id) {
      const docId = Number(doctor_id);
      if (Number.isInteger(docId)) {
        params.push(docId);
        whereClause += ` AND a.doctor_id = $${params.length}`;
      }
    }

    if (status && ['Scheduled', 'Completed', 'Cancelled', 'No-show'].includes(status)) {
      params.push(status);
      whereClause += ` AND a.status = $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT a.appointment_id, a.date, a.time_slot, a.status,
              p.patient_id, p.name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name, d.specialization AS doctor_specialization, d.fee AS doctor_fee
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN users u ON u.user_id = d.user_id
       ${whereClause}
       ORDER BY a.date DESC, a.time_slot DESC`,
      params
    );

    const columns = [
      { label: 'Appointment ID', key: 'appointment_id' },
      { label: 'Date', key: 'date' },
      { label: 'Time Slot', key: 'time_slot' },
      { label: 'Status', key: 'status' },
      { label: 'Patient Name', key: 'patient_name' },
      { label: 'Patient ID', getter: (r) => `P-${String(r.patient_id).padStart(4, '0')}` },
      { label: 'Phone', key: 'patient_phone' },
      { label: 'Doctor', key: 'doctor_name' },
      { label: 'Specialization', key: 'doctor_specialization' },
      { label: 'Consultation Fee (INR)', key: 'doctor_fee' },
    ];

    const csvData = generateCsv(columns, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments-report.csv"');
    res.send(csvData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not export appointments CSV.' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/revenue : revenue analytics (FR-8.3)
// -------------------------------------------------------------
router.get('/revenue', requireRole('admin', 'receptionist'), async (req, res) => {
  const { from_date, to_date, payment_mode } = req.query || {};

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (from_date && isValidDate(from_date)) {
      params.push(from_date);
      whereClause += ` AND b.date >= $${params.length}`;
    }

    if (to_date && isValidDate(to_date)) {
      params.push(to_date);
      whereClause += ` AND b.date <= $${params.length}`;
    }

    if (payment_mode && ['cash', 'card', 'upi'].includes(payment_mode)) {
      params.push(payment_mode);
      whereClause += ` AND b.payment_mode = $${params.length}`;
    }

    // 1. Overall Summary
    const summaryRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE b.status = 'Paid') AS paid_count,
         COUNT(*) FILTER (WHERE b.status = 'Pending') AS pending_count,
         COALESCE(SUM(b.total) FILTER (WHERE b.status = 'Paid'), 0) AS total_revenue,
         COALESCE(SUM(b.consultation_fee) FILTER (WHERE b.status = 'Paid'), 0) AS consultation_total,
         COALESCE(SUM(b.medicine_charges) FILTER (WHERE b.status = 'Paid'), 0) AS medicine_total,
         COALESCE(SUM(b.other_charges) FILTER (WHERE b.status = 'Paid'), 0) AS other_total,
         COALESCE(SUM(b.total) FILTER (WHERE b.status = 'Pending'), 0) AS pending_amount
       FROM bills b
       ${whereClause}`,
      params
    );

    const s = summaryRes.rows[0];

    // 2. Breakdown By Payment Mode (for Paid bills)
    const byModeRes = await db.query(
      `SELECT
         b.payment_mode,
         COUNT(*) AS count,
         COALESCE(SUM(b.total), 0) AS amount
       FROM bills b
       ${whereClause} AND b.status = 'Paid'
       GROUP BY b.payment_mode
       ORDER BY amount DESC`,
      params
    );

    // 3. Breakdown By Date (Daily trend)
    const byDateRes = await db.query(
      `SELECT
         b.date,
         COUNT(*) FILTER (WHERE b.status = 'Paid') AS paid_count,
         COALESCE(SUM(b.total) FILTER (WHERE b.status = 'Paid'), 0) AS revenue,
         COALESCE(SUM(b.consultation_fee) FILTER (WHERE b.status = 'Paid'), 0) AS consultation_fees,
         COALESCE(SUM(b.medicine_charges) FILTER (WHERE b.status = 'Paid'), 0) AS medicine_charges
       FROM bills b
       ${whereClause}
       GROUP BY b.date
       ORDER BY b.date ASC`,
      params
    );

    // 4. Bills list
    const billsRes = await db.query(
      `SELECT b.bill_id, b.date, b.patient_id, b.appointment_id,
              b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
              b.status, b.payment_mode,
              p.name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM bills b
       JOIN patients p ON p.patient_id = b.patient_id
       LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
       LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN users u ON u.user_id = d.user_id
       ${whereClause}
       ORDER BY b.date DESC, b.bill_id DESC
       LIMIT 500`,
      params
    );

    res.json({
      summary: {
        paid_count: Number(s.paid_count),
        pending_count: Number(s.pending_count),
        total_revenue: Number(s.total_revenue),
        consultation_total: Number(s.consultation_total),
        medicine_total: Number(s.medicine_total),
        other_total: Number(s.other_total),
        pending_amount: Number(s.pending_amount),
      },
      by_payment_mode: byModeRes.rows.map((r) => ({
        payment_mode: r.payment_mode || 'unspecified',
        count: Number(r.count),
        amount: Number(r.amount),
      })),
      by_date: byDateRes.rows.map((r) => ({
        date: r.date,
        paid_count: Number(r.paid_count),
        revenue: Number(r.revenue),
        consultation_fees: Number(r.consultation_fees),
        medicine_charges: Number(r.medicine_charges),
      })),
      bills: billsRes.rows.map((r) => ({
        ...r,
        consultation_fee: Number(r.consultation_fee),
        medicine_charges: Number(r.medicine_charges),
        other_charges: Number(r.other_charges),
        total: Number(r.total),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate revenue report.' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/revenue/csv : download revenue CSV (FR-8.3)
// -------------------------------------------------------------
router.get('/revenue/csv', requireRole('admin', 'receptionist'), async (req, res) => {
  const { from_date, to_date, payment_mode } = req.query || {};

  try {
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (from_date && isValidDate(from_date)) {
      params.push(from_date);
      whereClause += ` AND b.date >= $${params.length}`;
    }

    if (to_date && isValidDate(to_date)) {
      params.push(to_date);
      whereClause += ` AND b.date <= $${params.length}`;
    }

    if (payment_mode && ['cash', 'card', 'upi'].includes(payment_mode)) {
      params.push(payment_mode);
      whereClause += ` AND b.payment_mode = $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT b.bill_id, b.date, b.patient_id, b.appointment_id,
              b.consultation_fee, b.medicine_charges, b.other_charges, b.total,
              b.status, b.payment_mode,
              p.name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name, d.specialization AS doctor_specialization
       FROM bills b
       JOIN patients p ON p.patient_id = b.patient_id
       LEFT JOIN appointments a ON a.appointment_id = b.appointment_id
       LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
       LEFT JOIN users u ON u.user_id = d.user_id
       ${whereClause}
       ORDER BY b.date DESC, b.bill_id DESC`,
      params
    );

    const columns = [
      { label: 'Invoice No', getter: (r) => `INV-B${String(r.bill_id).padStart(4, '0')}` },
      { label: 'Date', key: 'date' },
      { label: 'Patient Name', key: 'patient_name' },
      { label: 'Patient ID', getter: (r) => `P-${String(r.patient_id).padStart(4, '0')}` },
      { label: 'Doctor', key: 'doctor_name' },
      { label: 'Specialization', key: 'doctor_specialization' },
      { label: 'Consultation Fee (INR)', key: 'consultation_fee' },
      { label: 'Medicine Charges (INR)', key: 'medicine_charges' },
      { label: 'Other Charges (INR)', key: 'other_charges' },
      { label: 'Total (INR)', key: 'total' },
      { label: 'Status', key: 'status' },
      { label: 'Payment Mode', getter: (r) => r.payment_mode ? r.payment_mode.toUpperCase() : '—' },
    ];

    const csvData = generateCsv(columns, rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue-report.csv"');
    res.send(csvData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not export revenue CSV.' });
  }
});

// -------------------------------------------------------------
// GET /api/reports/doctor-performance : doctor performance analytics
// -------------------------------------------------------------
router.get('/doctor-performance', requireRole('admin'), async (req, res) => {
  const { from_date, to_date } = req.query || {};

  try {
    let apptDateFilter = '';
    const params = [];

    if (from_date && isValidDate(from_date)) {
      params.push(from_date);
      apptDateFilter += ` AND a.date >= $${params.length}`;
    }

    if (to_date && isValidDate(to_date)) {
      params.push(to_date);
      apptDateFilter += ` AND a.date <= $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT
         d.doctor_id, u.name AS doctor_name, d.specialization, d.fee AS doctor_fee,
         COUNT(a.appointment_id) AS total_appointments,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'Completed') AS completed,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'Cancelled') AS cancelled,
         COUNT(a.appointment_id) FILTER (WHERE a.status = 'No-show') AS no_show,
         COALESCE(SUM(b.total) FILTER (WHERE b.status = 'Paid'), 0) AS revenue_generated
       FROM doctors d
       JOIN users u ON u.user_id = d.user_id
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id ${apptDateFilter}
       LEFT JOIN bills b ON b.appointment_id = a.appointment_id
       GROUP BY d.doctor_id, u.name, d.specialization, d.fee
       ORDER BY completed DESC, total_appointments DESC`,
      params
    );

    res.json(
      rows.map((r) => {
        const total = Number(r.total_appointments);
        const comp = Number(r.completed);
        return {
          doctor_id: r.doctor_id,
          doctor_name: r.doctor_name,
          specialization: r.specialization,
          doctor_fee: Number(r.doctor_fee),
          total_appointments: total,
          completed: comp,
          cancelled: Number(r.cancelled),
          no_show: Number(r.no_show),
          completion_rate: total > 0 ? Number(((comp / total) * 100).toFixed(1)) : 0,
          revenue_generated: Number(r.revenue_generated),
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate doctor performance report.' });
  }
});

module.exports = router;
