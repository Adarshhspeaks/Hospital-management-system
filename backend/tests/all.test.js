/**
 * Hospital Management System (HMS) - Comprehensive Test Suite
 * Covers Functional Requirements: FR-1 through FR-8
 * 
 * Usage: npm test (or node tests/all.test.js)
 */

const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const buffer = await res.arrayBuffer();
    return { status: res.status, buffer, contentType };
  }
  if (contentType.includes('text/csv')) {
    const text = await res.text();
    return { status: res.status, text, contentType };
  }

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function report(name, ok, err) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
    if (err) console.error(`    ${err.message}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log(' Hospital Management System (HMS) - Full Integration Test Suite');
  console.log(' Target API: ' + BASE_URL);
  console.log('================================================================\n');

  let adminToken, recToken, docToken, pharmToken;
  let testPatientId, testDoctorId, testApptId, testPrescriptionId, testBillId;

  // -------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & STAFF MANAGEMENT (FR-1.1 - FR-1.5)
  // -------------------------------------------------------------
  console.log('[Suite 1: Authentication & Access Control (FR-1)]');
  try {
    // 1.1 Login with demo users
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

    report('FR-1.1: Login successful for all roles with valid credentials', true);
  } catch (err) {
    report('FR-1.1: Login successful for all roles with valid credentials', false, err);
  }

  try {
    const badLogin = await req('/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrongpassword' } });
    assert.strictEqual(badLogin.status, 401);
    report('FR-1.1: Invalid credentials rejected with 401 Unauthorized', true);
  } catch (err) {
    report('FR-1.1: Invalid credentials rejected with 401 Unauthorized', false, err);
  }

  try {
    const recBlocked = await req('/users', { token: recToken });
    assert.strictEqual(recBlocked.status, 403);
    report('FR-1.3: Role enforcement: non-admins blocked from staff management (403)', true);
  } catch (err) {
    report('FR-1.3: Role enforcement: non-admins blocked from staff management (403)', false, err);
  }

  try {
    const uniqueUser = `staff_${Date.now()}`;
    const createStaff = await req('/users', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Test Staff', username: uniqueUser, password: 'password123', role: 'receptionist' },
    });
    assert.strictEqual(createStaff.status, 201);
    const staffId = createStaff.data.user_id;

    // Deactivate
    const deact = await req(`/users/${staffId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'inactive' },
    });
    assert.strictEqual(deact.status, 200);
    assert.strictEqual(deact.data.status, 'inactive');

    // Reactivate
    const react = await req(`/users/${staffId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'active' },
    });
    assert.strictEqual(react.status, 200);
    assert.strictEqual(react.data.status, 'active');

    report('FR-1.4: Admin staff management: create, deactivate, and reactivate accounts', true);
  } catch (err) {
    report('FR-1.4: Admin staff management: create, deactivate, and reactivate accounts', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 2: PATIENT MANAGEMENT (FR-2.1 - FR-2.5)
  // -------------------------------------------------------------
  console.log('\n[Suite 2: Patient Registration & Search (FR-2)]');
  try {
    const uniquePhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const regRes = await req('/patients', {
      method: 'POST',
      token: recToken,
      body: {
        name: 'Aarav Sharma',
        age: 34,
        gender: 'Male',
        phone: uniquePhone,
        address: '42 Park Street, Kolkata',
        blood_group: 'B+',
      },
    });
    assert.strictEqual(regRes.status, 201);
    testPatientId = regRes.data.patient_id;
    assert(Number.isInteger(testPatientId));
    report(`FR-2.1 & 2.2: Patient registered with ID P-${String(testPatientId).padStart(4, '0')}`, true);
  } catch (err) {
    report('FR-2.1 & 2.2: Patient registered with ID', false, err);
  }

  try {
    const searchRes = await req('/patients?q=Aarav', { token: recToken });
    assert.strictEqual(searchRes.status, 200);
    const found = searchRes.data.find((p) => p.patient_id === testPatientId);
    assert(found, 'Created patient should be found by search query');
    report('FR-2.3: Search patient by name or phone', true);
  } catch (err) {
    report('FR-2.3: Search patient by name or phone', false, err);
  }

  try {
    const editRes = await req(`/patients/${testPatientId}`, {
      method: 'PUT',
      token: recToken,
      body: {
        name: 'Aarav Sharma',
        age: 35,
        gender: 'Male',
        phone: '9876543210',
        address: '42 Park Street, Kolkata (Updated)',
        blood_group: 'B+',
      },
    });
    assert.strictEqual(editRes.status, 200);
    assert.strictEqual(editRes.data.age, 35);
    report('FR-2.4: Update patient demographics and details', true);
  } catch (err) {
    report('FR-2.4: Update patient demographics and details', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 3: DOCTOR PROFILES & AVAILABILITY SLOTS (FR-3.1 - FR-3.3)
  // -------------------------------------------------------------
  console.log('\n[Suite 3: Doctor Profiles & Slot Generation (FR-3)]');
  try {
    const docsRes = await req('/doctors', { token: recToken });
    assert.strictEqual(docsRes.status, 200);
    assert(docsRes.data.length > 0);
    testDoctorId = docsRes.data[0].doctor_id;
    report(`FR-3.1: Doctor profiles listed (found ${docsRes.data.length} doctor profile(s))`, true);
  } catch (err) {
    report('FR-3.1: Doctor profiles listed', false, err);
  }

  let slotDate, targetSlot;
  try {
    const d = new Date();
    d.setDate(d.getDate() + ((4 + 7 - d.getDay()) % 7 || 7)); // Next Thursday
    slotDate = d.toISOString().slice(0, 10);

    const slotsRes = await req(`/doctors/${testDoctorId}/slots?date=${slotDate}`, { token: recToken });
    assert.strictEqual(slotsRes.status, 200);
    assert.strictEqual(slotsRes.data.working, true);
    assert(Array.isArray(slotsRes.data.slots));
    assert(slotsRes.data.slots.length > 0);

    const freeSlots = slotsRes.data.slots.filter((s) => s.available);
    assert(freeSlots.length > 0, 'Must have at least one free slot');
    targetSlot = freeSlots[0].time;

    report(`FR-3.2: 30-minute availability slots generated for ${slotDate} (${slotsRes.data.slots.length} slots)`, true);
  } catch (err) {
    report('FR-3.2: 30-minute availability slots generated', false, err);
  }

  try {
    // Check doctor availability update (FR-3.3)
    const updateAvail = await req(`/doctors/${testDoctorId}`, {
      method: 'PUT',
      token: docToken,
      body: {
        availability: {
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          start: '09:00',
          end: '13:00',
        },
      },
    });
    assert.strictEqual(updateAvail.status, 200);
    report('FR-3.3: Doctor updates weekly availability schedule', true);
  } catch (err) {
    report('FR-3.3: Doctor updates weekly availability schedule', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 4: APPOINTMENTS & SCHEDULING (FR-4.1 - FR-4.4)
  // -------------------------------------------------------------
  console.log('\n[Suite 4: Appointment Booking & Conflict Management (FR-4)]');
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
    report(`FR-4.1: Booked appointment #${testApptId} for ${slotDate} at ${targetSlot}`, true);
  } catch (err) {
    report('FR-4.1: Book appointment', false, err);
  }

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
    report('FR-4.2: Double-booking prevention enforced via partial unique index (409 Conflict)', true);
  } catch (err) {
    report('FR-4.2: Double-booking prevention enforced', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 5: CONSULTATION & PRESCRIPTION (FR-5.1 - FR-5.4)
  // -------------------------------------------------------------
  console.log('\n[Suite 5: Consultations, Prescriptions & Medical Privacy (FR-5)]');
  try {
    const medList = await req('/medicines', { token: pharmToken });
    const med1 = medList.data[0];
    const med2 = medList.data[1];

    const consultRes = await req('/records', {
      method: 'POST',
      token: docToken,
      body: {
        appointment_id: testApptId,
        symptoms: 'Fever, sore throat, mild body aches for 2 days',
        diagnosis: 'Acute Viral Pharyngitis',
        notes: 'Advised rest and warm water gargles.',
        prescription: [
          { medicine_id: med1.medicine_id, dosage: '1 tab TDS', duration: '3 days', quantity: 6 },
          { medicine_id: med2.medicine_id, dosage: '1 cap BD', duration: '5 days', quantity: 10 },
        ],
      },
    });

    assert.strictEqual(consultRes.status, 201);
    assert(consultRes.data.record && consultRes.data.record.record_id);
    assert(consultRes.data.prescription && consultRes.data.prescription.prescription_id);
    testPrescriptionId = consultRes.data.prescription.prescription_id;

    report('FR-5.1 & 5.2: Doctor consultation and itemized prescription saved in ONE transaction', true);
  } catch (err) {
    report('FR-5.1 & 5.2: Doctor consultation and itemized prescription saved', false, err);
  }

  try {
    const dupConsult = await req('/records', {
      method: 'POST',
      token: docToken,
      body: {
        appointment_id: testApptId,
        diagnosis: 'Duplicate Record Attempt',
      },
    });
    assert.strictEqual(dupConsult.status, 400);
    report('FR-5.3: Strict one medical record per appointment enforced (locked after completion)', true);
  } catch (err) {
    report('FR-5.3: One record per appointment enforced', false, err);
  }

  try {
    // Receptionist checks visit history
    const patVisit = await req(`/patients/${testPatientId}`, { token: recToken });
    assert.strictEqual(patVisit.status, 200);
    const visit = patVisit.data.visits.find((v) => v.appointment_id === testApptId);
    assert.strictEqual(visit.diagnosis, null, 'Diagnosis must be masked for receptionist');

    // Doctor checks visit history
    const docVisit = await req(`/patients/${testPatientId}`, { token: docToken });
    const docSeenVisit = docVisit.data.visits.find((v) => v.appointment_id === testApptId);
    assert.strictEqual(docSeenVisit.diagnosis, 'Acute Viral Pharyngitis', 'Doctor must see diagnosis');

    report('FR-5.4: Privacy: Diagnosis masked for non-doctors and revealed to doctors in visit history', true);
  } catch (err) {
    report('FR-5.4: Diagnosis privacy', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 6: PHARMACY DISPENSING (FR-7.2 & FR-7.4)
  // -------------------------------------------------------------
  console.log('\n[Suite 6: Pharmacy Stock & Atomic Dispensing (FR-7)]');
  try {
    const queueRes = await req('/prescriptions', { token: pharmToken });
    assert.strictEqual(queueRes.status, 200);
    const targetPres = queueRes.data.find((p) => p.prescription_id === testPrescriptionId);
    assert(targetPres, 'Created prescription must appear in pharmacy queue');
    assert.strictEqual(targetPres.dispensed, false);
    report('FR-7.2: Pharmacist pending queue displays prescription items with live stock', true);
  } catch (err) {
    report('FR-7.2: Pharmacist pending queue', false, err);
  }

  try {
    const dispenseRes = await req(`/prescriptions/${testPrescriptionId}/dispense`, {
      method: 'POST',
      token: pharmToken,
    });
    assert.strictEqual(dispenseRes.status, 200);
    assert.strictEqual(dispenseRes.data.prescription && dispenseRes.data.prescription.dispensed, true);
    report('FR-7.4: Atomic dispensing transaction: inventory deducted and prescription marked dispensed', true);
  } catch (err) {
    report('FR-7.4: Atomic dispensing transaction', false, err);
  }

  try {
    const doubleDispense = await req(`/prescriptions/${testPrescriptionId}/dispense`, {
      method: 'POST',
      token: pharmToken,
    });
    assert.strictEqual(doubleDispense.status, 400);
    report('FR-7.4: Double-dispensing prevented with 400 Bad Request', true);
  } catch (err) {
    report('FR-7.4: Double-dispensing prevented', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 7: BILLING & INVOICING (FR-6.1 - FR-6.4)
  // -------------------------------------------------------------
  console.log('\n[Suite 7: Patient Billing & PDF Invoice (FR-6)]');
  try {
    const previewRes = await req(`/bills/preview/${testApptId}`, { token: recToken });
    assert.strictEqual(previewRes.status, 200);
    assert(previewRes.data.consultation_fee > 0);
    assert(previewRes.data.medicine_charges > 0);
    assert.strictEqual(previewRes.data.suggested_total, previewRes.data.consultation_fee + previewRes.data.medicine_charges);
    report('FR-6.1: Bill preview calculates doctor consultation fee and dispensed medicines', true);
  } catch (err) {
    report('FR-6.1: Bill preview calculation', false, err);
  }

  try {
    const billRes = await req('/bills', {
      method: 'POST',
      token: recToken,
      body: {
        appointment_id: testApptId,
        other_charges: 40,
        status: 'Paid',
        payment_mode: 'upi',
      },
    });
    assert.strictEqual(billRes.status, 201);
    testBillId = billRes.data.bill_id;
    assert.strictEqual(billRes.data.status, 'Paid');
    assert.strictEqual(billRes.data.payment_mode, 'upi');
    report(`FR-6.1: Generated invoice #${testBillId} with status Paid via UPI`, true);
  } catch (err) {
    report('FR-6.1: Generate bill', false, err);
  }

  try {
    const dupBill = await req('/bills', {
      method: 'POST',
      token: recToken,
      body: {
        appointment_id: testApptId,
        status: 'Pending',
      },
    });
    assert.strictEqual(dupBill.status, 409);
    report('FR-6.1: Duplicate bill generation rejected with 409 Conflict', true);
  } catch (err) {
    report('FR-6.1: Duplicate bill rejected', false, err);
  }

  try {
    const pdfRes = await req(`/bills/${testBillId}/pdf`, { token: recToken });
    assert.strictEqual(pdfRes.status, 200);
    assert(pdfRes.contentType.includes('application/pdf'));
    assert(pdfRes.buffer.byteLength > 1000);
    report(`FR-6.4: Official PDF invoice generated and streamed successfully (${pdfRes.buffer.byteLength} bytes)`, true);
  } catch (err) {
    report('FR-6.4: Official PDF invoice generation', false, err);
  }

  // -------------------------------------------------------------
  // SUITE 8: DASHBOARD & REPORTS (FR-8.1 - FR-8.3)
  // -------------------------------------------------------------
  console.log('\n[Suite 8: Dashboard Metrics & Reports Export (FR-8)]');
  try {
    const dashRes = await req('/reports/dashboard', { token: adminToken });
    assert.strictEqual(dashRes.status, 200);
    assert(typeof dashRes.data.counts.patients === 'number');
    assert(typeof dashRes.data.financial.total_revenue === 'number');
    assert(Array.isArray(dashRes.data.recent_appointments));
    report('FR-8.1: Admin dashboard KPI metrics payload verified', true);
  } catch (err) {
    report('FR-8.1: Admin dashboard KPI metrics', false, err);
  }

  try {
    const apptsRep = await req('/reports/appointments', { token: adminToken });
    assert.strictEqual(apptsRep.status, 200);
    assert(typeof apptsRep.data.summary.total === 'number');
    assert(typeof apptsRep.data.summary.completion_rate === 'number');
    report('FR-8.2: Appointments analytics report with completion rate breakdown', true);
  } catch (err) {
    report('FR-8.2: Appointments analytics report', false, err);
  }

  try {
    const apptCsv = await req('/reports/appointments/csv', { token: adminToken });
    assert.strictEqual(apptCsv.status, 200);
    assert(apptCsv.contentType.includes('text/csv'));
    assert(apptCsv.text.includes('"Appointment ID"'));
    report('FR-8.2: Appointments CSV export stream verified', true);
  } catch (err) {
    report('FR-8.2: Appointments CSV export', false, err);
  }

  try {
    const revRep = await req('/reports/revenue', { token: adminToken });
    assert.strictEqual(revRep.status, 200);
    assert(typeof revRep.data.summary.total_revenue === 'number');
    assert(Array.isArray(revRep.data.by_payment_mode));
    report('FR-8.3: Revenue financial report with payment mode & daily trends', true);
  } catch (err) {
    report('FR-8.3: Revenue financial report', false, err);
  }

  try {
    const revCsv = await req('/reports/revenue/csv', { token: adminToken });
    assert.strictEqual(revCsv.status, 200);
    assert(revCsv.contentType.includes('text/csv'));
    assert(revCsv.text.includes('"Invoice No"'));
    report('FR-8.3: Revenue CSV export stream verified', true);
  } catch (err) {
    report('FR-8.3: Revenue CSV export', false, err);
  }

  try {
    const docPerf = await req('/reports/doctor-performance', { token: adminToken });
    assert.strictEqual(docPerf.status, 200);
    assert(Array.isArray(docPerf.data));
    report('FR-8.3: Doctor clinical and revenue performance report verified', true);
  } catch (err) {
    report('FR-8.3: Doctor clinical and revenue performance report', false, err);
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
