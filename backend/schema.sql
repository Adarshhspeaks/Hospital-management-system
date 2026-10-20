-- Hospital Management System: PostgreSQL schema (matches the ER diagram)

CREATE TABLE IF NOT EXISTS users (
  user_id        SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(20)  NOT NULL CHECK (role IN ('admin','doctor','receptionist','pharmacist')),
  status         VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  patient_id   SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  age          INT NOT NULL CHECK (age >= 0),
  gender       VARCHAR(10)  NOT NULL,
  phone        VARCHAR(15)  NOT NULL,
  address      TEXT,
  blood_group  VARCHAR(5),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id       SERIAL PRIMARY KEY,
  user_id         INT NOT NULL UNIQUE REFERENCES users(user_id),
  specialization  VARCHAR(100) NOT NULL,
  qualification   VARCHAR(100),
  fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  availability    TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id  SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL REFERENCES patients(patient_id),
  doctor_id       INT NOT NULL REFERENCES doctors(doctor_id),
  date            DATE NOT NULL,
  time_slot       VARCHAR(20) NOT NULL,
  status          VARCHAR(15) NOT NULL DEFAULT 'Scheduled'
                  CHECK (status IN ('Scheduled','Completed','Cancelled','No-show'))
);
-- FR-4.2: a doctor's slot can only be held by one active appointment
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot
  ON appointments (doctor_id, date, time_slot) WHERE status = 'Scheduled';

CREATE TABLE IF NOT EXISTS medical_records (
  record_id       SERIAL PRIMARY KEY,
  appointment_id  INT NOT NULL UNIQUE REFERENCES appointments(appointment_id),
  symptoms        TEXT,
  diagnosis       TEXT,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id  SERIAL PRIMARY KEY,
  record_id        INT NOT NULL REFERENCES medical_records(record_id),
  dispensed        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id  SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  quantity     INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price        NUMERIC(10,2) NOT NULL,
  expiry_date  DATE,
  threshold    INT NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS prescription_items (
  item_id          SERIAL PRIMARY KEY,
  prescription_id  INT NOT NULL REFERENCES prescriptions(prescription_id),
  medicine_id      INT NOT NULL REFERENCES medicines(medicine_id),
  dosage           VARCHAR(50),
  duration         VARCHAR(50),
  quantity         INT NOT NULL DEFAULT 1
);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;


CREATE TABLE IF NOT EXISTS bills (
  bill_id              SERIAL PRIMARY KEY,
  patient_id           INT NOT NULL REFERENCES patients(patient_id),
  appointment_id       INT UNIQUE REFERENCES appointments(appointment_id),
  consultation_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  medicine_charges     NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_charges        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total                NUMERIC(10,2) NOT NULL DEFAULT 0,
  status               VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid')),
  payment_mode         VARCHAR(10) CHECK (payment_mode IN ('cash','card','upi')),
  date                 DATE NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE bills ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS medicine_charges NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS other_charges NUMERIC(10,2) NOT NULL DEFAULT 0;

