require('dotenv').config();
const { Pool, types } = require('pg');

// DATE columns come back as plain 'YYYY-MM-DD' strings, not JS Date objects (no timezone shifts)
types.setTypeParser(1082, (v) => v);

const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl =
  Boolean(process.env.DATABASE_URL) &&
  (process.env.DATABASE_URL.includes('sslmode=require') ||
    (isProduction &&
      !process.env.DATABASE_URL.includes('localhost') &&
      !process.env.DATABASE_URL.includes('127.0.0.1') &&
      !process.env.DATABASE_URL.includes('@db:')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
