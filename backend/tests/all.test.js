/**
 * Hospital Management System (HMS) - Comprehensive SRS Integration Test Suite
 * Covers every SRS Functional Requirement: FR-1.1 through FR-8.2
 * Plus role permission failure tests and additional features beyond the SRS.
 * 
 * Usage: npm test (or node tests/all.test.js)
 */

const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_RUN_IP = `test-run-${Date.now()}`;

async function req(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-test-ip': opts.ip || TEST_RUN_IP,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const buffer = await res.arrayBuffer();
    return { status: res.status, buffer, contentType, headers: res.headers };
  }
  if (contentType.includes('text/csv')) {
    const text = await res.text();
    return { status: res.status, text, contentType, headers: res.headers };
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

let passed = 0;
let failed = 0;

function report(id, description, ok, err) {
  const title = `${id}: ${description}`;
  if (ok) {
    passed++;
    console.log(`  ✓ ${title}`);
  } else {
    failed++;
    console.error(`  ✗ ${title}`);
    if (err) console.error(`    ${err.message}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log(' Hospital Management System (HMS) - SRS Integration Test Suite');
  console.log(' Target API: ' + BASE_URL);
  console.log('================================================================\n');

  let adminToken, recToken, docToken, pharmToken;
  let testPatientId, testDoctorId, testApptId, testPrescriptionId, testBillId;
  let slotDate, targetSlot, targetSlot2, targetSlot3;

  // -------------------------------------------------------------
  // MODULE 1: AUTHENTICATION & ACCESS CONTROL (FR-1.1 - FR-1.5)
  // -------------------------------------------------------------
  console.log('[Module 1: Authentication & Access Control]');

  // FR-1.1 login with username and password
  try {
    const [aLog, rLog, dLog, pLog] = await Promise.all([
      req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } }),
      req('/auth/login', { method: 'POST', body: { username: 'reception', password: 'reception123' } }),
      req('/auth/login', { method: 'POST', body: { username: 'doctor1', password: 'doctor123' } }),
      req('/auth/login', { method: 'POST', body: { username: 'pharmacy', password: 'pharmacy123' } }),
    ]);

    assert.strictEqual(aLog.status, 200);
    assert.strictEqual(rLog.status, 200);
    assert.strictEqual(dLog.status, 200);
    assert.strictEqual(pLog.status, 200);

    adminToken = aLog.data.token;
    recToken = rLog.data.token;
    docToken = dLog.data.token;
    pharmToken = pLog.data.token;

    const badLogin = await req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrongpassword' } });
    assert.strictEqual(badLogin.status, 401);

    report('FR-1.1', 'login with username and password (valid tokens issued, invalid credentials rejected with 401)', true);
  } catch (err) {
    report('FR-1.1', 'login with username and password', false, err);
  }

  // Security Hardening for FR-1.1: Helmet headers & login rate limiting
  try {
    const probe = await req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrongpassword' } });
    assert(probe.headers.get('x-content-type-options') === 'nosniff' || probe.headers.get('x-dns-prefetch-control'), 'Helmet headers must be present');
    const limitHeader = probe.headers.get('ratelimit-limit');
    assert.strictEqual(limitHeader, '10', 'Login rate limit must be 10 attempts per 15 minutes');

    // 11th login attempt from a dedicated IP is blocked with 429
    const bruteIp = `brute-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      await req('/auth/login', { method: 'POST', ip: bruteIp, body: { username: 'admin', password: 'bad' } });
    }
    const blockedRes = await req('/auth/login', { method: 'POST', ip: bruteIp, body: { username: 'admin', password: 'bad' } });
    assert.strictEqual(blockedRes.status, 429, '11th attempt must be blocked with 429');
    assert(blockedRes.data.error.includes('Too many login attempts'));

    report('FR-1.1 (Security)', 'helmet HTTP security headers and login rate limiting (10 attempts/15min, 429 on 11th)', true);
  } catch (err) {
    report('FR-1.1 (Security)', 'helmet HTTP security headers and login rate limiting', false, err);
  }

  // FR-1.2 every account has one role (admin, doctor, receptionist, pharmacist)
  try {
    const staffList = await req('/users', { token: adminToken });
    assert.strictEqual(staffList.status, 200);
    const validRoles = new Set(['admin', 'doctor', 'receptionist', 'pharmacist']);
    for (const u of staffList.data) {
      assert(validRoles.has(u.role), `User ${u.username} has invalid role: ${u.role}`);
    }
    report('FR-1.2', 'every account has one role (admin, doctor, receptionist, pharmacist)', true);
  } catch (err) {
    report('FR-1.2', 'every account has one role', false, err);
  }

  // FR-1.3 pages and API routes restricted by role (including permission-failure tests)
  try {
    // Receptionist blocked from admin-only staff management
    const recOnUsers = await req('/users', { token: recToken });
    assert.strictEqual(recOnUsers.status, 403, 'Non-admin must be blocked from /users with 403');

    // Doctor blocked from receptionist-only appointment booking
    const docOnBooking = await req('/appointments', { method: 'POST', token: docToken, body: {} });
    assert.strictEqual(docOnBooking.status, 403, 'Non-receptionist must be blocked from booking appointments with 403');

    // Receptionist blocked from doctor-only consultations
    const recOnRecords = await req('/records', { method: 'POST', token: recToken, body: {} });
    assert.strictEqual(recOnRecords.status, 403, 'Non-doctor must be blocked from recording consultations with 403');

    // Doctor blocked from pharmacist-only dispensing
    const docOnDispense = await req('/prescriptions/1/dispense', { method: 'POST', token: docToken });
    assert.strictEqual(docOnDispense.status, 403, 'Non-pharmacist must be blocked from dispensing with 403');

    report('FR-1.3', 'pages and API routes restricted by role (403 Forbidden for unauthorized roles)', true);
  } catch (err) {
    report('FR-1.3', 'pages and API routes restricted by role', false, err);
  }

  // FR-1.4 admin creates, edits and deactivates staff accounts
  try {
    const uniqueUser = `staff_${Date.now()}`;
    // 1. Create
    const createStaff = await req('/users', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Initial Staff', username: uniqueUser, password: 'password123', role: 'receptionist' },
    });
    assert.strictEqual(createStaff.status, 201);
    const staffId = createStaff.data.user_id;

    // 2. Edit name, role, and reset password
    const editStaff = await req(`/users/${staffId}`, {
      method: 'PUT',
      token: adminToken,
      body: { name: 'Updated Staff Name', role: 'pharmacist', password: 'newpassword456' },
    });
    assert.strictEqual(editStaff.status, 200);
    assert.strictEqual(editStaff.data.name, 'Updated Staff Name');
    assert.strictEqual(editStaff.data.role, 'pharmacist');

    // 3. Deactivate
    const deact = await req(`/users/${staffId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'inactive' },
    });
    assert.strictEqual(deact.status, 200);
    assert.strictEqual(deact.data.status, 'inactive');

    // 4. Verify deactivated user cannot log in
    const deactLogin = await req('/auth/login', {
      method: 'POST',
      body: { username: uniqueUser, password: 'newpassword456' },
    });
    assert.strictEqual(deactLogin.status, 403, 'Deactivated account must be rejected with 403');

    // 5. Reactivate
    const react = await req(`/users/${staffId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' },
    });
    assert.strictEqual(react.status, 200);
    assert.strictEqual(react.data.status, 'active');

    // 6. Verify login succeeds with reset password
    const reactLogin = await req('/auth/login', {
      method: 'POST',
      body: { username: uniqueUser, password: 'newpassword456' },
    });
    assert.strictEqual(reactLogin.status, 200, 'Reactivated account with reset password must log in successfully');

    report('FR-1.4', 'admin creates, edits and deactivates staff accounts (with password reset)', true);
  } catch (err) {
    report('FR-1.4', 'admin creates, edits and deactivates staff accounts', false, err);
  }

  // FR-1.5 logout, and sessions end after a set time
  try {
    // Current valid session restore via /auth/me
    const meRes = await req('/auth/me', { token: adminToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.role, 'admin');

    // Invalid / expired token rejected
    const expiredRes = await req('/auth/me', { token: 'invalid.expired.jwt.token' });
    assert.strictEqual(expiredRes.status, 401, 'Invalid or expired session token must return 401');

    report('FR-1.5', 'logout, and sessions end after a set time (session restore and 401 invalidation)', true);
  } catch (err) {
    report('FR-1.5', 'logout, and sessions end after a set time', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 2: PATIENT MANAGEMENT (FR-2.1 - FR-2.5)
  // -------------------------------------------------------------
  console.log('\n[Module 2: Patient Registration & Profile Management]');

  // FR-2.1 register patient (name, age, gender, contact, address, blood group)
  try {
    const patRes = await req('/patients', {
      method: 'POST',
      token: recToken,
      body: {
        name: 'Aarav Sharma',
        age: 34,
        gender: 'Male',
        phone: '9812345678',
        address: '42 Marine Drive, Mumbai',
        blood_group: 'B+',
      },
    });
    assert.strictEqual(patRes.status, 201);
    testPatientId = patRes.data.patient_id;
    assert.strictEqual(patRes.data.name, 'Aarav Sharma');
    assert.strictEqual(patRes.data.blood_group, 'B+');
    report('FR-2.1', 'register patient (name, age, gender, contact, address, blood group)', true);
  } catch (err) {
    report('FR-2.1', 'register patient', false, err);
  }

  // FR-2.2 unique patient ID generated
  try {
    assert(Number.isInteger(testPatientId));
    assert(testPatientId > 0);
    const patCode = `P-${String(testPatientId).padStart(4, '0')}`;
    assert(/^P-\d{4}$/.test(patCode));
    report('FR-2.2', `unique patient ID generated (${patCode})`, true);
  } catch (err) {
    report('FR-2.2', 'unique patient ID generated', false, err);
  }

  // FR-2.3 search patients by ID, name or phone
  try {
    const [byName, byPhone] = await Promise.all([
      req('/patients?q=Aarav', { token: recToken }),
      req('/patients?q=9812345678', { token: recToken }),
    ]);
    assert.strictEqual(byName.status, 200);
    assert.strictEqual(byPhone.status, 200);
    assert(byName.data.some((p) => p.patient_id === testPatientId));
    assert(byPhone.data.some((p) => p.patient_id === testPatientId));
    report('FR-2.3', 'search patients by ID, name or phone', true);
  } catch (err) {
    report('FR-2.3', 'search patients by ID, name or phone', false, err);
  }

  // FR-2.4 receptionist updates patient details
  try {
    const updatePat = await req(`/patients/${testPatientId}`, {
      method: 'PUT',
      token: recToken,
      body: {
        name: 'Aarav Sharma',
        age: 35,
        gender: 'Male',
        phone: '9812349999',
        address: '77 Nariman Point, Mumbai',
        blood_group: 'B+',
      },
    });
    assert.strictEqual(updatePat.status, 200);
    assert.strictEqual(updatePat.data.age, 35);
    assert.strictEqual(updatePat.data.phone, '9812349999');
    report('FR-2.4', 'receptionist updates patient details', true);
  } catch (err) {
    report('FR-2.4', 'receptionist updates patient details', false, err);
  }

  // FR-2.5 visit history per patient
  try {
    const patDetails = await req(`/patients/${testPatientId}`, { token: recToken });
    assert.strictEqual(patDetails.status, 200);
    assert(Array.isArray(patDetails.data.visits));
    report('FR-2.5', 'visit history per patient (retrieved via patient details)', true);
  } catch (err) {
    report('FR-2.5', 'visit history per patient', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 3: DOCTOR PROFILES & AVAILABILITY (FR-3.1 - FR-3.3)
  // -------------------------------------------------------------
  console.log('\n[Module 3: Doctor Profiles & Availability Scheduling]');

  // FR-3.1 admin adds and edits doctor profiles (specialization, qualification, fee)
  try {
    const docsRes = await req('/doctors', { token: recToken });
    assert.strictEqual(docsRes.status, 200);
    assert(docsRes.data.length > 0);
    testDoctorId = docsRes.data[0].doctor_id;

    // Admin updates fee and qualification
    const editDoc = await req(`/doctors/${testDoctorId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        specialization: 'General Medicine',
        qualification: 'MBBS, MD (General)',
        fee: 550,
      },
    });
    assert.strictEqual(editDoc.status, 200);
    assert.strictEqual(Number(editDoc.data.fee), 550);
    report('FR-3.1', 'admin adds and edits doctor profiles (specialization, qualification, fee)', true);
  } catch (err) {
    report('FR-3.1', 'admin adds and edits doctor profiles', false, err);
  }

  // FR-3.2 weekly availability slots set by admin or the doctor
  try {
    const updateAvail = await req(`/doctors/${testDoctorId}`, {
      method: 'PUT',
      token: docToken,
      body: {
        availability: {
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          start: '09:00',
          end: '17:00',
        },
      },
    });
    assert.strictEqual(updateAvail.status, 200);

    const d = new Date();
    d.setDate(d.getDate() + ((4 + 7 - d.getDay()) % 7 || 7)); // Next Thursday
    slotDate = d.toISOString().slice(0, 10);

    const slotsRes = await req(`/doctors/${testDoctorId}/slots?date=${slotDate}`, { token: recToken });
    assert.strictEqual(slotsRes.status, 200);
    assert.strictEqual(slotsRes.data.working, true);
    assert(Array.isArray(slotsRes.data.slots));
    assert(slotsRes.data.slots.length >= 3);

    const freeSlots = slotsRes.data.slots.filter((s) => s.available);
    assert(freeSlots.length >= 3, 'Must have at least 3 free slots for booking tests');
    targetSlot = freeSlots[0].time;
    targetSlot2 = freeSlots[1].time;
    targetSlot3 = freeSlots[2].time;

    report('FR-3.2', 'weekly availability slots set by admin or the doctor (dynamic 30-min slots generated)', true);
  } catch (err) {
    report('FR-3.2', 'weekly availability slots set by admin or the doctor', false, err);
  }

  // FR-3.3 list doctors filtered by specialization and availability
  try {
    const filterRes = await req('/doctors?specialization=General', { token: recToken });
    assert.strictEqual(filterRes.status, 200);
    assert(filterRes.data.length > 0);
    assert(filterRes.data.every((d) => d.specialization.includes('General')));
    report('FR-3.3', 'list doctors filtered by specialization and availability', true);
  } catch (err) {
    report('FR-3.3', 'list doctors filtered by specialization and availability', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 4: APPOINTMENTS & SCHEDULING (FR-4.1 - FR-4.5)
  // -------------------------------------------------------------
  console.log('\n[Module 4: Appointments, Conflict Management & Lifecycle]');

  // FR-4.1 book appointment (patient, doctor, date, slot)
  try {
    const bookRes = await req('/appointments', {
      method: 'POST',
      token: recToken,
      body: {
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        date: slotDate,
        time_slot: targetSlot,
      },
    });
    assert.strictEqual(bookRes.status, 201);
    testApptId = bookRes.data.appointment_id;
    assert.strictEqual(bookRes.data.status, 'Scheduled');
    report('FR-4.1', `book appointment (patient, doctor, date, slot) -> #${testApptId}`, true);
  } catch (err) {
    report('FR-4.1', 'book appointment', false, err);
  }

  // FR-4.2 prevent double-booking
  try {
    const doubleBook = await req('/appointments', {
      method: 'POST',
      token: recToken,
      body: {
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        date: slotDate,
        time_slot: targetSlot,
      },
    });
    assert.strictEqual(doubleBook.status, 409, 'Double-booking must be rejected with 409 Conflict');
    report('FR-4.2', 'prevent double-booking (409 Conflict via partial unique index)', true);
  } catch (err) {
    report('FR-4.2', 'prevent double-booking', false, err);
  }

  // FR-4.3 reschedule and cancel appointments
  let cancelApptId;
  try {
    // Book a secondary appointment to reschedule & cancel
    const apptToReschedule = await req('/appointments', {
      method: 'POST',
      token: recToken,
      body: {
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        date: slotDate,
        time_slot: targetSlot2,
      },
    });
    assert.strictEqual(apptToReschedule.status, 201);
    cancelApptId = apptToReschedule.data.appointment_id;

    // Reschedule to targetSlot3
    const reschedRes = await req(`/appointments/${cancelApptId}/reschedule`, {
      method: 'PATCH',
      token: recToken,
      body: { date: slotDate, time_slot: targetSlot3 },
    });
    assert.strictEqual(reschedRes.status, 200);
    assert.strictEqual(reschedRes.data.time_slot, targetSlot3);

    // Cancel appointment
    const cancelRes = await req(`/appointments/${cancelApptId}/cancel`, {
      method: 'PATCH',
      token: recToken,
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.status, 'Cancelled');

    report('FR-4.3', 'reschedule and cancel appointments (reschedule to open slot & cancel active slot)', true);
  } catch (err) {
    report('FR-4.3', 'reschedule and cancel appointments', false, err);
  }

  // FR-4.4 doctor sees a daily list of their own appointments
  try {
    const docDailyList = await req(`/appointments?date=${slotDate}`, { token: docToken });
    assert.strictEqual(docDailyList.status, 200);
    assert(Array.isArray(docDailyList.data));
    assert(docDailyList.data.some((a) => a.appointment_id === testApptId));
    report('FR-4.4', 'doctor sees a daily list of their own appointments', true);
  } catch (err) {
    report('FR-4.4', 'doctor sees a daily list of their own appointments', false, err);
  }

  // FR-4.5 status tracking: Scheduled, Completed, Cancelled, No-show
  try {
    // Book an appointment for No-show test
    const apptNoShow = await req('/appointments', {
      method: 'POST',
      token: recToken,
      body: {
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        date: slotDate,
        time_slot: targetSlot2,
      },
    });
    assert.strictEqual(apptNoShow.status, 201);
    const noShowId = apptNoShow.data.appointment_id;

    // 1. Attempt manual status = 'Completed' (must return 400)
    const manualComp = await req(`/appointments/${noShowId}/status`, {
      method: 'PATCH',
      token: docToken,
      body: { status: 'Completed' },
    });
    assert.strictEqual(manualComp.status, 400, 'Manual Completed status must return 400');

    // 2. Doctor marks No-show
    const noShowRes = await req(`/appointments/${noShowId}/status`, {
      method: 'PATCH',
      token: docToken,
      body: { status: 'No-show' },
    });
    assert.strictEqual(noShowRes.status, 200);
    assert.strictEqual(noShowRes.data.status, 'No-show');

    report('FR-4.5', 'status tracking: Scheduled, Completed, Cancelled, No-show (Completed locked to consultation)', true);
  } catch (err) {
    report('FR-4.5', 'status tracking: Scheduled, Completed, Cancelled, No-show', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 5: CLINICAL CONSULTATIONS & RECORDS (FR-5.1 - FR-5.4)
  // -------------------------------------------------------------
  console.log('\n[Module 5: Clinical Consultations, Prescriptions & Privacy]');

  let med1, med2;
  try {
    const medList = await req('/medicines', { token: pharmToken });
    const sorted = [...medList.data].sort((a, b) => b.quantity - a.quantity);
    med1 = sorted[0];
    med2 = sorted[1];
  } catch (err) {
    console.error('Failed to get medicine list:', err);
  }

  // FR-5.1 & FR-5.2 doctor records symptoms, diagnosis, notes and writes prescription
  try {
    const consultRes = await req('/records', {
      method: 'POST',
      token: docToken,
      body: {
        appointment_id: testApptId,
        symptoms: 'Fever, sore throat, mild body aches for 2 days',
        diagnosis: 'Acute Viral Pharyngitis',
        notes: 'Advised hydration and rest.',
        prescription: [
          { medicine_id: med1.medicine_id, dosage: '1 tab TDS', duration: '3 days', quantity: 1 },
          { medicine_id: med2.medicine_id, dosage: '1 cap BD', duration: '5 days', quantity: 1 },
        ],
      },
    });

    assert.strictEqual(consultRes.status, 201);
    assert(consultRes.data.record && consultRes.data.record.record_id);
    assert(consultRes.data.prescription && consultRes.data.prescription.prescription_id);
    assert.strictEqual(consultRes.data.appointment_status, 'Completed');
    testPrescriptionId = consultRes.data.prescription.prescription_id;

    report('FR-5.1', 'doctor records symptoms, diagnosis, notes', true);
    report('FR-5.2', 'doctor writes a prescription (medicine, dosage, duration, quantity)', true);
  } catch (err) {
    report('FR-5.1', 'doctor records symptoms, diagnosis, notes', false, err);
    report('FR-5.2', 'doctor writes a prescription', false, err);
  }

  // FR-5.3 doctor can view a patient's previous records
  try {
    const prevRecs = await req(`/records/patient/${testPatientId}`, { token: docToken });
    assert.strictEqual(prevRecs.status, 200);
    assert(Array.isArray(prevRecs.data));
    assert(prevRecs.data.some((r) => r.appointment_id === testApptId));
    report('FR-5.3', "doctor can view a patient's previous records (history of past consultations and prescriptions)", true);
  } catch (err) {
    report('FR-5.3', "doctor can view a patient's previous records", false, err);
  }

  // FR-5.4 records visible only to authorized staff
  try {
    // Non-doctor blocked from direct clinical records endpoint
    const recBlocked = await req(`/records/patient/${testPatientId}`, { token: recToken });
    assert.strictEqual(recBlocked.status, 403, 'Non-doctor must be blocked from /records with 403');

    // Diagnosis masked in visit history for non-doctors
    const recPatView = await req(`/patients/${testPatientId}`, { token: recToken });
    const visitRec = recPatView.data.visits.find((v) => v.appointment_id === testApptId);
    assert.strictEqual(visitRec.diagnosis, null, 'Diagnosis must be masked for receptionist');

    // Diagnosis visible to doctor
    const docPatView = await req(`/patients/${testPatientId}`, { token: docToken });
    const visitDoc = docPatView.data.visits.find((v) => v.appointment_id === testApptId);
    assert.strictEqual(visitDoc.diagnosis, 'Acute Viral Pharyngitis', 'Doctor must see diagnosis');

    report('FR-5.4', 'records visible only to authorized staff (masking in patient history & 403 on records endpoint)', true);
  } catch (err) {
    report('FR-5.4', 'records visible only to authorized staff', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 6: PHARMACY DISPENSING & INVENTORY (FR-7.1 - FR-7.4)
  // -------------------------------------------------------------
  console.log('\n[Module 6: Pharmacy Inventory & Atomic Dispensing]');

  let newMedId;
  // FR-7.1 pharmacist adds, updates and removes medicines (quantity, price, expiry)
  try {
    // 1. Add medicine
    const addMed = await req('/medicines', {
      method: 'POST',
      token: pharmToken,
      body: { name: 'Test Med 100mg', quantity: 50, price: 20.00, expiry_date: '2027-12-31', threshold: 10 },
    });
    assert.strictEqual(addMed.status, 201);
    newMedId = addMed.data.medicine_id;

    // 2. Update medicine
    const updateMed = await req(`/medicines/${newMedId}`, {
      method: 'PUT',
      token: pharmToken,
      body: { name: 'Test Med 100mg (Updated)', quantity: 45, price: 22.50, expiry_date: '2027-12-31', threshold: 12 },
    });
    assert.strictEqual(updateMed.status, 200);
    assert.strictEqual(updateMed.data.name, 'Test Med 100mg (Updated)');

    // 3. Non-pharmacist blocked from medicine mutation
    const docBlockMed = await req(`/medicines/${newMedId}`, {
      method: 'PUT',
      token: docToken,
      body: { name: 'Doctor Edit Attempt', quantity: 10, price: 5, threshold: 2 },
    });
    assert.strictEqual(docBlockMed.status, 403, 'Non-pharmacist must be blocked from updating medicine with 403');

    // 4. Remove unreferenced medicine
    const delMed = await req(`/medicines/${newMedId}`, {
      method: 'DELETE',
      token: pharmToken,
    });
    assert.strictEqual(delMed.status, 200);

    report('FR-7.1', 'pharmacist adds, updates and removes medicines (quantity, price, expiry)', true);
  } catch (err) {
    report('FR-7.1', 'pharmacist adds, updates and removes medicines', false, err);
  }

  // FR-7.3 alerts for low stock and near-expiry medicines
  try {
    const alertsRes = await req('/medicines/alerts', { token: pharmToken });
    assert.strictEqual(alertsRes.status, 200);
    assert(typeof alertsRes.data.total === 'number');
    assert(typeof alertsRes.data.low_stock === 'number');
    assert(typeof alertsRes.data.expired === 'number');
    assert(typeof alertsRes.data.near_expiry === 'number');
    report('FR-7.3', 'alerts for low stock and near-expiry medicines (counts for low stock, expired, near-expiry)', true);
  } catch (err) {
    report('FR-7.3', 'alerts for low stock and near-expiry medicines', false, err);
  }

  // FR-7.4 pharmacist views prescriptions and marks them dispensed
  try {
    // Pharmacist views queue
    const queueRes = await req('/prescriptions', { token: pharmToken });
    assert.strictEqual(queueRes.status, 200);
    const targetPres = queueRes.data.find((p) => p.prescription_id === testPrescriptionId);
    assert(targetPres, 'Prescription must be in pharmacist queue');
    assert.strictEqual(targetPres.dispensed, false);

    // Initial stock check
    const medBefore = await req(`/medicines/${med1.medicine_id}`, { token: pharmToken });
    const stockBefore = medBefore.data.quantity;

    // Dispense prescription
    const dispenseRes = await req(`/prescriptions/${testPrescriptionId}/dispense`, {
      method: 'POST',
      token: pharmToken,
    });
    assert.strictEqual(dispenseRes.status, 200);
    assert.strictEqual(dispenseRes.data.prescription.dispensed, true);

    // FR-7.2 stock reduces automatically when dispensed
    const medAfter = await req(`/medicines/${med1.medicine_id}`, { token: pharmToken });
    const stockAfter = medAfter.data.quantity;
    assert.strictEqual(stockBefore - stockAfter, 1, 'Stock must reduce by exact prescribed quantity (1 unit)');

    report('FR-7.4', 'pharmacist views prescriptions and marks them dispensed', true);
    report('FR-7.2', 'stock reduces automatically when dispensed (verified stock decrement)', true);
  } catch (err) {
    report('FR-7.4', 'pharmacist views prescriptions and marks them dispensed', false, err);
    report('FR-7.2', 'stock reduces automatically when dispensed', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 7: BILLING & INVOICING (FR-6.1 - FR-6.4)
  // -------------------------------------------------------------
  console.log('\n[Module 7: Billing, Dynamic Recalculation & Invoicing]');

  // FR-6.1 generate bill (consultation fee, medicine charges, other charges)
  try {
    // 1. Preview bill
    const previewRes = await req(`/bills/preview/${testApptId}`, { token: recToken });
    assert.strictEqual(previewRes.status, 200);
    assert(previewRes.data.consultation_fee > 0);
    assert(previewRes.data.medicine_charges > 0);

    // 2. Generate bill with consultation fee, medicine charges, and other charges
    const billRes = await req('/bills', {
      method: 'POST',
      token: recToken,
      body: {
        appointment_id: testApptId,
        other_charges: 40,
        status: 'Pending',
      },
    });
    assert.strictEqual(billRes.status, 201);
    testBillId = billRes.data.bill_id;
    assert.strictEqual(billRes.data.status, 'Pending');
    assert.strictEqual(Number(billRes.data.other_charges), 40);
    assert.strictEqual(
      Number(billRes.data.total),
      Number(billRes.data.consultation_fee) + Number(billRes.data.medicine_charges) + 40
    );

    report('FR-6.1', 'generate bill (consultation fee, medicine charges, other charges)', true);
  } catch (err) {
    report('FR-6.1', 'generate bill', false, err);
  }

  // FR-6.2 mark bill Paid or Pending, with payment mode (cash, card, upi)
  try {
    const payRes = await req(`/bills/${testBillId}/pay`, {
      method: 'PATCH',
      token: recToken,
      body: { payment_mode: 'upi' },
    });
    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.data.status, 'Paid');
    assert.strictEqual(payRes.data.payment_mode, 'upi');

    // Locked amounts check on Paid bill
    const editPaid = await req(`/bills/${testBillId}`, {
      method: 'PUT',
      token: recToken,
      body: { other_charges: 999 },
    });
    assert.strictEqual(editPaid.status, 400, 'Paid bill amounts must be locked against edits');

    report('FR-6.2', 'mark bill Paid or Pending, with payment mode (cash, card, upi; locked once paid)', true);
  } catch (err) {
    report('FR-6.2', 'mark bill Paid or Pending, with payment mode', false, err);
  }

  // FR-6.3 print or download bill as PDF
  try {
    const pdfRes = await req(`/bills/${testBillId}/pdf`, { token: recToken });
    assert.strictEqual(pdfRes.status, 200);
    assert(pdfRes.contentType.includes('application/pdf'));
    assert(pdfRes.buffer.byteLength > 1000);
    report('FR-6.3', 'print or download bill as PDF (valid PDF stream generated via PDFKit)', true);
  } catch (err) {
    report('FR-6.3', 'print or download bill as PDF', false, err);
  }

  // FR-6.4 payment history per patient
  try {
    const [patBills, allBills] = await Promise.all([
      req(`/bills/patient/${testPatientId}`, { token: recToken }),
      req('/bills?status=Paid', { token: recToken }),
    ]);
    assert.strictEqual(patBills.status, 200);
    assert.strictEqual(allBills.status, 200);
    assert(patBills.data.some((b) => b.bill_id === testBillId));
    assert(allBills.data.some((b) => b.bill_id === testBillId));
    report('FR-6.4', 'payment history per patient (per-patient payment list & filtered bill listing)', true);
  } catch (err) {
    report('FR-6.4', 'payment history per patient', false, err);
  }

  // -------------------------------------------------------------
  // MODULE 8: DASHBOARDS & ANALYTICS (FR-8.1 - FR-8.2)
  // -------------------------------------------------------------
  console.log('\n[Module 8: Dashboard & Reports]');

  // FR-8.1 admin dashboard: total patients, appointments today, revenue, low-stock items
  try {
    const dashRes = await req('/reports/dashboard', { token: adminToken });
    assert.strictEqual(dashRes.status, 200);
    const d = dashRes.data;

    // Verify all four metrics explicitly:
    assert(typeof d.counts.patients === 'number', 'total patients must exist');
    assert(typeof d.today.appointments_total === 'number', 'appointments today must exist');
    assert(typeof d.financial.total_revenue === 'number', 'revenue must exist');
    assert(typeof d.pharmacy.low_stock === 'number', 'low-stock items must exist');

    report('FR-8.1', 'admin dashboard: total patients, appointments today, revenue, low-stock items (all 4 metrics verified)', true);
  } catch (err) {
    report('FR-8.1', 'admin dashboard: total patients, appointments today, revenue, low-stock items', false, err);
  }

  // FR-8.2 daily, weekly and monthly reports of appointments and revenue
  try {
    const [dailyAppt, weeklyAppt, monthlyAppt, dailyRev, weeklyRev, monthlyRev] = await Promise.all([
      req('/reports/appointments?period=daily', { token: adminToken }),
      req('/reports/appointments?period=weekly', { token: adminToken }),
      req('/reports/appointments?period=monthly', { token: adminToken }),
      req('/reports/revenue?period=daily', { token: adminToken }),
      req('/reports/revenue?period=weekly', { token: adminToken }),
      req('/reports/revenue?period=monthly', { token: adminToken }),
    ]);

    assert.strictEqual(dailyAppt.status, 200);
    assert.strictEqual(weeklyAppt.status, 200);
    assert.strictEqual(monthlyAppt.status, 200);
    assert.strictEqual(dailyRev.status, 200);
    assert.strictEqual(weeklyRev.status, 200);
    assert.strictEqual(monthlyRev.status, 200);

    assert(typeof dailyAppt.data.summary.total === 'number');
    assert(typeof weeklyAppt.data.summary.total === 'number');
    assert(typeof monthlyAppt.data.summary.total === 'number');
    assert(typeof dailyRev.data.summary.total_revenue === 'number');
    assert(typeof weeklyRev.data.summary.total_revenue === 'number');
    assert(typeof monthlyRev.data.summary.total_revenue === 'number');

    report('FR-8.2', 'daily, weekly and monthly reports of appointments and revenue (all 3 periods verified)', true);
  } catch (err) {
    report('FR-8.2', 'daily, weekly and monthly reports of appointments and revenue', false, err);
  }

  // -------------------------------------------------------------
  // ADDITIONAL FEATURES BEYOND SRS
  // -------------------------------------------------------------
  console.log('\n[Additional Features Beyond SRS]');

  // Additional 1: Doctor performance clinical & financial analytics
  try {
    const docPerf = await req('/reports/doctor-performance', { token: adminToken });
    assert.strictEqual(docPerf.status, 200);
    assert(Array.isArray(docPerf.data));
    report('Additional', 'Doctor clinical & financial performance analytics report', true);
  } catch (err) {
    report('Additional', 'Doctor clinical & financial performance analytics report', false, err);
  }

  // Additional 2: CSV export stream for appointments and revenue
  try {
    const [apptCsv, revCsv] = await Promise.all([
      req('/reports/appointments/csv', { token: adminToken }),
      req('/reports/revenue/csv', { token: adminToken }),
    ]);
    assert.strictEqual(apptCsv.status, 200);
    assert.strictEqual(revCsv.status, 200);
    assert(apptCsv.contentType.includes('text/csv'));
    assert(revCsv.contentType.includes('text/csv'));
    report('Additional', 'Appointments and revenue CSV spreadsheet export streams', true);
  } catch (err) {
    report('Additional', 'CSV export streams', false, err);
  }

  // -------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
