require('dotenv').config();

const mysql = require('mysql2/promise');

// Validate required environment variables
const {
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME
} = process.env;

let pool;

try {
  // Create a connection pool
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    charset: 'utf8mb4',
    namedPlaceholders: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test a connection on startup (wrapped in an async IIFE).
  (async () => {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log(`[db] Connected to MySQL at ${DB_HOST} / ${DB_NAME}`);
    } catch (err) {
      // Log the REAL reason before exiting so crash loops are diagnosable.
      console.error('[db] Connection test failed:', err.code || err.message);
      console.error('[db] host=%s user=%s db=%s', DB_HOST, DB_USER, DB_NAME);
      console.error(err);
      process.exit(1);
    }
  })();

} catch (err) {
  console.error('[db] Failed to create pool:', err.message);
  console.error(err);
  process.exit(1);
}

module.exports = pool;