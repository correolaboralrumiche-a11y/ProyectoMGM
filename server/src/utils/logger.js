import { env } from '../config/env.js';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const activeLevel = LEVELS[env.logLevel] ?? LEVELS.info;

function shouldLog(level) {
  return (LEVELS[level] ?? LEVELS.info) >= activeLevel;
}

function normalizeMeta(meta) {
  if (meta == null) return undefined;
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    };
  }
  return meta;
}

function write(level, message, meta = undefined) {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    app: env.appName,
    env: env.nodeEnv,
    message,
  };

  const normalizedMeta = normalizeMeta(meta);
  if (normalizedMeta !== undefined) {
    payload.meta = normalizedMeta;
  }

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug(message, meta) {
    write('debug', message, meta);
  },
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  },
};

export default logger;
