const DEFAULT_SESSION_HOURS = 12;

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const securityConfig = {
  sessionHours: parseNumber(process.env.AUTH_SESSION_HOURS, DEFAULT_SESSION_HOURS),
};

export default securityConfig;
