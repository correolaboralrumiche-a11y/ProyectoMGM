import dotenv from 'dotenv';

dotenv.config();

function readValue(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  return String(value).trim();
}

function required(name, fallback = undefined) {
  const value = readValue(name, fallback);
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInteger(name, fallback) {
  const raw = readValue(name, fallback);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return Math.trunc(value);
}

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: readValue('NODE_ENV', 'development'),
  appName: readValue('APP_NAME', 'ProyectoMGM'),
  port: parsePositiveInteger('PORT', '4000'),
  logLevel: readValue('LOG_LEVEL', 'info').toLowerCase(),
  corsOrigins: parseList(readValue('CORS_ORIGIN') || readValue('CORS_ORIGINS'), ['http://localhost:5173']),

  dbHost: required('DB_HOST', 'localhost'),
  dbPort: parsePositiveInteger('DB_PORT', '5432'),
  dbName: required('DB_NAME'),
  dbUser: required('DB_USER'),
  dbPassword: required('DB_PASSWORD'),
  dbPoolMax: parsePositiveInteger('DB_POOL_MAX', '10'),
  dbIdleTimeoutMs: parsePositiveInteger('DB_IDLE_TIMEOUT_MS', '30000'),
  dbConnectionTimeoutMs: parsePositiveInteger('DB_CONNECTION_TIMEOUT_MS', '5000'),

  authSessionHours: parsePositiveInteger('AUTH_SESSION_HOURS', '12'),

  seedAdminPassword: readValue('SEED_ADMIN_PASSWORD', 'Admin123!'),
  seedPlannerPassword: readValue('SEED_PLANNER_PASSWORD', 'Planner123!'),
  seedViewerPassword: readValue('SEED_VIEWER_PASSWORD', 'Viewer123!'),
};

env.isDevelopment = env.nodeEnv === 'development';
env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

export default env;
