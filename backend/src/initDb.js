const fs = require('fs');
const path = require('path');
const db = require('./db');

async function initDb() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Initializing database schema from schema.sql...');
  await db.query(sql);
  console.log('Database schema successfully initialized.');
}

if (require.main === module) {
  initDb()
    .then(async () => {
      await db.pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = initDb;
