require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('Missing JWT_SECRET or DATABASE_URL. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));

app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/medicines', require('./routes/medicines'));

app.use('/api/records', require('./routes/records'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/reports', require('./routes/reports'));

app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`HMS API running on http://localhost:${port}`));
