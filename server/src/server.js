import app from './app.js';
import { closePool } from './config/db.js';

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await closePool();
      process.exit(0);
    } catch (error) {
      console.error('Error while closing PostgreSQL pool:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
