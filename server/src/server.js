import app from './app.js';
import { env } from './config/env.js';
import { closePool } from './config/db.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.port, () => {
  logger.info('API server started', {
    port: env.port,
    environment: env.nodeEnv,
  });
  console.log(`API running on http://localhost:${env.port}`);
});

server.on('error', (error) => {
  logger.error('Server startup error', error);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info('Shutdown signal received', { signal });

  server.close(async () => {
    try {
      await closePool();
      logger.info('HTTP server and PostgreSQL pool closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error while closing PostgreSQL pool', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
