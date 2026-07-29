import { Pool } from 'pg';

/** Single shared connection pool for the whole process. */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // A connection error on an idle client in the pool should not crash the process.
  console.error('Unexpected error on idle Postgres client', err);
});
