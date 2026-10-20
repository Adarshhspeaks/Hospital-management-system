# Hospital Management System (HMS) — API Reference

Base URL: `http://localhost:5000/api`

All endpoints return JSON responses with standard HTTP status codes:
- `200 OK` / `201 Created` on success.
- `400 Bad Request`: Validation failure (`{ "error": "plain-English description" }`).
- `401 Unauthorized`: Missing or invalid JWT token.
- `403 Forbidden`: Insufficient role permissions.
- `404 Not Found`: Entity does not exist.
- `409 Conflict`: Business logic or uniqueness conflict (e.g. double booking, duplicate bill).

---

## Authentication Header
Protected endpoints require an `Authorization` header with a signed JSON Web Token (JWT):
```http
Authorization: Bearer <jwt_token>
```

---

## 1. Authentication & Staff Management

### `POST /api/auth/login`
Authenticates a user account and returns a signed JWT.
- **Roles**: Public
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

### `GET /api/users`
Lists all hospital staff accounts.
- **Roles**: `admin`
- **Response `200 OK`**: Array of user objects (`user_id`, `name`, `username`, `role`, `status`, `created_at`).

### `POST /api/users`
Creates a new staff user account.
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
- **Response `201 Created`**: User object.

### `PATCH /api/users/:id/status`
Activates or deactivates a staff account.
- **Roles**: `admin`
- **Request Body**: `{ "status": "inactive" }` or `{ "status": "active" }`
- **Response `200 OK`**: Updated user object.

---

## 2. Patient Management

### `GET /api/patients`
Searches or lists patients.
- **Roles**: `admin`, `receptionist`, `doctor`
- **Query Parameters**:
  - `q` (optional): Name, phone, or ID substring filter.
- **Response `200 OK`**: Array of patient objects.

### `GET /api/patients/:id`
Retrieves patient profile and visit history.
- **Roles**: `admin`, `receptionist`, `doctor`
- **Response `200 OK`**:
  ```json
  {
    "patient": {
      "patient_id": 1,
      "name": "Ramesh Patel",
      "age": 42,
      "gender": "Male",
      "phone": "9876543210",
      "address": "12 Gandhi Road, Mumbai",
      "blood_group": "O+"
    },
    "visits": [
      {
        "appointment_id": 12,
        "date": "2026-10-22",
        "time_slot": "10:00",
        "status": "Completed",
        "doctor_name": "Dr. Demo",
        "specialization": "General Medicine",
        "diagnosis": "Acute Pharyngitis"
      }
    ]
  }
  ```
  *(Note: `diagnosis` is masked as `null` for receptionist/admin and visible to doctors).*

### `POST /api/patients`
Registers a new patient.
- **Roles**: `receptionist`, `admin`
- **Request Body**:
  ```json
  {
    "name": "Priya Nair",
    "age": 28,
    "gender": "Female",
    "phone": "9812345678",
    "address": "B-402 Lakeview, Bangalore",
    "blood_group": "A+"
  }
  ```
- **Response `201 Created`**: Patient object with `patient_id`.

### `PUT /api/patients/:id`
Updates patient demographic details.
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**: Updated patient object.

---

## 3. Doctors & Availability

### `GET /api/doctors`
Lists active doctors with consultation fees and availability.
- **Roles**: `admin`, `receptionist`, `doctor`
- **Query Parameters**:
  - `specialization` (optional): Filter by specialty string.
- **Response `200 OK`**: Array of doctor objects.

### `GET /api/doctors/:id/slots`
Generates half-hour appointment slots for a specific date.
- **Roles**: `admin`, `receptionist`, `doctor`
- **Query Parameters**:
  - `date` (required): `YYYY-MM-DD`
- **Response `200 OK`**:
  ```json
  {
    "date": "2026-10-22",
    "weekday": "Thu",
    "working": true,
    "slots": [
      { "time": "09:00", "booked": false, "past": false, "available": true },
      { "time": "09:30", "booked": true, "past": false, "available": false }
    ]
  }
  ```

### `PUT /api/doctors/:id`
Updates doctor fee, qualification, specialization, or weekly schedule.
- **Roles**: `admin`, or doctor updating own profile
- **Request Body**:
  ```json
  {
    "fee": 550.00,
    "availability": {
      "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      "start": "09:00",
      "end": "13:30"
    }
  }
  ```
- **Response `200 OK`**: Updated doctor object.

---

## 4. Appointments & Scheduling

### `GET /api/appointments`
Lists appointments with multi-criteria filtering.
- **Roles**: `admin`, `receptionist`, `doctor` (doctors automatically filtered to own appointments)
- **Query Parameters**:
  - `date` (optional): `YYYY-MM-DD`
  - `doctor_id` (optional): Number
  - `patient_id` (optional): Number
  - `status` (optional): `Scheduled`, `Completed`, `Cancelled`, `No-show`
- **Response `200 OK`**: Array of appointment objects.

### `POST /api/appointments`
Books an appointment.
- **Roles**: `receptionist`, `admin`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "doctor_id": 1,
    "date": "2026-10-22",
    "time_slot": "10:30"
  }
  ```
- **Response `201 Created`**: Appointment object with status `Scheduled`.
- **Response `409 Conflict`**: If doctor already has an active appointment in this slot.

### `PATCH /api/appointments/:id/reschedule`
Reschedules an appointment to a new date and time slot.
- **Roles**: `receptionist`, `admin`
- **Request Body**:
  ```json
  {
    "date": "2026-10-23",
    "time_slot": "11:00"
  }
  ```
- **Response `200 OK`**: Updated appointment.

### `PATCH /api/appointments/:id/cancel`
Cancels an appointment, freeing the slot for other patients.
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**: Appointment marked `Cancelled`.

### `PATCH /api/appointments/:id/status`
Updates status to `Completed` or `No-show`.
- **Roles**: `doctor`, `receptionist`, `admin`
- **Request Body**: `{ "status": "No-show" }`

---

## 5. Consultations & Medical Records

### `POST /api/records`
Records symptoms, diagnosis, clinical notes, itemized prescription, and marks the appointment `Completed` in ONE atomic transaction.
- **Roles**: `doctor`
- **Request Body**:
  ```json
  {
    "appointment_id": 12,
    "symptoms": "High fever, chills, persistent dry cough",
    "diagnosis": "Upper Respiratory Tract Infection",
    "notes": "Hydration, vit-C, follow up after 5 days if fever persists.",
    "prescription": [
      {
        "medicine_id": 1,
        "dosage": "1 tab TDS",
        "duration": "3 days",
        "quantity": 6
      },
      {
        "medicine_id": 2,
        "dosage": "1 cap BD",
        "duration": "5 days",
        "quantity": 10
      }
    ]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "record": { "record_id": 4, "appointment_id": 12, "diagnosis": "..." },
    "prescription": { "prescription_id": 4, "dispensed": false, "items": [...] },
    "appointment_status": "Completed"
  }
  ```
- **Response `400 Bad Request`**: If already consulted or invalid medicine IDs.

### `GET /api/records/appointment/:appointment_id`
Retrieves medical record and prescription details for an appointment.
- **Roles**: `doctor`

---

## 6. Pharmacy Inventory & Dispensing

### `GET /api/medicines`
Lists medicines in inventory.
- **Roles**: `pharmacist`, `doctor`, `admin`, `receptionist`
- **Query Parameters**:
  - `status`: `low_stock`, `expired`, `near_expiry`
  - `q`: Search medicine name
- **Response `200 OK`**: Array of medicine items.

### `GET /api/medicines/alerts`
Returns inventory summary counts.
- **Roles**: `pharmacist`, `doctor`, `admin`
- **Response `200 OK`**:
  ```json
  {
    "total": 15,
    "low_stock": 3,
    "expired": 1,
    "near_expiry": 2
  }
  ```

### `POST /api/medicines`
Adds a medicine to inventory.
- **Roles**: `pharmacist`
- **Request Body**:
  ```json
  {
    "name": "Azithromycin 250mg",
    "quantity": 100,
    "price": 75.00,
    "expiry_date": "2027-06-30",
    "threshold": 15
  }
  ```
- **Response `201 Created`**: Medicine object.

### `GET /api/prescriptions`
Queue of prescriptions awaiting dispensing.
- **Roles**: `pharmacist`, `admin`
- **Query Parameters**:
  - `dispensed`: `false` (default) or `true`
- **Response `200 OK`**: Prescriptions with itemized medicines and available stock check.

### `POST /api/prescriptions/:id/dispense`
Dispenses prescription in an atomic transaction: row-locks inventory, validates stock, decrements quantities, and sets `dispensed = TRUE`.
- **Roles**: `pharmacist`
- **Response `200 OK`**:
  ```json
  {
    "message": "Prescription dispensed successfully and medicine stock updated.",
    "prescription": { "prescription_id": 4, "dispensed": true }
  }
  ```
- **Response `400 Bad Request`**: If stock is insufficient or already dispensed.

---

## 7. Patient Billing & Invoicing

### `GET /api/bills/unbilled`
Lists appointments ready for billing (completed consultations without an invoice).
- **Roles**: `receptionist`, `admin`

### `GET /api/bills/preview/:appointment_id`
Auto-calculates doctor consultation fee and sum of dispensed prescription medicines.
- **Roles**: `receptionist`, `admin`
- **Response `200 OK`**:
  ```json
  {
    "already_billed": false,
    "appointment": { ... },
    "consultation_fee": 500,
    "medicine_charges": 740,
    "prescription_items": [ ... ],
    "suggested_total": 1240
  }
  ```

### `POST /api/bills`
Generates a patient invoice. Enforces strictly one bill per appointment.
- **Roles**: `receptionist`, `admin`
- **Request Body**:
  ```json
  {
    "appointment_id": 12,
    "other_charges": 50,
    "status": "Paid",
    "payment_mode": "upi"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "bill_id": 6,
    "patient_id": 1,
    "appointment_id": 12,
    "consultation_fee": 500,
    "medicine_charges": 740,
    "other_charges": 50,
    "total": 1290,
    "status": "Paid",
    "payment_mode": "upi",
    "date": "2026-10-20"
  }
  ```
- **Response `409 Conflict`**: If a bill has already been created for this appointment.

### `PATCH /api/bills/:id/pay`
Records payment for an outstanding pending bill.
- **Roles**: `receptionist`, `admin`
- **Request Body**: `{ "payment_mode": "cash" }`
- **Response `200 OK`**: Updated bill object.

### `GET /api/bills/:id/pdf`
Generates and downloads a formal hospital PDF invoice receipt.
- **Roles**: Authenticated users
- **Response `200 OK`**: Binary stream with `Content-Type: application/pdf`.

---

## 8. Dashboard & Reports

### `GET /api/reports/dashboard`
Returns live role-tailored KPI counters.
- **Roles**: All authenticated roles
- **Response `200 OK`**: JSON metrics based on caller's role.

### `GET /api/reports/appointments`
Returns appointment summary, completion rates, doctor breakdown, and daily trend.
- **Roles**: `admin`, `receptionist`
- **Query Parameters**: `from_date`, `to_date`, `doctor_id`, `status`
- **Response `200 OK`**: Summary and breakdown objects.

### `GET /api/reports/appointments/csv`
Downloads appointment report as RFC 4180 CSV spreadsheet.
- **Roles**: `admin`, `receptionist`
- **Response `200 OK`**: `Content-Type: text/csv`.

### `GET /api/reports/revenue`
Returns financial metrics, payment mode distribution (`cash`, `card`, `upi`), and daily revenue trends.
- **Roles**: `admin`, `receptionist`
- **Query Parameters**: `from_date`, `to_date`, `payment_mode`

### `GET /api/reports/revenue/csv`
Downloads revenue report as RFC 4180 CSV spreadsheet.
- **Roles**: `admin`, `receptionist`
- **Response `200 OK`**: `Content-Type: text/csv`.

### `GET /api/reports/doctor-performance`
Returns consultation volume, completion percentage, and revenue generated per doctor.
- **Roles**: `admin`
- **Query Parameters**: `from_date`, `to_date`
