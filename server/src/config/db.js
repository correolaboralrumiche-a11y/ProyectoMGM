import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  max: env.dbPoolMax,
  idleTimeoutMillis: env.dbIdleTimeoutMs,
  connectionTimeoutMillis: env.dbConnectionTimeoutMs,
  allowExitOnIdle: true,
});

pool.on('error', (error) => {
  logger.error('Unexpected PostgreSQL pool error', error);
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
      logger.error('Rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getMigrationStatus(executor = pool) {
  try {
    const summary = await executor.query(`
      SELECT
        COUNT(*)::int AS applied_count,
        COALESCE(MAX(batch), 0)::int AS latest_batch
      FROM knex_migrations
    `);

    const latest = await executor.query(`
      SELECT name, batch, migration_time
      FROM knex_migrations
      ORDER BY id DESC
      LIMIT 1
    `);

    return {
      applied_count: Number(summary.rows[0]?.applied_count || 0),
      latest_batch: Number(summary.rows[0]?.latest_batch || 0),
      latest_migration: latest.rows[0]?.name || null,
      latest_migration_time: latest.rows[0]?.migration_time || null,
    };
  } catch (error) {
    if (error?.code === '42P01') {
      return {
        applied_count: 0,
        latest_batch: 0,
        latest_migration: null,
        latest_migration_time: null,
      };
    }

    throw error;
  }
}

export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export async function healthcheckDatabase() {
  const result = await pool.query(`
    SELECT
      NOW() AS now,
      current_database() AS database_name,
      current_user AS database_user,
      version() AS postgres_version
  `);

  const database = result.rows[0] || null;
  const migrations = await getMigrationStatus();

  return {
    database,
    migrations,
    pool: getPoolStats(),
  };
}

export async function closePool() {
  await pool.end();
}

export default {
  pool,
  query,
  withTransaction,
  getMigrationStatus,
  getPoolStats,
  healthcheckDatabase,
  closePool,
};
