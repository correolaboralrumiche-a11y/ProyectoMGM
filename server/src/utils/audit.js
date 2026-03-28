export function extractActorId(actor) {
  return actor?.user?.id || actor?.user_id || actor?.id || null;
}

export function buildRequestAuditContext(req) {
  return {
    ip_address: req?.ip || null,
    user_agent: req?.get?.('user-agent') || req?.headers?.['user-agent'] || null,
  };
}

function normalizePrimitive(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  return value;
}

export function sanitizeAuditValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditValue(item))
      .filter((item) => item !== undefined);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const output = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalized = sanitizeAuditValue(nestedValue);
      if (normalized !== undefined) {
        output[key] = normalized;
      }
    }

    return output;
  }

  return normalizePrimitive(value);
}
