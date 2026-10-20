# Hospital Management System (HMS) — Test Cases Specification

This document details the complete test suite covering Functional Requirements **FR-1 through FR-8**.

---

## 1. Traceability Matrix

| Requirement ID | Module | Test Case ID | Test Case Title | Status |
|---|---|---|---|---|
| **FR-1.1** | Auth | TC-AUTH-01 | Valid credentials authentication across all roles | **PASS** |
| **FR-1.1** | Auth | TC-AUTH-02 | Invalid credentials authentication rejection (401) | **PASS** |
| **FR-1.2 & 1.3** | Auth | TC-AUTH-03 | Role-based authorization & route protection (403) | **PASS** |
| **FR-1.4** | Staff | TC-AUTH-04 | Admin staff account creation, deactivation & reactivation | **PASS** |
| **FR-1.5** | Auth | TC-AUTH-05 | Token expiration and logout invalidation | **PASS** |
| **FR-2.1 & 2.2** | Patients | TC-PAT-01 | Patient registration with generated ID (`P-0001`) | **PASS** |
| **FR-2.3** | Patients | TC-PAT-02 | Patient search by full name, partial name, or phone | **PASS** |
| **FR-2.4** | Patients | TC-PAT-03 | Patient demographic editing & phone update | **PASS** |
| **FR-2.5** | Patients | TC-PAT-04 | Patient visit history listing | **PASS** |
| **FR-3.1** | Doctors | TC-DOC-01 | Doctor profile listing & specialization filter | **PASS** |
| **FR-3.2** | Doctors | TC-DOC-02 | Dynamic 30-minute availability slot generation | **PASS** |
| **FR-3.3** | Doctors | TC-DOC-03 | Weekly working days & hours schedule update | **PASS** |
| **FR-4.1** | Appointments | TC-APPT-01 | Appointment booking for an active free slot | **PASS** |
| **FR-4.2** | Appointments | TC-APPT-02 | Double-booking conflict rejection via partial unique index (409) | **PASS** |
| **FR-4.3** | Appointments | TC-APPT-03 | Appointment rescheduling to an open slot | **PASS** |
| **FR-4.4** | Appointments | TC-APPT-04 | Appointment cancellation and status change lock | **PASS** |
| **FR-5.1 & 5.2** | Consultations | TC-CONS-01 | Atomic consultation & prescription record creation | **PASS** |
| **FR-5.3** | Consultations | TC-CONS-02 | Single consultation per appointment enforcement | **PASS** |
| **FR-5.4** | Consultations | TC-CONS-03 | Diagnosis masking for non-doctors in patient visit history | **PASS** |
| **FR-6.1** | Billing | TC-BILL-01 | Bill preview calculation (Doctor Fee + Dispensed Medicines) | **PASS** |
| **FR-6.1** | Billing | TC-BILL-02 | Invoice generation with other charges and one-bill lock | **PASS** |
| **FR-6.1** | Billing | TC-BILL-03 | Pending bill creation and payment settlement (`PATCH /pay`) | **PASS** |
| **FR-6.3** | Billing | TC-BILL-04 | Per-patient payment & billing history | **PASS** |
| **FR-6.4** | Billing | TC-BILL-05 | Downloadable PDF invoice generation with PDFKit | **PASS** |
| **FR-7.1** | Pharmacy | TC-PHARM-01 | Medicine inventory CRUD with threshold alerts | **PASS** |
| **FR-7.2** | Pharmacy | TC-PHARM-02 | Pharmacist pending dispensing queue with live stock check | **PASS** |
| **FR-7.3** | Pharmacy | TC-PHARM-03 | Role security: Non-pharmacists blocked from editing medicines | **PASS** |
| **FR-7.4** | Pharmacy | TC-PHARM-04 | Atomic dispensing transaction with row-level locking (`FOR UPDATE`) | **PASS** |
| **FR-7.4** | Pharmacy | TC-PHARM-05 | Insufficient stock transaction rollback & double-dispensing prevention | **PASS** |
| **FR-8.1** | Reports | TC-REP-01 | Role-tailored dashboard metrics and counters | **PASS** |
| **FR-8.2** | Reports | TC-REP-02 | Appointments report with doctor breakdown & completion rates | **PASS** |
| **FR-8.2** | Reports | TC-REP-03 | Appointments CSV export stream | **PASS** |
| **FR-8.3** | Reports | TC-REP-04 | Revenue report with payment mode and daily collection trend | **PASS** |
| **FR-8.3** | Reports | TC-REP-05 | Revenue CSV export stream | **PASS** |
| **FR-8.3** | Reports | TC-REP-06 | Doctor clinical and financial performance report | **PASS** |

---

## 2. Test Cases Specification

### TC-AUTH-01: Valid User Login
- **Objective**: Verify that valid user credentials return a valid signed JWT containing role and user identity.
- **Preconditions**: User accounts seeded in database.
- **Input**:
  - `POST /api/auth/login` with `{ username: "admin", password: "admin123" }`
- **Expected Result**: HTTP `200 OK`, JSON `{ token: "<jwt>", user: { user_id, name, username, role: "admin" } }`.
- **Actual Result**: `200 OK` with valid JWT.
- **Status**: **PASS**

### TC-AUTH-02: Invalid Credentials Rejection
- **Objective**: Verify that wrong passwords or non-existent usernames are rejected.
- **Input**:
  - `POST /api/auth/login` with `{ username: "admin", password: "wrong" }`
- **Expected Result**: HTTP `401 Unauthorized`, JSON `{ error: "Invalid username or password." }`.
- **Actual Result**: `401 Unauthorized`.
- **Status**: **PASS**

### TC-AUTH-03: Role-Based Access Control Enforcement
- **Objective**: Ensure routes guarded by `requireRole` reject unauthorized roles.
- **Input**:
  - `GET /api/users` with Bearer token of role `receptionist`
- **Expected Result**: HTTP `403 Forbidden`, JSON `{ error: "Access denied." }`.
- **Actual Result**: `403 Forbidden`.
- **Status**: **PASS**

### TC-AUTH-04: Staff Account Management
- **Objective**: Admin creates, deactivates, and reactivates staff user accounts.
- **Input**:
  - `POST /api/users` with `{ name: "Front Staff", username: "staff_unique", role: "receptionist" }`
  - `PATCH /api/users/:id/status` with `{ status: "inactive" }`
  - `PATCH /api/users/:id/status` with `{ status: "active" }`
- **Expected Result**: HTTP `201 Created` for creation; HTTP `200 OK` for status changes with updated status.
- **Actual Result**: Correct account lifecycle states reflected in database.
- **Status**: **PASS**

---

### TC-PAT-01: Patient Registration & Formatted ID
- **Objective**: Verify patient registration stores demographic records and provides numeric primary key displayed as `P-0001`.
- **Input**:
  - `POST /api/patients` with demographic details (name, age, gender, phone, address, blood_group).
- **Expected Result**: HTTP `201 Created`, integer `patient_id`.
- **Actual Result**: `201 Created`, patient formatted as `P-000x`.
- **Status**: **PASS**

### TC-PAT-02: Patient Search
- **Objective**: Receptionists, doctors, and admins can search patients by name or phone substring.
- **Input**:
  - `GET /api/patients?q=Aarav`
- **Expected Result**: HTTP `200 OK`, array containing matching patient objects.
- **Actual Result**: Returns matching patients.
- **Status**: **PASS**

### TC-PAT-03: Patient Profile Update
- **Objective**: Update patient details (age, contact phone, address).
- **Input**:
  - `PUT /api/patients/:id` with updated demographics.
- **Expected Result**: HTTP `200 OK`, updated patient row returned.
- **Actual Result**: `200 OK`.
- **Status**: **PASS**

---

### TC-DOC-01: Doctor Profile & Specialization Listing
- **Objective**: List active doctors with optional specialization filtering.
- **Input**:
  - `GET /api/doctors?specialization=General`
- **Expected Result**: HTTP `200 OK`, array of doctors matching specialization with fee and availability.
- **Actual Result**: Matching doctors returned.
- **Status**: **PASS**

### TC-DOC-02: Dynamic 30-Minute Slot Generation
- **Objective**: Generate half-hour time slots for working days based on `availability` JSON configuration.
- **Input**:
  - `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
- **Expected Result**: HTTP `200 OK`, `{ working: true, slots: [{ time, available, booked, past }] }`.
- **Actual Result**: Generated accurate slots; non-working days marked `working: false`.
- **Status**: **PASS**

### TC-DOC-03: Doctor Schedule Availability Modification
- **Objective**: Doctor or admin updates weekly working days and hours.
- **Input**:
  - `PUT /api/doctors/:id` with `{ availability: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], start: "09:00", end: "13:00" } }`
- **Expected Result**: HTTP `200 OK`, updated availability stored as JSON.
- **Actual Result**: Updated schedule persists in DB.
- **Status**: **PASS**

---

### TC-APPT-01: Booking Appointment
- **Objective**: Book an appointment for a patient with a doctor at a designated slot.
- **Input**:
  - `POST /api/appointments` with `{ patient_id, doctor_id, date, time_slot }`
- **Expected Result**: HTTP `201 Created`, appointment status `Scheduled`.
- **Actual Result**: `201 Created`.
- **Status**: **PASS**

### TC-APPT-02: Conflict Detection & Double-Booking Prevention
- **Objective**: Ensure two active appointments cannot occupy the same doctor, date, and time slot.
- **Input**:
  - Two sequential `POST /api/appointments` requests for identical `doctor_id`, `date`, `time_slot`.
- **Expected Result**: First request returns `201 Created`; second returns HTTP `409 Conflict` via `uniq_active_slot` partial unique index.
- **Actual Result**: `409 Conflict` returned with message `"Doctor is already booked for this slot."`.
- **Status**: **PASS**

### TC-APPT-03: Appointment Rescheduling
- **Objective**: Reschedule an existing appointment to a new available time slot.
- **Input**:
  - `PATCH /api/appointments/:id/reschedule` with `{ date, time_slot }`
- **Expected Result**: HTTP `200 OK`, updated appointment date and slot.
- **Actual Result**: Slot updated.
- **Status**: **PASS**

### TC-APPT-04: Appointment Cancellation & Completion Lock
- **Objective**: Cancel an appointment or mark completed; completed appointments cannot be cancelled or rescheduled.
- **Input**:
  - `PATCH /api/appointments/:id/cancel`
  - Rescheduling a `Completed` appointment.
- **Expected Result**: Cancellation marks status `Cancelled` (freeing slot); modifying completed appointment returns `400 Bad Request`.
- **Actual Result**: Correctly enforces lifecycle lock.
- **Status**: **PASS**

---

### TC-CONS-01: Atomic Consultation & Prescription Creation
- **Objective**: Doctor records diagnosis, symptoms, notes, and prescribes medicines in a single database transaction while automatically updating the appointment to `Completed`.
- **Input**:
  - `POST /api/records` with `{ appointment_id, symptoms, diagnosis, notes, prescription: [...] }`
- **Expected Result**: HTTP `201 Created`, creates `medical_records`, `prescriptions`, `prescription_items`, and sets appointment status `Completed`.
- **Actual Result**: All tables atomically updated in one transaction.
- **Status**: **PASS**

### TC-CONS-02: One Record Per Appointment Enforcement
- **Objective**: Prevent duplicate consultations on the same appointment.
- **Input**:
  - Second `POST /api/records` for an appointment that has already been consulted.
- **Expected Result**: HTTP `400 Bad Request`.
- **Actual Result**: `400 Bad Request` rejected.
- **Status**: **PASS**

### TC-CONS-03: Medical Records Privacy & Masking
- **Objective**: Medical diagnoses must be masked for non-doctor roles in patient history.
- **Input**:
  - `GET /api/patients/:id` requested by receptionist vs doctor.
- **Expected Result**: Receptionist receives `diagnosis: null`; Doctor receives actual diagnosis string.
- **Actual Result**: Privacy strictly enforced.
- **Status**: **PASS**

---

### TC-BILL-01: Bill Preview Calculation
- **Objective**: Calculate doctor fee and dispensed medicine charges before generating bill.
- **Input**:
  - `GET /api/bills/preview/:appointment_id`
- **Expected Result**: HTTP `200 OK`, `{ consultation_fee, medicine_charges, prescription_items, suggested_total }`.
- **Actual Result**: Returns correct breakdown.
- **Status**: **PASS**

### TC-BILL-02: Invoice Generation & Single Bill Lock
- **Objective**: Generate bill, compute `total = fee + medicines + other_charges`, and enforce single bill per appointment.
- **Input**:
  - `POST /api/bills` with `{ appointment_id, other_charges, status: "Paid", payment_mode: "upi" }`
  - Second `POST /api/bills` for same appointment.
- **Expected Result**: First returns `201 Created`; second returns HTTP `409 Conflict`.
- **Actual Result**: `201 Created` followed by `409 Conflict`.
- **Status**: **PASS**

### TC-BILL-03: Pending Bill Payment Settlement
- **Objective**: Record payment for an outstanding pending bill.
- **Input**:
  - `PATCH /api/bills/:id/pay` with `{ payment_mode: "cash" }`
- **Expected Result**: HTTP `200 OK`, bill status changed to `Paid`.
- **Actual Result**: Updated to `Paid`.
- **Status**: **PASS**

### TC-BILL-04: Downloadable PDF Invoice Stream
- **Objective**: Generate and stream a formal hospital PDF invoice with PDFKit.
- **Input**:
  - `GET /api/bills/:id/pdf`
- **Expected Result**: HTTP `200 OK`, `Content-Type: application/pdf`, binary PDF buffer > 1KB.
- **Actual Result**: Valid PDF binary stream received.
- **Status**: **PASS**

---

### TC-PHARM-01: Pharmacy Stock CRUD & Threshold Alerts
- **Objective**: Pharmacist manages medicines with live alert tags for Low Stock, Near Expiry (&le;30d), and Expired.
- **Input**:
  - `GET /api/medicines/alerts`
  - `POST /api/medicines`, `PUT /api/medicines/:id`, `DELETE /api/medicines/:id`
- **Expected Result**: Accurate alert metrics; successful CRUD; doctor mutation attempts rejected with 403.
- **Actual Result**: Role protection and alerts verified.
- **Status**: **PASS**

### TC-PHARM-02: Atomic Dispensing & Stock Deductions
- **Objective**: Dispense prescription atomically, deduct stock, and lock inventory row to prevent concurrent race conditions.
- **Input**:
  - `POST /api/prescriptions/:id/dispense`
- **Expected Result**: HTTP `200 OK`, medicine quantities decremented in inventory, prescription marked `dispensed: true`.
- **Actual Result**: Atomic transaction verified.
- **Status**: **PASS**

### TC-PHARM-03: Insufficient Stock Rollback & Double-Dispense Lock
- **Objective**: If any medicine has insufficient stock, roll back entire dispense operation without deducting any items. Prevent double-dispensing.
- **Input**:
  - Dispense prescription requiring more units than available in stock.
  - Dispense already dispensed prescription.
- **Expected Result**: HTTP `400 Bad Request` with name of offending medicine; inventory untouched. Second attempt returns `400 Bad Request`.
- **Actual Result**: `400 Bad Request` with exact deficit details.
- **Status**: **PASS**

---

### TC-REP-01: Dashboard Role KPIs
- **Objective**: Return role-appropriate metrics for Admin, Doctor, Receptionist, and Pharmacist.
- **Input**:
  - `GET /api/reports/dashboard` under each role's token.
- **Expected Result**: HTTP `200 OK`, JSON payload containing relevant metrics per role.
- **Actual Result**: Validated for all 4 roles.
- **Status**: **PASS**

### TC-REP-02: Appointments & Revenue CSV Exports
- **Objective**: Export appointment and financial reports as RFC 4180 CSV spreadsheets.
- **Input**:
  - `GET /api/reports/appointments/csv`
  - `GET /api/reports/revenue/csv`
- **Expected Result**: HTTP `200 OK`, `Content-Type: text/csv`, header row + escaped data rows.
- **Actual Result**: Clean CSV streams validated.
- **Status**: **PASS**

### TC-REP-03: Doctor Performance Analytics
- **Objective**: Admin reviews clinical consultation volume and revenue generated per doctor.
- **Input**:
  - `GET /api/reports/doctor-performance`
- **Expected Result**: HTTP `200 OK`, array with doctor metrics and completion percentages.
- **Actual Result**: Correctly aggregated doctor performance metrics.
- **Status**: **PASS**
