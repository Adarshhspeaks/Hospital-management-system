// Adds demo accounts and initial data. Run once or whenever needed: npm run db:seed
const bcrypt = require('bcryptjs');
const db = require('./db');

const demoUsers = [
  { name: 'System Admin',   username: 'admin',     password: 'admin123',     role: 'admin' },
  { name: 'Front Desk',     username: 'reception', password: 'reception123', role: 'receptionist' },
  { name: 'Dr. Demo',       username: 'doctor1',   password: 'doctor123',    role: 'doctor' },
  { name: 'Pharmacy Desk',  username: 'pharmacy',  password: 'pharmacy123',  role: 'pharmacist' },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const demoMedicines = [
  { name: 'Paracetamol 500mg',        quantity: 150, price: 15.00,  expiry_date: addDays(365), threshold: 20 },
  { name: 'Amoxicillin 500mg',        quantity: 80,  price: 65.00,  expiry_date: addDays(240), threshold: 15 },
  { name: 'Ibuprofen 400mg',          quantity: 6,   price: 25.00,  expiry_date: addDays(180), threshold: 15 }, // Low stock
  { name: 'Cetirizine 10mg',          quantity: 120, price: 18.00,  expiry_date: addDays(14),  threshold: 20 }, // Near expiry
  { name: 'Metformin 500mg',          quantity: 200, price: 40.00,  expiry_date: addDays(400), threshold: 25 },
  { name: 'Pantoprazole 40mg',        quantity: 90,  price: 55.00,  expiry_date: addDays(300), threshold: 15 },
  { name: 'Azithromycin 500mg',       quantity: 4,   price: 95.00,  expiry_date: addDays(150), threshold: 10 }, // Low stock
  { name: 'Omeprazole 20mg',          quantity: 110, price: 35.00,  expiry_date: addDays(365), threshold: 15 },
  { name: 'Atorvastatin 10mg',        quantity: 75,  price: 80.00,  expiry_date: addDays(22),  threshold: 15 }, // Near expiry
  { name: 'Ciprofloxacin 500mg',      quantity: 60,  price: 50.00,  expiry_date: addDays(270), threshold: 10 },
  { name: 'Losartan 50mg',            quantity: 85,  price: 45.00,  expiry_date: addDays(450), threshold: 15 },
  { name: 'Salbutamol Inhaler 100mcg',quantity: 0,   price: 140.00, expiry_date: addDays(365), threshold: 10 }, // Out of stock
  { name: 'Vitamin D3 60k IU',        quantity: 40,  price: 110.00, expiry_date: addDays(-10), threshold: 10 }, // Expired
  { name: 'Doxycycline 100mg',        quantity: 70,  price: 38.00,  expiry_date: addDays(210), threshold: 15 },
  { name: 'ORS Sachet 21.8g',         quantity: 250, price: 20.00,  expiry_date: addDays(730), threshold: 30 },
];

(async () => {
  try {
    for (const u of demoUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.query(
        `INSERT INTO users (name, username, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [u.name, u.username, hash, u.role]
      );
    }
    console.log('Demo users ready:');
    demoUsers.forEach((u) => console.log(`  ${u.role.padEnd(13)} ${u.username} / ${u.password}`));

    // Seed demo doctor profile for doctor1 (FR-3.x)
    const docUserRes = await db.query("SELECT user_id FROM users WHERE username = 'doctor1'");
    if (docUserRes.rows[0]) {
      const docUserId = docUserRes.rows[0].user_id;
      const availability = JSON.stringify({
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        start: '09:00',
        end: '13:00',
      });
      await db.query(
        `INSERT INTO doctors (user_id, specialization, qualification, fee, availability)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
         SET specialization = EXCLUDED.specialization,
             qualification = EXCLUDED.qualification,
             fee = EXCLUDED.fee,
             availability = EXCLUDED.availability`,
        [docUserId, 'General Medicine', 'MBBS, MD', 500.00, availability]
      );
      console.log('Demo doctor profile seeded for doctor1 (Mon-Sat, 09:00 to 13:00).');
    }

    // Seed a demo patient if none exists (for quick appointment booking)
    const patRes = await db.query('SELECT patient_id FROM patients LIMIT 1');
    if (patRes.rows.length === 0) {
      await db.query(
        `INSERT INTO patients (name, age, gender, phone, address, blood_group)
         VALUES ('Ramesh Patel', 42, 'Male', '9876543210', '12 Gandhi Road, Mumbai', 'O+')`
      );
      console.log('Demo patient seeded: Ramesh Patel (P-0001).');
    }

    // Seed 15 common medicines (FR-7.1)
    for (const m of demoMedicines) {
      const existing = await db.query('SELECT medicine_id FROM medicines WHERE name = $1', [m.name]);
      if (existing.rows[0]) {
        await db.query(
          `UPDATE medicines
           SET quantity = $1, price = $2, expiry_date = $3, threshold = $4
           WHERE medicine_id = $5`,
          [m.quantity, m.price, m.expiry_date, m.threshold, existing.rows[0].medicine_id]
        );
      } else {
        await db.query(
          `INSERT INTO medicines (name, quantity, price, expiry_date, threshold)
           VALUES ($1, $2, $3, $4, $5)`,
          [m.name, m.quantity, m.price, m.expiry_date, m.threshold]
        );
      }
    }
    console.log(`Seeded ${demoMedicines.length} common medicines with stock and expiry alerts.`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
