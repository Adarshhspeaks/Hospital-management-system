# Hospital Management System

React + Node/Express + PostgreSQL. Built step by step from the SRS and Design Document.

## What works so far (Steps 1 and 2)
- Login with JWT, passwords stored as bcrypt hashes
- Role-based access (admin, receptionist, doctor, pharmacist)
- Admin: create staff accounts, deactivate or reactivate them
- Patients: register, search by name, phone or ID, edit details, visit history
- Full database schema for every later module

## Setup

You need Node 18+ and PostgreSQL.

### 1. Database
```bash
createdb hms          # or create a database named "hms" in pgAdmin
```

### 2. Backend
```bash
cd backend
cp .env.example .env  # then edit DATABASE_URL and JWT_SECRET
npm install
npm run db:init       # creates all tables
npm run db:seed       # adds one demo user per role
npm run dev           # API on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev           # app on http://localhost:5173
```

### Demo logins
| Role | Username | Password |
|---|---|---|
| Admin | admin | admin123 |
| Receptionist | reception | reception123 |
| Doctor | doctor1 | doctor123 |
| Pharmacist | pharmacy | pharmacy123 |

Change these before showing the project to anyone outside class.

## Folder map
```
backend/
  schema.sql            all tables (matches the ER diagram)
  src/server.js         Express app
  src/middleware/auth.js  login check + role check
  src/routes/           auth.js, users.js, patients.js (more per step)
frontend/
  src/AuthContext.jsx   login state
  src/components/       Layout (sidebar per role), ProtectedRoute
  src/pages/            Login, Dashboard, Staff, Patients, PatientDetail
```

## SRS coverage so far
FR-1.1 login, FR-1.2 roles, FR-1.3 role-based access, FR-1.4 staff management, FR-1.5 logout and session expiry (8 hours).
FR-2.1 register patient, FR-2.2 generated patient ID (shown as P-0001), FR-2.3 search, FR-2.4 edit, FR-2.5 visit history.

Who can do what with patients: the receptionist registers and edits; the receptionist, doctor and admin can search and view. Only doctors see diagnoses in the visit history.
