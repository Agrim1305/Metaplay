require('dotenv').config();

const { Pool } = require('pg');

const {
  PGHOST,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGPORT
} = process.env;

if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
  console.error('[db] Missing required Postgres environment variables');
  console.error('[db] Need: PGHOST, PGUSER, PGPASSWORD, PGDATABASE');
  process.exit(1);
}

const pool = new Pool({
  host: PGHOST,
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  port: PGPORT ? Number(PGPORT) : 5432,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

(async () => {
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT current_database() as db, current_user as "user"');
    client.release();
    console.log(`[db] Connected to Postgres: ${rows[0].db} as ${rows[0].user}`);
  } catch (err) {
    console.error('[db] Connection test failed:', err.code || err.message);
    console.error('[db] host=%s user=%s db=%s', PGHOST, PGUSER, PGDATABASE);
    console.error(err);
    process.exit(1);
  }
})();

module.exports = pool;
