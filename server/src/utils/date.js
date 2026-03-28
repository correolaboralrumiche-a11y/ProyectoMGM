function extractIsoDateString(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}

function parseIsoDate(value) {
  const isoDate = extractIsoDateString(value);
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function normalizeOptionalDate(value) {
  return extractIsoDateString(value);
}

export function computeDuration(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (!start || !end) return 0;

  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

export function isValidDateRange(startDate, endDate) {
  if (!startDate || !endDate) return true;

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (!start || !end) return false;
  return end >= start;
}
