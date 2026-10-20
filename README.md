# Hospital Management System (HMS)

A complete, full-stack Hospital Management System built strictly according to Software Engineering SRS specifications and software design patterns.

Built with **React 18 (Vite)**, **Node.js / Express**, and **PostgreSQL 16/18**.

---

## 🌟 Modules & Features (SRS FR-1.1 – FR-8.2 Complete)

- **Authentication & Staff Management (FR-1.1 – FR-1.5)**
  - JWT authentication with secure password hashing (`bcryptjs`), Helmet security headers, and login rate limiting.
  - Strict Role-Based Access Control (RBAC): `admin`, `doctor`, `receptionist`, `pharmacist`.
  - Admin staff account lifecycle: create, edit name & role, reset password, activate and deactivate accounts (deletion prohibited to preserve audit trail).
- **Patient Registration & Profile Management (FR-2.1 – FR-2.5)**
  - Patient registration with demographics, contact info, and blood group.
  - Standardized unique patient code generation (`P-0001`).
  - Search by patient ID, name, or phone number.
  - Complete patient visit history with clinical diagnosis privacy masking.
- **Doctor Profiles & Availability Scheduling (FR-3.1 – FR-3.3)**
  - Doctor profiles with specialization, qualifications, and consultation fee.
  - Weekly working days & hours schedule with dynamic 30-minute booking slot generation.
  - Doctor directory filtered by specialization and schedule availability.
- **Appointments & Conflict Management (FR-4.1 – FR-4.5)**
  - Appointment booking with real-time slot validation.
  - Double-booking conflict prevention enforced at the database layer via partial unique index.
  - Rescheduling to open slots, appointment cancellation, and doctor daily appointment rosters.
  - Status tracking (`Scheduled`, `Completed`, `Cancelled`, `No-show`). Direct manual transition to `Completed` is strictly rejected; completion is exclusively unlocked by clinical consultation.
- **Doctor Consultations & Prescriptions (FR-5.1 – FR-5.4)**
  - Atomic consultation recording: symptoms, diagnosis, clinical notes, and itemized prescriptions saved in a single database transaction.
  - Access to patient's previous medical records for attending doctors.
  - Confidentiality: diagnosis masked for non-doctor roles in visit history, and clinical records routes restricted with 403 Forbidden.
- **Pharmacy Stock & Atomic Dispensing (FR-7.1 – FR-7.4)**
  - Pharmacist inventory management (add, update, remove medicines) with threshold alert badges (**Low Stock**, **Near Expiry**, **Expired**, **Out of Stock**).
  - Prescription dispensing queue with live stock checks.
  - Concurrency-safe atomic dispensing transaction with row-level locks (`SELECT ... FOR UPDATE`).
  - Automatic rollback on stock deficit and protection against double-dispensing.
- **Patient Billing & PDF Invoices (FR-6.1 – FR-6.4)**
  - Bill generation calculating doctor consultation fee, dispensed pharmacy medicines, and incidental hospital charges.
  - Live dynamic recalculation of medicine charges while bill is `Pending`.
  - Permanent financial lock once bill is marked `Paid` with payment mode (`cash`, `card`, `upi`).
  - Downloadable official PDF invoices generated on the fly via `pdfkit`.
  - Per-patient payment history and filtered bill ledgers.
- **Admin Dashboard & Periodic Analytics (FR-8.1 – FR-8.2)**
  - Core admin dashboard metrics: Total Patients, Appointments Today, Total Revenue, Low-Stock Items.
  - Periodic appointment and revenue reports with `daily`, `weekly`, and `monthly` filters.
  - Doctor performance clinical and financial analytics.
  - RFC-4180 streaming CSV spreadsheet exports for appointments and financial revenue.

---

## 🏗️ Architecture & Technology Stack

| Tier | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5.4, React Router 6, Vanilla CSS (Design Tokens, Glassmorphism, Responsive Grid) |
| **Backend** | Node.js 20+, Express.js 4.19, PostgreSQL Driver (`pg`), JWT (`jsonwebtoken`), `bcryptjs`, `pdfkit`, `helmet`, `express-rate-limit` |
| **Database** | PostgreSQL 16/18 (9 relational tables with foreign keys, checks, and partial unique indexes) |
| **Containers** | Docker Engine, Docker Compose, Nginx Alpine (Reverse Proxy & SPA Static Server) |

---

## 🐳 Quick Start with Docker Compose (Recommended)

Run the entire application (PostgreSQL, Backend API, and Frontend Nginx) with a single command:

```bash
docker compose up -d --build
```

Populate the database with initial demo data:
```bash
docker compose exec backend npm run db:seed
```

Open your browser at **`http://localhost`** (or `http://localhost:3000`).

---

## 💻 Local Development Setup (Without Docker)

### Prerequisites
- Node.js (v18+)
- PostgreSQL 14+ running on port `5432` with a database named `hms`

### 1. Backend Setup
```bash
cd backend
npm install
npm run db:init       # Runs schema.sql to create all 9 tables and indexes
npm run db:seed       # Populates initial demo accounts and 15 medicines
npm run dev           # Starts API server on http://localhost:5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
```

---

## 🔑 Demo Credentials

| Role | Username | Password | Default Landing |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Hospital Overview, Staff Management, Reports |
| **Receptionist** | `reception` | `reception123` | Appointments, Patient Registration, Billing |
| **Doctor** | `doctor1` | `doctor123` | Daily Appointments, Consultations & Records |
| **Pharmacist** | `pharmacy` | `pharmacy123` | Medicine Inventory, Dispensing Queue |

*Note: The login page includes one-click quick-fill buttons for each role to facilitate instant evaluator demonstrations.*

---

## 🧪 Automated Testing

Run the full end-to-end integration test suite exercising all SRS requirements:
```bash
cd backend
npm test
```
Result:
```text
================================================================
 RESULTS: 35 PASSED | 0 FAILED
================================================================
```

To build and validate the frontend production bundle:
```bash
cd frontend
npm run build
```

---

## 📚 Project Documentation

- **[REST API Reference](docs/API.md)**: Full endpoint reference mapped directly to SRS requirement IDs.
- **[Test Cases Specification](docs/TEST_CASES.md)**: Formal traceability matrix and test case definitions for FR-1.1 through FR-8.2.
- **[Test Execution Report](docs/TEST_REPORT.md)**: Formal execution results, metrics, defect logs, and sign-off.
- **[Production Deployment Guide](docs/DEPLOYMENT.md)**: Detailed deployment instructions for Docker Compose, Render (1-click Blueprint), Vercel, Railway, and Ubuntu VPS.
