import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { extractActorId } from '../../utils/audit.js';
import { auditRepository } from '../audit/audit.repository.js';
import { activitiesRepository } from '../activities/activities.repository.js';
import { baselinesRepository } from '../baselines/baselines.repository.js';
import { layoutTemplatesRepository } from './layoutTemplates.repository.js';

const BASE_LEVELS = ['project', 'wbs', 'activity'];
const TIME_SCALES = ['weekly', 'monthly'];

const GENERAL_COLUMNS = {
  code: { key: 'code', label: 'Code', types: ['project', 'wbs', 'activity'] },
  name: { key: 'name', label: 'Name', types: ['project', 'wbs', 'activity'] },
  start_date: { key: 'start_date', label: 'Start', types: ['project', 'wbs', 'activity'] },
  finish_date: { key: 'finish_date', label: 'Finish', types: ['project', 'wbs', 'activity'] },
  baseline_start_date: { key: 'baseline_start_date', label: 'Baseline Start', types: ['project', 'wbs', 'activity'] },
  baseline_end_date: { key: 'baseline_end_date', label: 'Baseline Finish', types: ['project', 'wbs', 'activity'] },
  budget_hours: { key: 'budget_hours', label: 'Budget HH', types: ['project', 'wbs', 'activity'] },
  budget_cost: { key: 'budget_cost', label: 'Budget Cost', types: ['project', 'wbs', 'activity'] },
  baseline_hours: { key: 'baseline_hours', label: 'Baseline HH', types: ['project', 'wbs', 'activity'] },
  baseline_cost: { key: 'baseline_cost', label: 'Baseline Cost', types: ['project', 'wbs', 'activity'] },
  progress: { key: 'progress', label: 'Progress %', types: ['project', 'wbs', 'activity'] },
  ev_amount: { key: 'ev_amount', label: 'EV', types: ['project', 'wbs', 'activity'] },
  status: { key: 'status', label: 'Status', types: ['activity'] },
  discipline: { key: 'discipline', label: 'Discipline', types: ['activity'] },
  priority: { key: 'priority', label: 'Priority', types: ['activity'] },
};

const METRIC_CATALOG = {
  ev: {
    key: 'ev',
    label: 'EV',
    source_type: 'stored_period_snapshot',
    supported_modes: ['cumulative', 'period'],
    supported_scales: ['weekly', 'monthly'],
    additive: true,
    value_field: 'ev_amount',
  },
  progress: {
    key: 'progress',
    label: 'Progress %',
    source_type: 'stored_period_snapshot',
    supported_modes: ['cumulative', 'period'],
    supported_scales: ['weekly', 'monthly'],
    additive: false,
    value_field: 'progress_percent',
  },
  baseline_hours: {
    key: 'baseline_hours',
    label: 'Baseline HH',
    source_type: 'derived_from_baseline',
    supported_modes: ['spread'],
    supported_scales: ['weekly', 'monthly'],
    additive: true,
    value_field: 'baseline_budget_hours',
  },
  baseline_cost: {
    key: 'baseline_cost',
    label: 'Baseline Cost',
    source_type: 'derived_from_baseline',
    supported_modes: ['spread'],
    supported_scales: ['weekly', 'monthly'],
    additive: true,
    value_field: 'baseline_budget_cost',
  },
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizeDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const normalized = String(value).trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function parseDate(value) {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToIso(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function monthKey(date) {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

function monthLabel(date) {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function inclusiveDayDiff(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function overlapDaysInclusive(rangeStart, rangeEnd, bucketStart, bucketEnd) {
  const start = parseDate(rangeStart);
  const end = parseDate(rangeEnd);
  const bucketS = parseDate(bucketStart);
  const bucketE = parseDate(bucketEnd);
  if (!start || !end || !bucketS || !bucketE) return 0;

  const effectiveStart = start > bucketS ? start : bucketS;
  const effectiveEnd = end < bucketE ? end : bucketE;
  if (effectiveEnd < effectiveStart) return 0;
  return Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1;
}

function buildCatalog() {
  return {
    base_levels: BASE_LEVELS.map((value) => ({ value, label: value.toUpperCase() })),
    time_scales: TIME_SCALES.map((value) => ({ value, label: value === 'weekly' ? 'Weekly' : 'Monthly' })),
    general_columns: Object.values(GENERAL_COLUMNS),
    metrics: Object.values(METRIC_CATALOG).map((metric) => ({
      key: metric.key,
      label: metric.label,
      source_type: metric.source_type,
      supported_modes: metric.supported_modes,
      supported_scales: metric.supported_scales,
    })),
  };
}

function ensureValidBaseLevel(baseLevel) {
  if (!BASE_LEVELS.includes(baseLevel)) {
    throw new AppError('Invalid base_level', 400);
  }
}

function ensureValidScale(scale) {
  if (!TIME_SCALES.includes(scale)) {
    throw new AppError('Invalid time_scale', 400);
  }
}

function ensureValidMetric(metricKey, mode) {
  const metric = METRIC_CATALOG[metricKey];
  if (!metric) {
    throw new AppError('Invalid time_metric', 400);
  }
  if (!metric.supported_modes.includes(mode)) {
    throw new AppError('Invalid time_mode for selected time_metric', 400);
  }
  return metric;
}

function normalizeColumns(columns = [], baseLevel = 'activity') {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new AppError('At least one visible column is required', 400);
  }

  const seen = new Set();
  const normalized = columns.map((column, index) => {
    const columnKey = normalizeText(column?.column_key);
    const meta = GENERAL_COLUMNS[columnKey];
    if (!meta) {
      throw new AppError(`Invalid column_key: ${columnKey || '(empty)'}`, 400);
    }
    if (!meta.types.includes(baseLevel) && !(baseLevel === 'activity' && meta.types.includes('project'))) {
      // keep permissive for activity templates; stricter validation below for explicit unsupported columns
    }
    if (seen.has(columnKey)) {
      throw new AppError(`Duplicate column_key: ${columnKey}`, 400);
    }
    seen.add(columnKey);

    return {
      column_key: columnKey,
      display_order: Number.isFinite(Number(column?.display_order)) ? Number(column.display_order) : index + 1,
      is_visible: normalizeBoolean(column?.is_visible, true),
    };
  });

  return normalized.sort((a, b) => a.display_order - b.display_order);
}

function validateColumnsAgainstBaseLevel(columns, baseLevel) {
  const invalid = columns.filter((column) => !GENERAL_COLUMNS[column.column_key]?.types.includes(baseLevel) && baseLevel !== 'activity');
  if (invalid.length > 0) {
    throw new AppError(`Columns not supported for base_level ${baseLevel}: ${invalid.map((item) => item.column_key).join(', ')}`, 400);
  }
}

async function getTemplateOrThrow(id) {
  const template = await layoutTemplatesRepository.findById(id);
  if (!template || !template.is_active) {
    throw new AppError('Layout template not found', 404);
  }
  const columns = await layoutTemplatesRepository.listColumns(id);
  return { ...template, columns };
}

function buildTemplateAuditSnapshot(template) {
  return {
    id: template.id,
    project_id: template.project_id,
    name: template.name,
    base_level: template.base_level,
    time_metric: template.time_metric,
    time_mode: template.time_mode,
    time_scale: template.time_scale,
    columns: (template.columns || []).map((column) => ({
      column_key: column.column_key,
      display_order: column.display_order,
      is_visible: column.is_visible,
    })),
  };
}

function weightForActivity(activity) {
  const baselineCost = toNumber(activity.baseline?.cost ?? activity.baseline_budget_cost ?? 0);
  const budgetCost = toNumber(activity.cost ?? 0);
  const baselineHours = toNumber(activity.baseline?.hours ?? activity.baseline_budget_hours ?? 0);
  const budgetHours = toNumber(activity.hours ?? 0);
  return baselineCost > 0 ? baselineCost : budgetCost > 0 ? budgetCost : baselineHours > 0 ? baselineHours : budgetHours;
}

function buildWeeklyBucketsFromFinancialPeriods(financialPeriods = []) {
  return financialPeriods.map((period, index) => ({
    key: `fp:${period.id}`,
    label: period.period_code || period.name,
    short_label: period.cutoff_date ? period.cutoff_date.slice(-2) : `${index + 1}`,
    month_key: period.cutoff_date ? period.cutoff_date.slice(0, 7) : (period.start_date || '').slice(0, 7),
    month_label: monthLabel(parseDate(period.cutoff_date || period.start_date || period.end_date) || new Date()),
    start_date: period.start_date,
    end_date: period.end_date,
    cutoff_date: period.cutoff_date,
    financial_period_id: period.id,
    snapshot_id: period.snapshot_id || null,
    bucket_type: 'weekly',
    order: index,
  }));
}

function buildMonthlyBucketsFromRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return [];

  const buckets = [];
  let cursor = startOfMonth(start);
  let order = 0;
  while (cursor <= end) {
    const bucketStart = cursor < start ? start : cursor;
    const bucketEnd = endOfMonth(cursor) > end ? end : endOfMonth(cursor);
    buckets.push({
      key: `month:${monthKey(cursor)}`,
      label: monthLabel(cursor),
      short_label: monthLabel(cursor),
      month_key: monthKey(cursor),
      month_label: monthLabel(cursor),
      start_date: dateToIso(bucketStart),
      end_date: dateToIso(bucketEnd),
      bucket_type: 'monthly',
      order,
    });
    cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
    order += 1;
  }

  return buckets;
}

function buildWeeklyBucketsFromRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return [];

  const buckets = [];
  let cursor = start;
  let order = 0;
  while (cursor <= end) {
    const bucketStart = cursor;
    const bucketEnd = addDays(cursor, 6) > end ? end : addDays(cursor, 6);
    const labelDate = bucketEnd;
    buckets.push({
      key: `week:${dateToIso(bucketEnd)}`,
      label: dateToIso(bucketEnd),
      short_label: dateToIso(bucketEnd).slice(-2),
      month_key: monthKey(labelDate),
      month_label: monthLabel(labelDate),
      start_date: dateToIso(bucketStart),
      end_date: dateToIso(bucketEnd),
      bucket_type: 'weekly',
      order,
    });
    cursor = addDays(bucketEnd, 1);
    order += 1;
  }
  return buckets;
}

function buildBucketGroups(buckets = []) {
  const groups = [];
  let current = null;
  buckets.forEach((bucket, index) => {
    if (!current || current.month_key !== bucket.month_key) {
      if (current) groups.push(current);
      current = {
        month_key: bucket.month_key,
        label: bucket.month_label,
        start_index: index,
        end_index: index,
      };
    } else {
      current.end_index = index;
    }
  });
  if (current) groups.push(current);
  return groups;
}

function inferRangeFromActivities(activities = []) {
  const starts = [];
  const ends = [];
  for (const activity of activities) {
    const startDate = activity.baseline?.start_date || activity.start_date;
    const endDate = activity.baseline?.end_date || activity.end_date;
    if (startDate) starts.push(startDate);
    if (endDate) ends.push(endDate);
  }
  return {
    start_date: starts.sort()[0] || null,
    end_date: ends.sort().slice(-1)[0] || null,
  };
}

function buildPreviewContext({ template, metric, financialPeriods, activities }) {
  const range = inferRangeFromActivities(activities);
  let buckets = [];
  let source = metric.source_type;

  if (metric.source_type === 'stored_period_snapshot') {
    if (template.time_scale === 'weekly' && financialPeriods.length > 0) {
      buckets = buildWeeklyBucketsFromFinancialPeriods(financialPeriods);
    } else if (template.time_scale === 'monthly') {
      const fpStart = financialPeriods[0]?.start_date || range.start_date;
      const fpEnd = financialPeriods.at(-1)?.end_date || range.end_date;
      buckets = buildMonthlyBucketsFromRange(fpStart, fpEnd);
    }
  } else {
    if (template.time_scale === 'weekly') {
      if (financialPeriods.length > 0) {
        buckets = buildWeeklyBucketsFromFinancialPeriods(financialPeriods);
      } else {
        buckets = buildWeeklyBucketsFromRange(range.start_date, range.end_date);
        source = 'derived_from_baseline_generated_weeks';
      }
    } else {
      buckets = buildMonthlyBucketsFromRange(range.start_date, range.end_date);
    }
  }

  return {
    metric_source: source,
    inferred_range: range,
    buckets,
    bucket_groups: buildBucketGroups(buckets),
    warnings: buckets.length === 0 ? ['No time buckets could be generated for this template'] : [],
  };
}

function buildActivitySnapshotSeries(metric, buckets, financialPeriods, snapshotRowsByActivity, activityId) {
  const rows = snapshotRowsByActivity.get(activityId) || [];
  const byFinancialPeriodId = new Map();
  rows.forEach((row) => {
    if (row.financial_period_id) {
      byFinancialPeriodId.set(row.financial_period_id, row);
    }
  });

  if (metric.key === 'ev' || metric.key === 'progress') {
    const field = metric.value_field;
    if (buckets.length === 0) return [];

    if (buckets[0]?.bucket_type === 'weekly') {
      let lastCumulative = 0;
      return buckets.map((bucket) => {
        const snapshot = bucket.financial_period_id ? byFinancialPeriodId.get(bucket.financial_period_id) : null;
        const currentCumulative = snapshot ? toNumber(snapshot[field] || 0) : lastCumulative;
        const periodValue = round2(currentCumulative - lastCumulative);
        lastCumulative = currentCumulative;
        return {
          cumulative: round2(currentCumulative),
          period: round2(periodValue),
        };
      });
    }

    let lastCumulative = 0;
    const fpSeries = financialPeriods.map((period) => {
      const snapshot = byFinancialPeriodId.get(period.id);
      const currentCumulative = snapshot ? toNumber(snapshot[field] || 0) : lastCumulative;
      const periodValue = round2(currentCumulative - lastCumulative);
      lastCumulative = currentCumulative;
      return {
        month_key: (period.cutoff_date || period.start_date || period.end_date || '').slice(0, 7),
        cumulative: round2(currentCumulative),
        period: round2(periodValue),
      };
    });

    return buckets.map((bucket) => {
      const monthRows = fpSeries.filter((row) => row.month_key === bucket.month_key);
      if (monthRows.length === 0) {
        return { cumulative: 0, period: 0 };
      }
      return {
        cumulative: round2(monthRows[monthRows.length - 1].cumulative),
        period: round2(monthRows.reduce((acc, row) => acc + row.period, 0)),
      };
    });
  }

  return [];
}

function spreadValueAcrossBuckets(totalValue, startDate, endDate, buckets = []) {
  const total = toNumber(totalValue, 0);
  if (total <= 0 || !startDate || !endDate || buckets.length === 0) {
    return buckets.map(() => 0);
  }

  const totalDays = inclusiveDayDiff(startDate, endDate);
  if (totalDays <= 0) return buckets.map(() => 0);

  const raw = buckets.map((bucket) => {
    const overlap = overlapDaysInclusive(startDate, endDate, bucket.start_date, bucket.end_date);
    return overlap > 0 ? (total * overlap) / totalDays : 0;
  });

  const rounded = raw.map((value) => round2(value));
  const assigned = round2(rounded.reduce((acc, value) => acc + value, 0));
  const diff = round2(total - assigned);
  if (diff !== 0) {
    let targetIndex = -1;
    for (let index = rounded.length - 1; index >= 0; index -= 1) {
      if (rounded[index] !== 0) {
        targetIndex = index;
        break;
      }
    }
    if (targetIndex >= 0) {
      rounded[targetIndex] = round2(rounded[targetIndex] + diff);
    }
  }

  return rounded;
}

function buildActivitySpreadSeries(metric, buckets, activity) {
  const total = metric.key === 'baseline_hours'
    ? toNumber(activity.baseline?.hours ?? activity.baseline_budget_hours ?? 0)
    : toNumber(activity.baseline?.cost ?? activity.baseline_budget_cost ?? 0);
  const startDate = activity.baseline?.start_date || activity.start_date;
  const endDate = activity.baseline?.end_date || activity.end_date;
  return spreadValueAcrossBuckets(total, startDate, endDate, buckets);
}

function buildLeafColumns(activity) {
  return {
    code: activity.activity_id || '',
    name: activity.name || '',
    start_date: activity.start_date || null,
    finish_date: activity.end_date || null,
    baseline_start_date: activity.baseline?.start_date || null,
    baseline_end_date: activity.baseline?.end_date || null,
    budget_hours: round2(activity.hours || 0),
    budget_cost: round2(activity.cost || 0),
    baseline_hours: round2(activity.baseline?.hours || activity.baseline_budget_hours || 0),
    baseline_cost: round2(activity.baseline?.cost || activity.baseline_budget_cost || 0),
    progress: round2(activity.progress || 0),
    ev_amount: round2(activity.ev_amount || 0),
    status: activity.status || activity.status_name || activity.status_code || '',
    discipline: activity.discipline_name || activity.discipline_code || '',
    priority: activity.priority_name || activity.priority_code || '',
  };
}

function pickNonEmpty(values = []) {
  return values.find((value) => value !== null && value !== undefined && value !== '') || '';
}

function buildWbsMap(wbsNodes = []) {
  const byId = new Map();
  wbsNodes.forEach((node) => {
    byId.set(node.id, {
      id: node.id,
      parent_id: node.parent_id || null,
      code: node.code || '',
      name: node.name || '',
      sort_order: Number(node.sort_order || 0),
      children: [],
    });
  });
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).children.push(node.id);
    }
  });
  return byId;
}

function compareNodeOrder(a, b) {
  const sortDiff = toNumber(a.sort_order, 0) - toNumber(b.sort_order, 0);
  if (sortDiff !== 0) return sortDiff;
  return String(a.code || a.name || '').localeCompare(String(b.code || b.name || ''), undefined, { sensitivity: 'base' });
}

function computeAggregateColumns(childRows) {
  const columns = {
    code: '',
    name: '',
    start_date: null,
    finish_date: null,
    baseline_start_date: null,
    baseline_end_date: null,
    budget_hours: 0,
    budget_cost: 0,
    baseline_hours: 0,
    baseline_cost: 0,
    progress: 0,
    ev_amount: 0,
    status: '',
    discipline: '',
    priority: '',
  };

  const starts = [];
  const finishes = [];
  const baselineStarts = [];
  const baselineEnds = [];
  let weightedAccumulator = 0;
  let totalWeight = 0;
  let simpleProgressAccumulator = 0;
  let progressCount = 0;

  for (const child of childRows) {
    const c = child.columns || {};
    if (c.start_date) starts.push(c.start_date);
    if (c.finish_date) finishes.push(c.finish_date);
    if (c.baseline_start_date) baselineStarts.push(c.baseline_start_date);
    if (c.baseline_end_date) baselineEnds.push(c.baseline_end_date);
    columns.budget_hours += toNumber(c.budget_hours || 0);
    columns.budget_cost += toNumber(c.budget_cost || 0);
    columns.baseline_hours += toNumber(c.baseline_hours || 0);
    columns.baseline_cost += toNumber(c.baseline_cost || 0);
    columns.ev_amount += toNumber(c.ev_amount || 0);
    if (c.progress !== null && c.progress !== undefined && c.progress !== '') {
      simpleProgressAccumulator += toNumber(c.progress || 0);
      progressCount += 1;
      const weight = columns.baseline_cost > 0 ? 0 : 0;
      void weight;
    }
  }

  childRows.forEach((child) => {
    const c = child.columns || {};
    const weight = toNumber(c.baseline_cost || 0) || toNumber(c.budget_cost || 0) || toNumber(c.baseline_hours || 0) || toNumber(c.budget_hours || 0);
    if (weight > 0) {
      weightedAccumulator += toNumber(c.progress || 0) * weight;
      totalWeight += weight;
    }
  });

  columns.code = '';
  columns.name = '';
  columns.start_date = starts.sort()[0] || null;
  columns.finish_date = finishes.sort().slice(-1)[0] || null;
  columns.baseline_start_date = baselineStarts.sort()[0] || null;
  columns.baseline_end_date = baselineEnds.sort().slice(-1)[0] || null;
  columns.budget_hours = round2(columns.budget_hours);
  columns.budget_cost = round2(columns.budget_cost);
  columns.baseline_hours = round2(columns.baseline_hours);
  columns.baseline_cost = round2(columns.baseline_cost);
  columns.ev_amount = round2(columns.ev_amount);
  columns.progress = progressCount > 0
    ? round2(totalWeight > 0 ? weightedAccumulator / totalWeight : simpleProgressAccumulator / progressCount)
    : 0;
  columns.status = '';
  columns.discipline = '';
  columns.priority = '';

  return columns;
}

function buildTemplateRows({ template, project, wbsNodes, activities, metric, buckets, financialPeriods, snapshotRows }) {
  const rowsById = new Map();
  const projectRowId = `project:${project.id}`;
  const wbsMap = buildWbsMap(wbsNodes);
  const snapshotRowsByActivity = new Map();

  snapshotRows.forEach((row) => {
    if (!snapshotRowsByActivity.has(row.activity_id)) {
      snapshotRowsByActivity.set(row.activity_id, []);
    }
    snapshotRowsByActivity.get(row.activity_id).push(row);
  });

  const projectRow = {
    id: projectRowId,
    parent_id: null,
    row_type: 'project',
    source_id: project.id,
    depth: 0,
    sort_order: 0,
    children: [],
    columns: {
      code: project.code || '',
      name: project.name || '',
      start_date: null,
      finish_date: null,
      baseline_start_date: null,
      baseline_end_date: null,
      budget_hours: 0,
      budget_cost: 0,
      baseline_hours: 0,
      baseline_cost: 0,
      progress: 0,
      ev_amount: 0,
      status: project.status || '',
      discipline: '',
      priority: project.priority_code || '',
    },
    time_values: buckets.map(() => 0),
    time_total_value: 0,
  };
  rowsById.set(projectRow.id, projectRow);

  wbsMap.forEach((node) => {
    rowsById.set(`wbs:${node.id}`, {
      id: `wbs:${node.id}`,
      parent_id: node.parent_id ? `wbs:${node.parent_id}` : projectRowId,
      row_type: 'wbs',
      source_id: node.id,
      depth: 1,
      sort_order: node.sort_order,
      children: [],
      columns: {
        code: node.code || '',
        name: node.name || '',
        start_date: null,
        finish_date: null,
        baseline_start_date: null,
        baseline_end_date: null,
        budget_hours: 0,
        budget_cost: 0,
        baseline_hours: 0,
        baseline_cost: 0,
        progress: 0,
        ev_amount: 0,
        status: '',
        discipline: '',
        priority: '',
      },
      time_values: buckets.map(() => 0),
      time_total_value: 0,
    });
  });

  rowsById.forEach((row) => {
    if (row.parent_id && rowsById.has(row.parent_id)) {
      rowsById.get(row.parent_id).children.push(row.id);
    }
  });

  activities.forEach((activity) => {
    const activityRowId = `activity:${activity.id}`;
    const timeSeries = metric.source_type === 'stored_period_snapshot'
      ? buildActivitySnapshotSeries(metric, buckets, financialPeriods, snapshotRowsByActivity, activity.id)
      : buildActivitySpreadSeries(metric, buckets, activity);

    const timeValues = metric.source_type === 'stored_period_snapshot'
      ? timeSeries.map((item) => round2(item[template.time_mode] || 0))
      : timeSeries.map((item) => round2(item));

    const activityRow = {
      id: activityRowId,
      parent_id: activity.wbs_id ? `wbs:${activity.wbs_id}` : projectRowId,
      row_type: 'activity',
      source_id: activity.id,
      depth: 2,
      sort_order: Number(activity.sort_order || 0),
      children: [],
      columns: buildLeafColumns(activity),
      weight: weightForActivity(activity),
      time_values: timeValues,
      time_total_value: round2(
        metric.key === 'ev' || metric.key === 'baseline_hours' || metric.key === 'baseline_cost'
          ? timeValues.reduce((acc, value) => acc + value, 0)
          : template.time_mode === 'cumulative'
            ? (timeValues.filter((value) => value !== null).at(-1) || 0)
            : timeValues.reduce((acc, value) => acc + value, 0)
      ),
    };
    rowsById.set(activityRowId, activityRow);
    if (rowsById.has(activityRow.parent_id)) {
      rowsById.get(activityRow.parent_id).children.push(activityRowId);
    }
  });

  function finalizeNode(rowId, depth = 0) {
    const row = rowsById.get(rowId);
    row.depth = depth;
    const childRows = row.children
      .map((childId) => finalizeNode(childId, depth + 1))
      .sort((a, b) => compareNodeOrder(a, b));
    row.children = childRows.map((child) => child.id);

    if (row.row_type !== 'activity') {
      const directChildren = childRows;
      row.columns = {
        ...computeAggregateColumns(directChildren),
        code: row.columns.code,
        name: row.columns.name,
        status: row.columns.status,
        priority: row.columns.priority,
      };

      if (metric.additive) {
        row.time_values = buckets.map((_, index) => round2(directChildren.reduce((acc, child) => acc + toNumber(child.time_values[index] || 0), 0)));
      } else {
        row.time_values = buckets.map((_, index) => {
          let weightedAccumulator = 0;
          let totalWeight = 0;
          let simpleAccumulator = 0;
          let count = 0;
          const stack = [...directChildren];
          while (stack.length > 0) {
            const child = stack.pop();
            if (child.row_type === 'activity') {
              const value = toNumber(child.time_values[index] || 0);
              const weight = toNumber(child.weight || 0);
              if (weight > 0) {
                weightedAccumulator += value * weight;
                totalWeight += weight;
              }
              simpleAccumulator += value;
              count += 1;
            } else {
              child.children.forEach((grandChildId) => stack.push(rowsById.get(grandChildId)));
            }
          }
          if (count === 0) return 0;
          return round2(totalWeight > 0 ? weightedAccumulator / totalWeight : simpleAccumulator / count);
        });
      }

      row.time_total_value = round2(
        metric.additive
          ? row.time_values.reduce((acc, value) => acc + value, 0)
          : template.time_mode === 'cumulative'
            ? (row.time_values.filter((value) => value !== null).at(-1) || 0)
            : row.time_values.reduce((acc, value) => acc + value, 0)
      );
    }

    return row;
  }

  finalizeNode(projectRowId, 0);

  const visibleRows = [];
  function collectVisible(rowId) {
    const row = rowsById.get(rowId);
    if (!row) return;
    if (template.base_level === 'project' && row.row_type !== 'project') return;
    if (template.base_level === 'wbs' && row.row_type === 'activity') return;
    visibleRows.push({
      id: row.id,
      parent_id: row.parent_id,
      row_type: row.row_type,
      source_id: row.source_id,
      depth: row.depth,
      has_children: row.children.length > 0,
      columns: row.columns,
      time_values: row.time_values,
      time_total_value: row.time_total_value,
    });
    row.children.forEach((childId) => collectVisible(childId));
  }

  collectVisible(projectRowId);
  return visibleRows;
}

function buildResponseColumns(template) {
  return (template.columns || [])
    .filter((column) => column.is_visible !== false)
    .sort((a, b) => a.display_order - b.display_order)
    .map((column) => ({
      key: column.column_key,
      label: GENERAL_COLUMNS[column.column_key]?.label || column.column_key,
      display_order: column.display_order,
    }));
}

function buildViewerResponse({ template, metric, previewContext, project, rows }) {
  return {
    template,
    metric: {
      key: metric.key,
      label: metric.label,
      source_type: metric.source_type,
      mode: template.time_mode,
      scale: template.time_scale,
    },
    project: {
      id: project.id,
      code: project.code || '',
      name: project.name || '',
    },
    columns: buildResponseColumns(template),
    bucket_groups: previewContext.bucket_groups,
    buckets: previewContext.buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      short_label: bucket.short_label,
      month_key: bucket.month_key,
      month_label: bucket.month_label,
      start_date: bucket.start_date,
      end_date: bucket.end_date,
      cutoff_date: bucket.cutoff_date || null,
      financial_period_id: bucket.financial_period_id || null,
      snapshot_id: bucket.snapshot_id || null,
      bucket_type: bucket.bucket_type,
    })),
    rows,
  };
}

async function buildTemplateContext(template) {
  const metric = ensureValidMetric(template.time_metric, template.time_mode);
  ensureValidScale(template.time_scale);
  ensureValidBaseLevel(template.base_level);

  const [project, financialPeriods, activities, latestBaseline, wbsNodes] = await Promise.all([
    layoutTemplatesRepository.findProjectById(template.project_id),
    layoutTemplatesRepository.listProjectFinancialPeriods(template.project_id),
    activitiesRepository.listByProject(template.project_id),
    baselinesRepository.findLatestByProject(template.project_id),
    baselinesRepository.listProjectWbs(template.project_id),
  ]);

  if (!project) {
    throw new AppError('Project not found for template', 404);
  }

  const previewContext = buildPreviewContext({ template, metric, financialPeriods, activities, latestBaseline, wbsNodes });

  return {
    project,
    financialPeriods,
    activities,
    latestBaseline,
    wbsNodes,
    metric,
    previewContext,
  };
}

export const layoutTemplatesService = {
  getCatalog() {
    return buildCatalog();
  },

  async listTemplates(projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    const templates = await layoutTemplatesRepository.listByProject(normalizedProjectId);
    const templatesWithColumns = await Promise.all(
      templates.map(async (template) => ({
        ...template,
        columns: await layoutTemplatesRepository.listColumns(template.id),
      })),
    );
    return templatesWithColumns;
  },

  async getTemplate(id) {
    return getTemplateOrThrow(id);
  },

  async createTemplate(payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);
    const projectId = normalizeText(payload?.project_id);
    const name = normalizeText(payload?.name);
    const description = normalizeOptionalText(payload?.description) || '';
    const baseLevel = normalizeText(payload?.base_level);
    const timeMetric = normalizeText(payload?.time_metric);
    const timeMode = normalizeText(payload?.time_mode);
    const timeScale = normalizeText(payload?.time_scale);
    const isActive = normalizeBoolean(payload?.is_active, true);

    if (!projectId) throw new AppError('project_id is required', 400);
    if (!name) throw new AppError('name is required', 400);
    ensureValidBaseLevel(baseLevel);
    ensureValidScale(timeScale);
    ensureValidMetric(timeMetric, timeMode);
    const columns = normalizeColumns(payload?.columns || [], baseLevel);
    validateColumnsAgainstBaseLevel(columns, baseLevel);

    return withTransaction(async (client) => {
      const duplicate = await layoutTemplatesRepository.findByProjectAndName(projectId, name, null, client);
      if (duplicate) {
        throw new AppError('A template with this name already exists for the project', 409);
      }

      const created = await layoutTemplatesRepository.create(
        {
          project_id: projectId,
          name,
          description,
          base_level: baseLevel,
          time_metric: timeMetric,
          time_mode: timeMode,
          time_scale: timeScale,
          is_active: isActive,
          created_by: actorId || null,
          updated_by: actorId || null,
        },
        client,
      );
      const savedColumns = await layoutTemplatesRepository.replaceColumns(created.id, columns, client);
      const result = { ...created, columns: savedColumns };

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'layout_template',
          entity_id: created.id,
          project_id: projectId,
          action: 'create',
          summary: `Layout template created: ${name}`,
          before_data: null,
          after_data: buildTemplateAuditSnapshot(result),
          ...requestContext,
        },
        client,
      );

      return result;
    });
  },

  async updateTemplate(id, payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);
    const existing = await getTemplateOrThrow(id);

    const projectId = existing.project_id;
    const name = normalizeText(payload?.name ?? existing.name);
    const description = normalizeOptionalText(payload?.description ?? existing.description) || '';
    const baseLevel = normalizeText(payload?.base_level ?? existing.base_level);
    const timeMetric = normalizeText(payload?.time_metric ?? existing.time_metric);
    const timeMode = normalizeText(payload?.time_mode ?? existing.time_mode);
    const timeScale = normalizeText(payload?.time_scale ?? existing.time_scale);
    const isActive = normalizeBoolean(payload?.is_active, existing.is_active);

    if (!name) throw new AppError('name is required', 400);
    ensureValidBaseLevel(baseLevel);
    ensureValidScale(timeScale);
    ensureValidMetric(timeMetric, timeMode);
    const columns = normalizeColumns(payload?.columns ?? existing.columns, baseLevel);
    validateColumnsAgainstBaseLevel(columns, baseLevel);

    return withTransaction(async (client) => {
      const duplicate = await layoutTemplatesRepository.findByProjectAndName(projectId, name, id, client);
      if (duplicate) {
        throw new AppError('A template with this name already exists for the project', 409);
      }

      const updated = await layoutTemplatesRepository.update(
        id,
        {
          name,
          description,
          base_level: baseLevel,
          time_metric: timeMetric,
          time_mode: timeMode,
          time_scale: timeScale,
          is_active: isActive,
          updated_by: actorId || null,
        },
        client,
      );
      const savedColumns = await layoutTemplatesRepository.replaceColumns(id, columns, client);
      const result = { ...updated, columns: savedColumns };

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'layout_template',
          entity_id: id,
          project_id: projectId,
          action: 'update',
          summary: `Layout template updated: ${name}`,
          before_data: buildTemplateAuditSnapshot(existing),
          after_data: buildTemplateAuditSnapshot(result),
          ...requestContext,
        },
        client,
      );

      return result;
    });
  },

  async deleteTemplate(id, actor, requestContext = {}) {
    const actorId = extractActorId(actor);
    const existing = await getTemplateOrThrow(id);

    return withTransaction(async (client) => {
      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'layout_template',
          entity_id: id,
          project_id: existing.project_id,
          action: 'delete',
          summary: `Layout template deleted: ${existing.name}`,
          before_data: buildTemplateAuditSnapshot(existing),
          after_data: null,
          ...requestContext,
        },
        client,
      );

      await layoutTemplatesRepository.deactivate(id, actorId || null, client);
      return { id };
    });
  },

  async getPreviewContext(id) {
    const template = await getTemplateOrThrow(id);
    const context = await buildTemplateContext(template);
    return {
      template,
      catalog: buildCatalog(),
      preview_context: context.previewContext,
      metric: {
        key: context.metric.key,
        label: context.metric.label,
        source_type: context.metric.source_type,
        supported_modes: context.metric.supported_modes,
        supported_scales: context.metric.supported_scales,
      },
      project: {
        id: context.project.id,
        code: context.project.code || '',
        name: context.project.name || '',
      },
      latest_baseline: context.latestBaseline
        ? {
            id: context.latestBaseline.id,
            name: context.latestBaseline.name,
            created_at: context.latestBaseline.created_at,
          }
        : null,
    };
  },

  async getViewerData(id) {
    const template = await getTemplateOrThrow(id);
    const context = await buildTemplateContext(template);
    const snapshotRows = context.metric.source_type === 'stored_period_snapshot'
      ? await layoutTemplatesRepository.listProjectSnapshots(template.project_id)
      : [];

    const rows = buildTemplateRows({
      template,
      project: context.project,
      wbsNodes: context.wbsNodes,
      activities: context.activities,
      metric: context.metric,
      buckets: context.previewContext.buckets,
      financialPeriods: context.financialPeriods,
      snapshotRows,
    });

    return buildViewerResponse({
      template,
      metric: context.metric,
      previewContext: context.previewContext,
      project: context.project,
      rows,
    });
  },
};
