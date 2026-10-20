require('dotenv').config();
const { Pool, types } = require('pg');

// DATE columns come back as plain 'YYYY-MM-DD' strings, not JS Date objects (no timezone shifts)
types.setTypeParser(1082, (v) => v);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
