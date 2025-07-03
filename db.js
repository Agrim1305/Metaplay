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

  // Example: test a connection on startup (wrapped in an async IIFE)
  (async () => {
    try {
      const conn = await pool.getConnection();
      conn.release();
    } catch (err) {
      process.exit(1);
    }
  })();

} catch (err) {
  process.exit(1);
}

module.exports = pool;
