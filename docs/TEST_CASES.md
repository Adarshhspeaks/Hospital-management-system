# Hospital Management System (HMS) — Test Cases Specification

This document defines the formal test specifications for all Functional Requirements (**FR-1.1 through FR-8.2**) based on the authoritative Software Requirements Specification (SRS), followed by test cases for additional system enhancements.

---

## 1. SRS Traceability & Test Coverage Matrix

| SRS Requirement ID | Requirement Description | Test Identifier | Module | Status |
|---|---|---|---|:---:|
| **FR-1.1** | Login with username and password | `TC-FR-1.1-01`<br>`TC-FR-1.1-02` | Auth | **PASS** |
| **FR-1.2** | Every account has one role (admin, doctor, receptionist, pharmacist) | `TC-FR-1.2-01` | Auth | **PASS** |
| **FR-1.3** | Pages and API routes restricted by role (403 Forbidden for unauthorized roles) | `TC-FR-1.3-01` | Auth | **PASS** |
| **FR-1.4** | Admin creates, edits and deactivates staff accounts (with password reset) | `TC-FR-1.4-01` | Staff | **PASS** |
| **FR-1.5** | Logout, and sessions end after a set time | `TC-FR-1.5-01` | Auth | **PASS** |
| **FR-2.1** | Register patient (name, age, gender, contact, address, blood group) | `TC-FR-2.1-01` | Patients | **PASS** |
| **FR-2.2** | Unique patient ID generated (`P-XXXX`) | `TC-FR-2.2-01` | Patients | **PASS** |
| **FR-2.3** | Search patients by ID, name or phone | `TC-FR-2.3-01` | Patients | **PASS** |
| **FR-2.4** | Receptionist updates patient details | `TC-FR-2.4-01` | Patients | **PASS** |
| **FR-2.5** | Visit history per patient | `TC-FR-2.5-01` | Patients | **PASS** |
| **FR-3.1** | Admin adds and edits doctor profiles (specialization, qualification, fee) | `TC-FR-3.1-01` | Doctors | **PASS** |
| **FR-3.2** | Weekly availability slots set by admin or the doctor | `TC-FR-3.2-01` | Doctors | **PASS** |
| **FR-3.3** | List doctors filtered by specialization and availability | `TC-FR-3.3-01` | Doctors | **PASS** |
| **FR-4.1** | Book appointment (patient, doctor, date, slot) | `TC-FR-4.1-01` | Appointments | **PASS** |
| **FR-4.2** | Prevent double-booking (409 Conflict via partial unique index) | `TC-FR-4.2-01` | Appointments | **PASS** |
| **FR-4.3** | Reschedule and cancel appointments | `TC-FR-4.3-01` | Appointments | **PASS** |
| **FR-4.4** | Doctor sees a daily list of their own appointments | `TC-FR-4.4-01` | Appointments | **PASS** |
| **FR-4.5** | Status tracking: Scheduled, Completed, Cancelled, No-show | `TC-FR-4.5-01` | Appointments | **PASS** |
| **FR-5.1** | Doctor records symptoms, diagnosis, notes | `TC-FR-5.1-01` | Clinical Records | **PASS** |
| **FR-5.2** | Doctor writes a prescription (medicine, dosage, duration, quantity) | `TC-FR-5.2-01` | Clinical Records | **PASS** |
| **FR-5.3** | Doctor can view a patient's previous records | `TC-FR-5.3-01` | Clinical Records | **PASS** |
| **FR-5.4** | Records visible only to authorized staff (masking & 403 route restriction) | `TC-FR-5.4-01` | Privacy & RBAC | **PASS** |
| **FR-6.1** | Generate bill (consultation fee, medicine charges, other charges) | `TC-FR-6.1-01` | Billing | **PASS** |
| **FR-6.2** | Mark bill Paid or Pending, with payment mode (cash, card, upi; locked once paid) | `TC-FR-6.2-01` | Billing | **PASS** |
| **FR-6.3** | Print or download bill as PDF | `TC-FR-6.3-01` | Billing | **PASS** |
| **FR-6.4** | Payment history per patient (per-patient payment list & filtered bill listing) | `TC-FR-6.4-01` | Billing | **PASS** |
| **FR-7.1** | Pharmacist adds, updates and removes medicines (quantity, price, expiry) | `TC-FR-7.1-01` | Pharmacy | **PASS** |
| **FR-7.2** | Stock reduces automatically when dispensed | `TC-FR-7.2-01` | Pharmacy | **PASS** |
| **FR-7.3** | Alerts for low stock and near-expiry medicines | `TC-FR-7.3-01` | Pharmacy | **PASS** |
| **FR-7.4** | Pharmacist views prescriptions and marks them dispensed | `TC-FR-7.4-01` | Pharmacy | **PASS** |
| **FR-8.1** | Admin dashboard: total patients, appointments today, revenue, low-stock items | `TC-FR-8.1-01` | Dashboard | **PASS** |
| **FR-8.2** | Daily, weekly and monthly reports of appointments and revenue | `TC-FR-8.2-01` | Reports | **PASS** |

---

## 2. Test Specifications by SRS Requirement

### FR-1.1: Login with Username and Password
- **Test ID**: `TC-FR-1.1-01` (Authentication Validation)
  - **Endpoint**: `POST /api/auth/login`
  - **Inputs**: Valid credentials for each role (`admin`, `doctor`, `receptionist`, `pharmacist`) and invalid credentials (`wrong_pw`).
  - **Expected Result**: HTTP `200 OK` with signed JWT and profile payload for valid users; HTTP `401 Unauthorized` for bad credentials.
- **Test ID**: `TC-FR-1.1-02` (Security Headers & Rate Limiting)
  - **Inputs**: 11 rapid authentication attempts against `POST /api/auth/login`.
  - **Expected Result**: Helmet security headers present (`x-content-type-options: nosniff`); 11th request triggers HTTP `429 Too Many Requests`.

### FR-1.2: Account Role Assignment
- **Test ID**: `TC-FR-1.2-01`
  - **Endpoint**: `POST /api/auth/login`
  - **Verification**: Each returned token decode contains exactly one assigned role in `['admin', 'doctor', 'receptionist', 'pharmacist']` enforced by database enum check `role IN (...)`.

### FR-1.3: Role-Restricted Pages & API Routes
- **Test ID**: `TC-FR-1.3-01`
  - **Endpoints**: `GET /api/users`, `GET /api/reports/dashboard`, `POST /api/records`
  - **Inputs**: Requests executed with tokens of unauthorized roles (e.g. receptionist querying staff users or admin dashboard; receptionist accessing clinical records).
  - **Expected Result**: HTTP `403 Forbidden` (`{ "error": "Access denied. Required role: ..." }`).

### FR-1.4: Staff Account Lifecycle (Create, Edit, Password Reset, Deactivate)
- **Test ID**: `TC-FR-1.4-01`
  - **Endpoints**: `POST /api/users`, `PUT /api/users/:id`, `PATCH /api/users/:id/status`
  - **Inputs**: Admin creates `staff_test_lifecycle`, edits name and role, resets password, toggles deactivation to `inactive`, attempts login (rejected `401`), and reactivates to `active`.
  - **Expected Result**: HTTP `201 Created` on creation, `200 OK` on edit/password reset, `200 OK` on status toggle. Deactivated account rejected during authentication. Deletion is explicitly prevented to maintain audit integrity.

### FR-1.5: Logout & Session Expiration
- **Test ID**: `TC-FR-1.5-01`
  - **Endpoints**: `GET /api/auth/me`
  - **Inputs**: Valid token verification, followed by token tampering and client-side credential purge.
  - **Expected Result**: `200 OK` for valid session; `401 Unauthorized` for invalid or expired token signature.

### FR-2.1: Patient Registration
- **Test ID**: `TC-FR-2.1-01`
  - **Endpoint**: `POST /api/patients`
  - **Inputs**: Payload containing `name`, `age`, `gender`, `phone`, `address`, and `blood_group`.
  - **Expected Result**: HTTP `201 Created` returning the inserted record matching all fields.

### FR-2.2: Unique Patient ID Generation
- **Test ID**: `TC-FR-2.2-01`
  - **Verification**: Primary key sequence integer generated by PostgreSQL, formatted in UI and reports as `P-XXXX` (e.g., `P-0011`).

### FR-2.3: Patient Search
- **Test ID**: `TC-FR-2.3-01`
  - **Endpoint**: `GET /api/patients?q=<query>`
  - **Inputs**: Query by patient ID number (`"11"` or `"P-0011"`), full/partial name (`"Aarav"`), and phone number (`"9812345678"`).
  - **Expected Result**: HTTP `200 OK` returning an array containing the matched patient record.

### FR-2.4: Receptionist Updates Patient Details
- **Test ID**: `TC-FR-2.4-01`
  - **Endpoint**: `PUT /api/patients/:id`
  - **Inputs**: Receptionist submits updated demographic and contact fields (`age: 35`, `phone: "9812349999"`).
  - **Expected Result**: HTTP `200 OK` with updated patient attributes.

### FR-2.5: Patient Visit History
- **Test ID**: `TC-FR-2.5-01`
  - **Endpoint**: `GET /api/patients/:id`
  - **Expected Result**: HTTP `200 OK` containing patient profile and a `visits` array populated with past appointment records, dates, attending doctors, and statuses.

### FR-3.1: Doctor Profiles (Add and Edit)
- **Test ID**: `TC-FR-3.1-01`
  - **Endpoints**: `GET /api/doctors`, `PUT /api/doctors/:id`
  - **Inputs**: Admin updates doctor `specialization`, `qualification`, and consultation `fee` (`550`).
  - **Expected Result**: HTTP `200 OK` returning updated profile; non-admin prohibited from profile mutations.

### FR-3.2: Weekly Availability Slots
- **Test ID**: `TC-FR-3.2-01`
  - **Endpoints**: `PUT /api/doctors/:id`, `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
  - **Inputs**: Doctor or admin configures working days (`Mon-Sat`) and shift (`09:00 - 17:00`).
  - **Expected Result**: HTTP `200 OK` on update; `/slots` returns dynamic 30-minute availability slots with active booking flags.

### FR-3.3: Doctor Filtering by Specialization and Availability
- **Test ID**: `TC-FR-3.3-01`
  - **Endpoint**: `GET /api/doctors?specialization=General+Medicine`
  - **Expected Result**: HTTP `200 OK` returning doctors matching the requested specialization.

### FR-4.1: Book Appointment
- **Test ID**: `TC-FR-4.1-01`
  - **Endpoint**: `POST /api/appointments`
  - **Inputs**: Receptionist books `{ patient_id, doctor_id, date, time_slot }`.
  - **Expected Result**: HTTP `201 Created` with `status: "Scheduled"` and assigned `appointment_id`.

### FR-4.2: Prevent Double-Booking
- **Test ID**: `TC-FR-4.2-01`
  - **Endpoint**: `POST /api/appointments`
  - **Inputs**: Attempt to book the exact same `(doctor_id, date, time_slot)` while an active appointment exists.
  - **Expected Result**: HTTP `409 Conflict` enforced by partial unique index `idx_unique_active_appointment`.

### FR-4.3: Reschedule and Cancel Appointments
- **Test ID**: `TC-FR-4.3-01`
  - **Endpoints**: `PUT /api/appointments/:id`, `PATCH /api/appointments/:id/cancel`
  - **Inputs**: Reschedule active appointment to a different time slot; cancel active appointment.
  - **Expected Result**: HTTP `200 OK` with updated slot on reschedule; HTTP `200 OK` with `status: "Cancelled"` on cancel.

### FR-4.4: Doctor Daily Appointment List
- **Test ID**: `TC-FR-4.4-01`
  - **Endpoint**: `GET /api/appointments?doctor_id=:id&date=YYYY-MM-DD`
  - **Expected Result**: HTTP `200 OK` returning only appointments scheduled for the requesting doctor on the selected date.

### FR-4.5: Status Tracking (Scheduled, Completed, Cancelled, No-show)
- **Test ID**: `TC-FR-4.5-01`
  - **Endpoints**: `PATCH /api/appointments/:id/status`
  - **Inputs**: Direct attempt by doctor to set `status = 'Completed'` (rejected with HTTP `400`); doctor sets `status = 'No-show'` (accepted with HTTP `200`).
  - **Expected Result**: `Completed` is strictly locked to consultation completion; `No-show` is permitted.

### FR-5.1: Doctor Records Symptoms, Diagnosis, Notes
- **Test ID**: `TC-FR-5.1-01`
  - **Endpoint**: `POST /api/records`
  - **Inputs**: Attending doctor submits clinical record for scheduled appointment.
  - **Expected Result**: HTTP `201 Created`, record linked to `appointment_id`, and appointment status advances to `Completed`.

### FR-5.2: Doctor Writes Prescription
- **Test ID**: `TC-FR-5.2-01`
  - **Endpoint**: `POST /api/records`
  - **Inputs**: Nested `prescription` array with `medicine_id`, `dosage`, `duration`, and `quantity`.
  - **Expected Result**: Atomic creation of `prescriptions` header and `prescription_items` rows in the same transaction.

### FR-5.3: Doctor Views Patient's Previous Records
- **Test ID**: `TC-FR-5.3-01`
  - **Endpoint**: `GET /api/records/patient/:patient_id`
  - **Expected Result**: HTTP `200 OK` returning chronological clinical records with full symptoms, diagnosis, and prescription details.

### FR-5.4: Records Privacy & RBAC Enforcement
- **Test ID**: `TC-FR-5.4-01`
  - **Endpoints**: `GET /api/records/patient/:patient_id`, `GET /api/patients/:patient_id`
  - **Inputs**: Receptionist requests clinical records endpoint (HTTP `403 Forbidden`); receptionist views patient profile (diagnosis masked as `null`); doctor views patient profile (diagnosis unmasked).
  - **Expected Result**: Confidential clinical details visible only to authorized physicians.

### FR-6.1: Bill Generation (Fee, Medicines, Other Charges)
- **Test ID**: `TC-FR-6.1-01`
  - **Endpoints**: `GET /api/bills/preview/:appointment_id`, `POST /api/bills`
  - **Inputs**: Preview calculated charges; generate bill with `other_charges: 40`.
  - **Expected Result**: HTTP `201 Created` with `total = consultation_fee + medicine_charges + other_charges`.

### FR-6.2: Mark Bill Paid/Pending with Payment Mode
- **Test ID**: `TC-FR-6.2-01`
  - **Endpoints**: `PATCH /api/bills/:id/pay`, `PUT /api/bills/:id`
  - **Inputs**: Settle bill with `payment_mode: 'upi'`; attempt to modify charges after settlement.
  - **Expected Result**: HTTP `200 OK` transitioning bill to `status: 'Paid'`; subsequent edit attempt rejected with HTTP `400 Bad Request` (financial lock).

### FR-6.3: Print or Download Bill as PDF
- **Test ID**: `TC-FR-6.3-01`
  - **Endpoint**: `GET /api/bills/:id/pdf`
  - **Expected Result**: HTTP `200 OK` returning `application/pdf` binary stream with valid PDF header (`%PDF-1.3`).

### FR-6.4: Payment History per Patient
- **Test ID**: `TC-FR-6.4-01`
  - **Endpoints**: `GET /api/bills/patient/:patient_id`, `GET /api/bills?status=Paid`
  - **Expected Result**: HTTP `200 OK` returning list of bills and payment receipts filtered by patient.

### FR-7.1: Medicine Inventory Add, Update, Remove
- **Test ID**: `TC-FR-7.1-01`
  - **Endpoints**: `POST /api/medicines`, `PUT /api/medicines/:id`, `DELETE /api/medicines/:id`
  - **Inputs**: Pharmacist adds medicine, updates quantity/price/threshold, and deletes unreferenced item; doctor blocked with `403`.
  - **Expected Result**: HTTP `201 Created`, `200 OK` on update, `200 OK` on delete; non-pharmacist blocked with `403`.

### FR-7.2: Automatic Stock Reduction upon Dispensing
- **Test ID**: `TC-FR-7.2-01`
  - **Endpoints**: `POST /api/prescriptions/:id/dispense`, `GET /api/medicines/:id`
  - **Expected Result**: Exact atomic decrement of medicine stock matching prescribed quantity via database row-level locking (`FOR UPDATE`).

### FR-7.3: Alerts for Low Stock & Near-Expiry Medicines
- **Test ID**: `TC-FR-7.3-01`
  - **Endpoint**: `GET /api/medicines/alerts`
  - **Expected Result**: HTTP `200 OK` returning categorized alert counts for `low_stock`, `near_expiry` (within 30 days), and `expired`.

### FR-7.4: Pharmacist Views Prescriptions & Marks Dispensed
- **Test ID**: `TC-FR-7.4-01`
  - **Endpoints**: `GET /api/prescriptions`, `POST /api/prescriptions/:id/dispense`
  - **Expected Result**: Prescriptions listed in pending queue (`dispensed: false`); dispensing updates `dispensed: true` and sets `dispensed_at`.

### FR-8.1: Admin Dashboard Four Core Metrics
- **Test ID**: `TC-FR-8.1-01`
  - **Endpoint**: `GET /api/reports/dashboard`
  - **Verification**: Verifies all four mandatory metrics in payload:
    1. `counts.patients` (Total registered patients)
    2. `today.appointments_total` (Appointments scheduled for today)
    3. `financial.total_revenue` (Total collected hospital revenue)
    4. `pharmacy.low_stock` (Count of inventory items at or below threshold)

### FR-8.2: Daily, Weekly, and Monthly Reports
- **Test ID**: `TC-FR-8.2-01`
  - **Endpoints**:
    - `GET /api/reports/appointments?period=daily|weekly|monthly`
    - `GET /api/reports/revenue?period=daily|weekly|monthly`
  - **Verification**: Validates appointment volume and revenue breakdown across all three calendar intervals (`daily`, `weekly`, and `monthly`).

---

## 3. Additional Features Beyond the SRS

The following enhancements provide clinical and operational capabilities exceeding the baseline SRS requirements:

### ADD-01: Doctor Performance Clinical & Financial Analytics
- **Test ID**: `TC-ADD-01`
  - **Endpoint**: `GET /api/reports/doctor-performance`
  - **Scope**: Comprehensive reporting per doctor including total consultations, completed appointment percentage, consultation revenue generated, and pharmacy prescription revenue generated.
  - **Status**: **PASS**

### ADD-02: Appointments & Revenue CSV Spreadsheet Export Streams
- **Test ID**: `TC-ADD-02`
  - **Endpoints**: `GET /api/reports/appointments/csv`, `GET /api/reports/revenue/csv`
  - **Scope**: RFC-4180 compliant CSV streams with appropriate `Content-Disposition: attachment; filename=...` headers for external spreadsheet analysis and finance audits.
  - **Status**: **PASS**

### ADD-03: Editable Other Charges on Pending Bills
- **Test ID**: `TC-ADD-03`
  - **Endpoint**: `PUT /api/bills/:id`
  - **Scope**: Allows receptionists to update miscellaneous hospital charges (e.g. lab fees, nursing fees) while a bill is in `Pending` status. Automatically locks once the bill transitions to `Paid`.
  - **Status**: **PASS**

### ADD-04: Out-of-Stock Status Badges & Depletion Indicator
- **Test ID**: `TC-ADD-04`
  - **Scope**: UI badge in Pharmacy view highlighting medicines with `quantity = 0` ("Out of Stock") separately from low-stock items (`0 < quantity <= threshold`).
  - **Status**: **PASS**

### ADD-05: Login Quick-Fill Demonstration Buttons
- **Test ID**: `TC-ADD-05`
  - **Scope**: One-click credential autofill buttons on the login page for evaluator roles (`Admin`, `Doctor`, `Receptionist`, `Pharmacist`) enabling rapid role-switching during demos.
  - **Status**: **PASS**
