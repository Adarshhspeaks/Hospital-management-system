# Hospital Management System (HMS) — API Reference

Base URL: `http://localhost:5000/api`

All API endpoints return JSON responses with standard HTTP status codes:
- `200 OK` / `201 Created`: Request succeeded.
- `400 Bad Request`: Validation failure (`{ "error": "plain-English description" }`).
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Insufficient role permissions.
- `404 Not Found`: Entity does not exist.
- `409 Conflict`: Business logic or constraint conflict (e.g. double booking, duplicate bill).
- `429 Too Many Requests`: Rate limit threshold exceeded.

---

## Authentication Header

Protected endpoints require an `Authorization` header containing a signed JSON Web Token (JWT):
```http
Authorization: Bearer <jwt_token>
```

---

## 1. Authentication & Staff Management (FR-1.1 – FR-1.5)

### `POST /api/auth/login`
- **SRS Requirement**: **FR-1.1**, **FR-1.2**, **FR-1.5**
- **Roles**: Public (Rate limited to 10 attempts per 15 minutes per IP)
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "user_id": 1,
      "name": "System Admin",
      "username": "admin",
      "role": "admin"
    }
  }
  ```

### `GET /api/auth/me`
- **SRS Requirement**: **FR-1.5**
- **Roles**: Authenticated users (`admin`, `doctor`, `receptionist`, `pharmacist`)
- **Response `200 OK`**: User profile decoded from JWT.

### `GET /api/users`
- **SRS Requirement**: **FR-1.3**, **FR-1.4**
- **Roles**: `admin`
- **Response `200 OK`**: Array of staff user objects (`user_id`, `name`, `username`, `role`, `status`, `created_at`).

### `POST /api/users`
- **SRS Requirement**: **FR-1.4**
- **Roles**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Sarah Connor",
    "username": "sconnor",
    "password": "securepassword",
    "role": "receptionist"
  }
  ```
- **Response `201 Created`**: Newly created user object.

### `PUT /api/users/:id`
- **SRS Requirement**: **FR-1.4**
- **Roles**: `admin`
- **Description**: Allows admin to update staff member's name and role, and optionally reset their password. (Account deletion is prohibited to preserve audit trail).
- **Request Body**:
  ```json
  {
    "name": "Sarah Connor-Reese",
    "role": "receptionist",
    "password": "newSecurePassword123"
  }
  ```
- **Response `200 OK`**: Updated user object without password hash.

### `PATCH /api/users/:id/status`
- **SRS Requirement**: **FR-1.4**
- **Roles**: `admin`
- **Request Body**: `{ "status": "inactive" }` or `{ "status": "active" }`
- **Response `200 OK`**: Updated user object.

---

## 2. Patient Registration & Management (FR-2.1 – FR-2.5)

### `POST /api/patients`
- **SRS Requirement**: **FR-2.1**, **FR-2.2**
- **Roles**: `receptionist`
- **Request Body**:
  ```json
  {
    "name": "Aarav Sharma",
    "age": 34,
    "gender": "Male",
    "phone": "9812345678",
    "address": "42 Marine Drive, Mumbai",
    "blood_group": "B+"
  }
  ```
- **Response `201 Created`**: Patient object containing auto-generated `patient_id`.

### `GET /api/patients`
- **SRS Requirement**: **FR-2.3**
- **Roles**: `receptionist`, `doctor`, `admin`
- **Query Parameters**:
  - `q` (optional): Patient ID integer, formatted code (`P-0012`), name substring, or phone digits.
- **Response `200 OK`**: Array of matching patient objects.

### `GET /api/patients/:id`
- **SRS Requirement**: **FR-2.5**, **FR-5.4**
- **Roles**: `receptionist`, `doctor`, `admin`
- **Response `200 OK`**: Patient profile object including a `visits` array. Diagnoses are unmasked for doctors and masked as `null` for receptionists.

### `PUT /api/patients/:id`
- **SRS Requirement**: **FR-2.4**
- **Roles**: `receptionist`
- **Request Body**: Demographic fields (`name`, `age`, `gender`, `phone`, `address`, `blood_group`).
- **Response `200 OK`**: Updated patient object.

---

## 3. Doctor Profiles & Scheduling (FR-3.1 – FR-3.3)

### `GET /api/doctors`
- **SRS Requirement**: **FR-3.1**, **FR-3.3**
- **Roles**: All authenticated roles
- **Query Parameters**:
  - `specialization` (optional): Filter doctors by specialty (e.g. `General Medicine`).
- **Response `200 OK`**: Array of doctor profiles with user name, contact, qualification, and fee.

### `GET /api/doctors/:id`
- **SRS Requirement**: **FR-3.1**
- **Roles**: All authenticated roles
- **Response `200 OK`**: Specific doctor profile and weekly schedule configuration.

### `PUT /api/doctors/:id`
- **SRS Requirement**: **FR-3.1**, **FR-3.2**
- **Roles**: `admin` or the owning `doctor`
- **Request Body**:
  ```json
  {
    "specialization": "Cardiology",
    "qualification": "MBBS, MD, DM",
    "fee": 800,
    "availability": {
      "days": ["Mon", "Wed", "Fri"],
      "start": "09:00",
      "end": "14:00"
    }
  }
  ```
- **Response `200 OK`**: Updated doctor profile.

### `GET /api/doctors/:id/slots`
- **SRS Requirement**: **FR-3.2**, **FR-3.3**
- **Roles**: All authenticated roles
- **Query Parameters**:
  - `date` (required, `YYYY-MM-DD`): The target appointment date.
- **Response `200 OK`**:
  ```json
  {
    "doctor_id": 1,
    "date": "2026-10-22",
    "is_working_day": true,
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:30", "available": false }
    ]
  }
  ```

---

## 4. Appointments & Conflict Management (FR-4.1 – FR-4.5)

### `GET /api/appointments`
- **SRS Requirement**: **FR-4.4**
- **Roles**: `receptionist`, `doctor`, `admin`
- **Query Parameters**:
  - `doctor_id` (optional): Doctor's ID (used by doctors to see daily schedule).
  - `date` (optional, `YYYY-MM-DD`): Selected calendar date.
  - `status` (optional): Filter by `Scheduled`, `Completed`, `Cancelled`, `No-show`.
- **Response `200 OK`**: Array of appointments with patient, doctor, and status metadata.

### `POST /api/appointments`
- **SRS Requirement**: **FR-4.1**, **FR-4.2**
- **Roles**: `receptionist`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "doctor_id": 2,
    "date": "2026-10-22",
    "time_slot": "10:30"
  }
  ```
- **Response `201 Created`**: Created appointment record. Returns `409 Conflict` if slot is already occupied.

### `PUT /api/appointments/:id`
- **SRS Requirement**: **FR-4.3**
- **Roles**: `receptionist`
- **Request Body**:
  ```json
  {
    "date": "2026-10-23",
    "time_slot": "11:00"
  }
  ```
- **Response `200 OK`**: Rescheduled appointment record.

### `PATCH /api/appointments/:id/cancel`
- **SRS Requirement**: **FR-4.3**
- **Roles**: `receptionist`
- **Response `200 OK`**: Updated appointment with `status = "Cancelled"`.

### `PATCH /api/appointments/:id/status`
- **SRS Requirement**: **FR-4.5**
- **Roles**: `doctor`
- **Description**: Allows doctor to mark `No-show`. Manual transitions to `Completed` return `400 Bad Request` (completed status is strictly reserved for consultation submission).
- **Request Body**: `{ "status": "No-show" }`
- **Response `200 OK`**: Updated appointment object.

---

## 5. Clinical Consultations & Privacy (FR-5.1 – FR-5.4)

### `POST /api/records`
- **SRS Requirement**: **FR-5.1**, **FR-5.2**, **FR-4.5**
- **Roles**: `doctor`
- **Description**: Records clinical consultation and writes electronic prescription in an atomic transaction. Transitions the corresponding appointment to `Completed`.
- **Request Body**:
  ```json
  {
    "appointment_id": 5,
    "symptoms": "High fever, cough",
    "diagnosis": "Viral Bronchitis",
    "notes": "Drink warm liquids and rest.",
    "prescription": [
      {
        "medicine_id": 1,
        "dosage": "1 tab TDS",
        "duration": "5 days",
        "quantity": 15
      }
    ]
  }
  ```
- **Response `201 Created`**: Object containing saved `record`, `prescription`, and updated `appointment_status: "Completed"`.

### `GET /api/records/patient/:patient_id`
- **SRS Requirement**: **FR-5.3**, **FR-5.4**
- **Roles**: `doctor` (Receptionists and pharmacists receive `403 Forbidden`)
- **Response `200 OK`**: Array of chronological medical records with symptoms, diagnoses, doctor notes, and prescriptions.

---

## 6. Pharmacy Inventory & Atomic Dispensing (FR-7.1 – FR-7.4)

### `GET /api/medicines`
- **SRS Requirement**: **FR-7.1**, **FR-7.3**
- **Roles**: `pharmacist`, `doctor`, `admin`
- **Response `200 OK`**: List of all medicines, unit prices, available stock, expiry dates, and threshold alerts.

### `POST /api/medicines`
- **SRS Requirement**: **FR-7.1**
- **Roles**: `pharmacist`
- **Request Body**:
  ```json
  {
    "name": "Amoxicillin 500mg",
    "quantity": 100,
    "price": 12.50,
    "expiry_date": "2027-06-30",
    "threshold": 20
  }
  ```
- **Response `201 Created`**: Inserted medicine record.

### `PUT /api/medicines/:id`
- **SRS Requirement**: **FR-7.1**
- **Roles**: `pharmacist`
- **Request Body**: Updated fields (`name`, `quantity`, `price`, `expiry_date`, `threshold`).
- **Response `200 OK`**: Updated medicine record.

### `DELETE /api/medicines/:id`
- **SRS Requirement**: **FR-7.1**
- **Roles**: `pharmacist`
- **Response `200 OK`**: Confirmation message. Only unreferenced medicines may be deleted.

### `GET /api/medicines/alerts`
- **SRS Requirement**: **FR-7.3**
- **Roles**: `pharmacist`, `admin`
- **Response `200 OK`**:
  ```json
  {
    "total": 4,
    "low_stock": 2,
    "expired": 0,
    "near_expiry": 2
  }
  ```

### `GET /api/prescriptions`
- **SRS Requirement**: **FR-7.4**
- **Roles**: `pharmacist`
- **Query Parameters**:
  - `status` (optional): `pending` or `dispensed`.
- **Response `200 OK`**: List of prescriptions with patient details, doctor name, and line items.

### `POST /api/prescriptions/:id/dispense`
- **SRS Requirement**: **FR-7.2**, **FR-7.4**
- **Roles**: `pharmacist`
- **Description**: Atomically deducts inventory stock using row-level locking (`SELECT ... FOR UPDATE`) and marks the prescription as dispensed.
- **Response `200 OK`**: Dispensation receipt and updated prescription.

---

## 7. Billing & Financial Invoicing (FR-6.1 – FR-6.4)

### `GET /api/bills/preview/:appointment_id`
- **SRS Requirement**: **FR-6.1**
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**: Itemized preview of consultation fee and medicine charges.

### `POST /api/bills`
- **SRS Requirement**: **FR-6.1**, **FR-6.2**
- **Roles**: `receptionist`
- **Request Body**:
  ```json
  {
    "appointment_id": 5,
    "other_charges": 50.00,
    "status": "Pending"
  }
  ```
- **Response `201 Created`**: Bill object with computed `total`.

### `GET /api/bills/:id`
- **SRS Requirement**: **FR-6.1**, **FR-6.2**
- **Roles**: `receptionist`, `admin`
- **Description**: While `status = "Pending"`, viewing dynamically recalculates `medicine_charges` from dispensed prescriptions.
- **Response `200 OK`**: Bill details with line items.

### `PUT /api/bills/:id`
- **SRS Requirement**: **FR-6.1**
- **Roles**: `receptionist`
- **Description**: Updates `other_charges` while bill is `Pending`. If bill is `Paid`, returns `400 Bad Request` (amounts locked).
- **Request Body**: `{ "other_charges": 75.00 }`
- **Response `200 OK`**: Updated bill object.

### `PATCH /api/bills/:id/pay`
- **SRS Requirement**: **FR-6.2**
- **Roles**: `receptionist`
- **Request Body**: `{ "payment_mode": "cash" | "card" | "upi" }`
- **Response `200 OK`**: Updated bill with `status = "Paid"` and permanent financial lock.

### `GET /api/bills/:id/pdf`
- **SRS Requirement**: **FR-6.3**
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**: Streaming binary `application/pdf` invoice with hospital branding.

### `GET /api/bills/patient/:patient_id`
- **SRS Requirement**: **FR-6.4**
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**: Chronological billing history and receipts for the specified patient.

### `GET /api/bills`
- **SRS Requirement**: **FR-6.4**
- **Roles**: `receptionist`, `admin`
- **Query Parameters**:
  - `status` (optional): `Paid` or `Pending`.
- **Response `200 OK`**: Filterable hospital bill ledger.

---

## 8. Dashboards & Periodic Analytics (FR-8.1 – FR-8.2)

### `GET /api/reports/dashboard`
- **SRS Requirement**: **FR-8.1**
- **Roles**: `admin` (also provides tailored subsets for other roles)
- **Response `200 OK`**:
  ```json
  {
    "counts": { "patients": 45, "doctors": 8 },
    "today": { "appointments_total": 12, "appointments_completed": 7 },
    "financial": { "total_revenue": 14500.00 },
    "pharmacy": { "low_stock": 3 }
  }
  ```

### `GET /api/reports/appointments`
- **SRS Requirement**: **FR-8.2**
- **Roles**: `admin`
- **Query Parameters**:
  - `period` (optional): `daily`, `weekly`, or `monthly`.
  - `from_date` / `to_date` (optional, `YYYY-MM-DD`): Custom date range filter.
- **Response `200 OK`**:
  ```json
  {
    "summary": { "total": 24, "completed": 19, "cancelled": 3, "no_show": 2 },
    "by_status": [ ... ],
    "by_doctor": [ ... ]
  }
  ```

### `GET /api/reports/revenue`
- **SRS Requirement**: **FR-8.2**
- **Roles**: `admin`
- **Query Parameters**:
  - `period` (optional): `daily`, `weekly`, or `monthly`.
  - `from_date` / `to_date` (optional, `YYYY-MM-DD`): Custom date range filter.
- **Response `200 OK`**:
  ```json
  {
    "summary": { "total_revenue": 14500.00, "paid_bills": 18 },
    "by_payment_mode": [ ... ],
    "daily_breakdown": [ ... ]
  }
  ```

---

## 9. Additional Features Beyond the SRS

The following endpoints and capabilities deliver advanced clinical, operational, and user experience features exceeding the baseline SRS requirements:

### `GET /api/reports/doctor-performance`
- **Feature**: Doctor Performance Clinical & Financial Analytics
- **Roles**: `admin`
- **Description**: Returns doctor-by-doctor comparative analytics including completed consultation count, consultation completion rate percentage, consultation revenue collected, and associated pharmacy prescription revenue generated.
- **Response `200 OK`**:
  ```json
  [
    {
      "doctor_id": 1,
      "name": "Dr. Sarah Jenkins",
      "specialization": "General Medicine",
      "total_appointments": 15,
      "completed_appointments": 14,
      "completion_rate": 93.3,
      "consultation_revenue": 7700.00,
      "pharmacy_revenue": 2450.00
    }
  ]
  ```

### `GET /api/reports/appointments/csv`
- **Feature**: RFC-4180 Appointments Spreadsheet Export
- **Roles**: `admin`
- **Response `200 OK`**: Streaming CSV file with headers: `Appointment ID, Date, Time Slot, Status, Patient Name, Patient Phone, Doctor Name, Specialization`. Includes `Content-Disposition: attachment; filename="appointments_report_...csv"`.

### `GET /api/reports/revenue/csv`
- **Feature**: RFC-4180 Financial Revenue Statement Export
- **Roles**: `admin`
- **Response `200 OK`**: Streaming CSV file with headers: `Bill ID, Appointment ID, Date, Patient Name, Doctor Name, Consultation Fee, Medicine Charges, Other Charges, Total, Status, Payment Mode`.

### Editable Other Charges on Pending Bills
- **Feature**: Pending Bill Adjustment
- **Endpoint**: `PUT /api/bills/:id`
- **Description**: Receptionists can adjust incidental hospital fees on pending invoices (e.g. specialized dressing, diagnostics) prior to settlement. The total recalculates dynamically and locks irrevocably upon marking `Paid`.

### Stock Status Badges (Out of Stock)
- **Feature**: Depleted Inventory Indicator
- **UI Component**: Frontend `Pharmacy.jsx`
- **Description**: Visual badge differentiating critical stock depletion (`quantity = 0`, badge `Out of Stock`) from threshold warning stock (`0 < quantity <= threshold`, badge `Low Stock`).

### Login Quick-Fill Buttons
- **Feature**: Instant Role-Switching Demo Helper
- **UI Component**: Frontend `Login.jsx`
- **Description**: Accessible one-click credential buttons for `Admin`, `Doctor`, `Receptionist`, and `Pharmacist` enabling rapid verification across role-specific views during evaluation.
