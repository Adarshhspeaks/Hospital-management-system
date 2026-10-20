# Hospital Management System (HMS)

A complete, full-stack Hospital Management System built step by step according to Software Engineering SRS and Design Document specifications.

Built with **React (Vite)**, **Node.js / Express**, and **PostgreSQL**.

---

## 🌟 Modules & Features (Steps 1 to 8 Complete)

- **Step 1: Authentication & Staff Management (FR-1.x)**
  - JWT authentication with secure password hashing (`bcryptjs`).
  - Strict Role-Based Access Control (RBAC): `admin`, `receptionist`, `doctor`, `pharmacist`.
  - Admin staff account management (create, activate, deactivate accounts).
- **Step 2: Patient Registration & Search (FR-2.x)**
  - Patient registration with demographics, contact info, blood group.
  - Standardized patient code formatting (`P-0001`).
  - Fast search by patient name, contact number, or ID.
  - Complete patient visit history with diagnosis privacy.
- **Step 3: Doctor Profiles & Availability Scheduling (FR-3.x & FR-4.x)**
  - Doctor profiles with specialization, qualifications, and consultation fees.
  - Flexible weekly working hours stored as JSON and dynamic 30-minute slot generation.
  - Self-service schedule updates for doctors.
- **Step 4: Appointments & Conflict Management (FR-4.x)**
  - Multi-doctor appointment booking with real-time slot availability.
  - Double-booking conflict prevention enforced at the database layer via partial unique index.
  - Rescheduling to open slots, appointment cancellation, and status lifecycle locking.
- **Step 5: Doctor Consultation & Prescriptions (FR-5.x)**
  - Atomic consultation recording: symptoms, diagnosis, clinical notes, and itemized prescriptions saved in a single database transaction.
  - Diagnosis privacy: masked for non-doctor roles, revealed to consulting doctors.
- **Step 6: Pharmacy Stock & Atomic Dispensing (FR-7.x)**
  - Pharmacist inventory management with live stock alert badges (**Low Stock**, **Near Expiry**, **Expired**, **Out of Stock**).
  - Prescription dispensing queue with live stock checks.
  - Concurrency-safe atomic dispensing transaction with row-level locks (`FOR UPDATE OF m`).
  - Automatic rollback on stock deficit and protection against double-dispensing.
- **Step 7: Patient Billing & PDF Invoices (FR-6.x)**
  - Live bill preview calculating doctor consultation fees and dispensed pharmacy medicines.
  - Editable hospital service charges with dynamic total recalculation.
  - One-bill-per-appointment enforcement (HTTP 409).
  - Settlement of pending bills (`PATCH /api/bills/:id/pay`).
  - Downloadable official PDF invoices generated on the fly via `pdfkit`.
- **Step 8: Admin Dashboard & Reports (FR-8.x)**
  - Dynamic, role-tailored dashboard with real-time KPI counters, revenue metrics, and activity logs.
  - Appointments analytics report with completion and cancellation rate calculations.
  - Financial revenue report with payment mode share (`cash`, `card`, `upi`) and daily collection trends.
  - Doctor performance report (clinical visit volume and revenue generated).
  - One-click CSV spreadsheet export for appointments and revenue data.
- **Step 9: Testing & Documentation**
  - Unified 28-test integration test suite covering FR-1 through FR-8 with 100% pass rate.
  - Complete technical documentation in `docs/`.

---

## 🏗️ Architecture & Technology Stack

| Tier | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5.4, React Router 6, Vanilla CSS (Design Tokens, Responsive Grid) |
| **Backend** | Node.js, Express.js 4.19, PostgreSQL Driver (`pg`), JWT (`jsonwebtoken`), `bcryptjs`, `pdfkit` |
| **Database** | PostgreSQL 18 (Relational Schema with constraints, foreign keys, and partial unique indexes) |

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or use embedded PostgreSQL configured in backend)

### 1. Database Setup
Ensure PostgreSQL is running on port `5432` with a database named `hms`:
```bash
# PostgreSQL CLI or pgAdmin:
createdb hms
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:init       # Runs schema.sql to create all 8 tables and indexes
npm run db:seed       # Populates initial demo accounts and 15 medicines
npm run dev           # Starts API server on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
```

---

## 🔑 Demo Credentials

| Role | Username | Password | Default Landing |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Hospital Overview, Staff, Reports |
| **Receptionist** | `reception` | `reception123` | Appointments, Patients, Billing |
| **Doctor** | `doctor1` | `doctor123` | Daily Consultations, Patients |
| **Pharmacist** | `pharmacy` | `pharmacy123` | Medicine Stock, Dispensing Queue |

---

## 🧪 Automated Testing

Run the full end-to-end integration test suite:
```bash
cd backend
npm test
```
The test runner executes 28 test cases covering FR-1 through FR-8:
```
================================================================
 RESULTS: 28 PASSED | 0 FAILED
================================================================
```

To build and validate the frontend production bundle:
```bash
cd frontend
npm run build
```

---

## 📚 Project Documentation

- **[REST API Reference](docs/API.md)**: Complete documentation of all endpoints, parameters, request bodies, and responses.
- **[Test Cases Specification](docs/TEST_CASES.md)**: Formal traceability matrix and test case definitions for FR-1 through FR-8.
- **[Test Execution Report](docs/TEST_REPORT.md)**: Formal execution results, metrics, defect logs, and sign-off.
