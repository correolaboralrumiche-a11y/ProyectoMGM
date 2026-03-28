import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

function requiredEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const pool = new Pool({
  host: requiredEnv('DB_HOST', 'localhost'),
  port: Number(requiredEnv('DB_PORT', '5432')),
  database: requiredEnv('DB_NAME'),
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  allowExitOnIdle: true,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export async function query(text, params = [], executor = pool) {
  return executor.query(text, params);
}

export async function withTransaction(callback, options = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (options.isolationLevel) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function healthcheckDatabase() {
  const result = await pool.query(
    `
      SELECT NOW() AS now, current_database() AS database_name
    `
  );

  return result.rows[0] || null;
}

export async function closePool() {
  await pool.end();
}

export default {
  pool,
  query,
  withTransaction,
  healthcheckDatabase,
  closePool,
};
