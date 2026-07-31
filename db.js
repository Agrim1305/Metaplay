require("dotenv").config();

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// Validate required environment variables
const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_SSL, DB_SSL_CA_PATH } =
  process.env;

let pool;

try {
  // Build SSL config only if required (Aiven requires SSL, local dev doesn't)
  let sslConfig;
  if (DB_SSL === "REQUIRED" || DB_SSL === "true") {
    // Prefer a CA path from env, fall back to the bundled Aiven cert
    const caPath =
      DB_SSL_CA_PATH || path.join(__dirname, "certs", "aiven-ca.pem");

    if (fs.existsSync(caPath)) {
      sslConfig = {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true,
      };
    } else {
      // No CA file — fall back to Node's default trust store
      sslConfig = { rejectUnauthorized: true };
    }
  }

  // Create a connection pool
  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    ssl: sslConfig,
    charset: "utf8mb4",
    namedPlaceholders: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Test a connection on startup (wrapped in an async IIFE).
  (async () => {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log(`[db] Connected to MySQL at ${DB_HOST} / ${DB_NAME}`);
    } catch (err) {
      // Log the REAL reason before exiting so crash loops are diagnosable.
      console.error("[db] Connection test failed:", err.code || err.message);
      console.error("[db] host=%s user=%s db=%s", DB_HOST, DB_USER, DB_NAME);
      console.error(err);
      process.exit(1);
    }
  })();
} catch (err) {
  console.error("[db] Failed to create pool:", err.message);
  console.error(err);
  process.exit(1);
}

module.exports = pool;
