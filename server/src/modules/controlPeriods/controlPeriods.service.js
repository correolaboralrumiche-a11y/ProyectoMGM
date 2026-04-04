import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { normalizeOptionalDate } from '../../utils/date.js';
import { extractActorId } from '../../utils/audit.js';
import { activitiesRepository } from '../activities/activities.repository.js';
import { baselinesRepository } from '../baselines/baselines.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { controlPeriodsRepository } from './controlPeriods.repository.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRequiredDate(value, label) {
  const normalized = normalizeOptionalDate(value);
  if (!normalized) {
    throw new AppError(`${label} is required`, 400);
  }
  return normalized;
}

function ensureOrderedDates(startDate, cutoffDate, endDate) {
  if (startDate && cutoffDate && startDate > cutoffDate) {
    throw new AppError('Financial period cutoff date must be greater than or equal to start date', 400);
  }
  if (cutoffDate && endDate && cutoffDate > endDate) {
    throw new AppError('Financial period end date must be greater than or equal to cutoff date', 400);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new AppError('Financial period end date must be greater than or equal to start date', 400);
  }
}

function validateFinancialRange(startDate, snapshotDate, endDate) {
  if (startDate && snapshotDate && snapshotDate < startDate) {
    throw new AppError('Snapshot date must be greater than or equal to the financial period start date', 400);
  }
  if (endDate && snapshotDate && snapshotDate > endDate) {
    throw new AppError('Snapshot date must be less than or equal to the financial period end date', 400);
  }
}

function normalizeSnapshotDate(inputValue, financialPeriod) {
  const normalized = normalizeOptionalDate(inputValue || financialPeriod.cutoff_date || financialPeriod.end_date);
  if (!normalized) {
    throw new AppError('Snapshot date is required', 400);
  }
  validateFinancialRange(financialPeriod.start_date, normalized, financialPeriod.end_date);
  return normalized;
}

function buildDefaultFinancialPeriodName(periodCode) {
  return `Periodo Financiero ${periodCode}`;
}

function financialPeriodAuditSnapshot(period) {
  if (!period) return null;

  return {
    id: period.id,
    project_id: period.project_id,
    period_code: period.period_code,
    name: period.name,
    start_date: period.start_date || null,
    cutoff_date: period.cutoff_date || null,
    end_date: period.end_date || null,
    sort_order: Number(period.sort_order || 0),
    has_snapshot: Boolean(period.has_snapshot),
    snapshot_status_code: period.snapshot_status_code || null,
    snapshot_date: period.snapshot_date || null,
  };
}

function periodAuditSnapshot(period) {
  if (!period) return null;

  return {
    id: period.id,
    project_id: period.project_id,
    financial_period_id: period.financial_period_id || null,
    period_code: period.period_code,
    name: period.name,
    start_date: period.start_date || null,
    end_date: period.end_date || null,
    snapshot_date: period.snapshot_date || null,
    status_code: period.status_code || 'closed',
    summary_activity_count: Number(period.summary_activity_count || 0),
    summary_budget_hours: Number(period.summary_budget_hours || 0),
    summary_budget_cost: Number(period.summary_budget_cost || 0),
    summary_baseline_budget_hours: Number(period.summary_baseline_budget_hours || 0),
    summary_baseline_budget_cost: Number(period.summary_baseline_budget_cost || 0),
    summary_ev_amount: Number(period.summary_ev_amount || 0),
    summary_weighted_progress: Number(period.summary_weighted_progress || 0),
    summary_completed_activities: Number(period.summary_completed_activities || 0),
    closed_at: period.closed_at || null,
    reopened_at: period.reopened_at || null,
  };
}

async function ensureFinancialPeriodExists(financialPeriodId, executor) {
  const normalizedId = normalizeText(financialPeriodId);
  if (!normalizedId) {
    throw new AppError('financial_period_id is required', 400);
  }

  const financialPeriod = await controlPeriodsRepository.findFinancialPeriodById(normalizedId, executor);
  if (!financialPeriod || financialPeriod.is_active === false) {
    throw new AppError('Financial period not found', 404);
  }

  return financialPeriod;
}

async function ensureSnapshotExists(periodId, executor) {
  const normalizedId = normalizeText(periodId);
  if (!normalizedId) {
    throw new AppError('periodId is required', 400);
  }

  const period = await controlPeriodsRepository.findById(normalizedId, executor);
  if (!period || period.is_active === false) {
    throw new AppError('Financial period snapshot not found', 404);
  }

  return period;
}

async function getLatestBaselineForProject(projectId, executor) {
  const baselines = await baselinesRepository.listByProject(projectId, executor);
  const ordered = (Array.isArray(baselines) ? baselines : [])
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const latest = ordered[0] || null;
  if (!latest) {
    return { header: null, activities: [] };
  }

  const activities = await baselinesRepository.getBaselineActivities(latest.id, executor);
  return {
    header: latest,
    activities: Array.isArray(activities) ? activities : [],
  };
}

function buildBaselineActivityMap(baselineActivities = []) {
  const map = new Map();

  for (const activity of baselineActivities) {
    if (!activity) continue;

    const normalized = {
      baseline_id: activity.project_baseline_id || activity.baseline_id || null,
      source_activity_id: activity.source_activity_id || null,
      source_wbs_id: activity.source_wbs_id || null,
      activity_id: activity.activity_id || null,
      name: activity.name || '',
      start_date: activity.start_date || null,
      end_date: activity.end_date || null,
      duration: normalizeNumber(activity.duration, 0),
      progress: normalizeNumber(activity.progress, 0),
      hours: normalizeNumber(activity.hours, 0),
      cost: normalizeNumber(activity.cost, 0),
      status: activity.status || null,
      sort_order: normalizeNumber(activity.sort_order, 0),
    };

    if (normalized.source_activity_id) {
      map.set(`source:${normalized.source_activity_id}`, normalized);
    }
    if (normalized.activity_id) {
      map.set(`activity:${String(normalized.activity_id).trim().toUpperCase()}`, normalized);
    }
  }

  return map;
}

async function enrichActivitiesWithBaselineAndEv(projectId, activities, executor) {
  const { header, activities: baselineActivities } = await getLatestBaselineForProject(projectId, executor);
  const baselineMap = buildBaselineActivityMap(baselineActivities);

  const enriched = (Array.isArray(activities) ? activities : []).map((activity) => {
    const baseline =
      baselineMap.get(`source:${activity.id}`) ||
      baselineMap.get(`activity:${String(activity.activity_id || '').trim().toUpperCase()}`) ||
      null;

    const progress = normalizeNumber(activity.progress, 0);
    const baselineBudgetCost = normalizeNumber(baseline?.cost, 0);
    const evAmount = Number(((baselineBudgetCost * progress) / 100).toFixed(2));

    return {
      ...activity,
      baseline,
      ev_amount: evAmount,
      baseline_budget_cost: baselineBudgetCost,
      baseline_budget_hours: normalizeNumber(baseline?.hours, 0),
      baseline_start_date: baseline?.start_date || null,
      baseline_end_date: baseline?.end_date || null,
      baseline_duration: normalizeNumber(baseline?.duration, 0),
      baseline_header_id: header?.id || null,
      baseline_header_name: header?.name || null,
    };
  });

  return {
    baselineHeader: header,
    activities: enriched,
  };
}

function buildSnapshotsFromActivities(activities = []) {
  return activities.map((activity) => ({
    activity_id: activity.id,
    wbs_id: activity.wbs_id || null,
    wbs_code: activity.wbs_code || '',
    wbs_name: activity.wbs_name || '',
    activity_code: activity.activity_id || '',
    activity_name: activity.name || '',
    start_date: activity.start_date || null,
    end_date: activity.end_date || null,
    duration_days: normalizeNumber(activity.duration, 0),
    progress_percent: normalizeNumber(activity.progress, 0),
    budget_hours: normalizeNumber(activity.hours, 0),
    budget_cost: normalizeNumber(activity.cost, 0),
    baseline_start_date: activity.baseline_start_date || activity.baseline?.start_date || null,
    baseline_end_date: activity.baseline_end_date || activity.baseline?.end_date || null,
    baseline_duration_days: normalizeNumber(activity.baseline_duration ?? activity.baseline?.duration, 0),
    baseline_budget_hours: normalizeNumber(activity.baseline_budget_hours ?? activity.baseline?.hours, 0),
    baseline_budget_cost: normalizeNumber(activity.baseline_budget_cost ?? activity.baseline?.cost, 0),
    ev_amount: normalizeNumber(activity.ev_amount, 0),
    status_code: activity.status_code || 'not_started',
    sort_order: normalizeNumber(activity.sort_order, 0),
  }));
}

function summarizeSnapshots(snapshots = []) {
  const summary = {
    summary_activity_count: snapshots.length,
    summary_budget_hours: 0,
    summary_budget_cost: 0,
    summary_baseline_budget_hours: 0,
    summary_baseline_budget_cost: 0,
    summary_ev_amount: 0,
    summary_weighted_progress: 0,
    summary_completed_activities: 0,
  };

  let weightedAccumulator = 0;
  let totalWeight = 0;
  let simpleProgressAccumulator = 0;

  for (const snapshot of snapshots) {
    const budgetHours = normalizeNumber(snapshot.budget_hours, 0);
    const budgetCost = normalizeNumber(snapshot.budget_cost, 0);
    const baselineHours = normalizeNumber(snapshot.baseline_budget_hours, 0);
    const baselineCost = normalizeNumber(snapshot.baseline_budget_cost, 0);
    const progress = normalizeNumber(snapshot.progress_percent, 0);
    const evAmount = normalizeNumber(snapshot.ev_amount, 0);
    const status = normalizeText(snapshot.status_code).toLowerCase();
    const weight = baselineCost > 0
      ? baselineCost
      : budgetCost > 0
        ? budgetCost
        : baselineHours > 0
          ? baselineHours
          : budgetHours;

    summary.summary_budget_hours += budgetHours;
    summary.summary_budget_cost += budgetCost;
    summary.summary_baseline_budget_hours += baselineHours;
    summary.summary_baseline_budget_cost += baselineCost;
    summary.summary_ev_amount += evAmount;
    simpleProgressAccumulator += progress;

    if (weight > 0) {
      weightedAccumulator += progress * weight;
      totalWeight += weight;
    }

    if (progress >= 100 || ['completed', 'complete', 'done', 'finished'].includes(status)) {
      summary.summary_completed_activities += 1;
    }
  }

  if (snapshots.length > 0) {
    summary.summary_weighted_progress = totalWeight > 0
      ? Number((weightedAccumulator / totalWeight).toFixed(2))
      : Number((simpleProgressAccumulator / snapshots.length).toFixed(2));
  }

  summary.summary_budget_hours = Number(summary.summary_budget_hours.toFixed(2));
  summary.summary_budget_cost = Number(summary.summary_budget_cost.toFixed(2));
  summary.summary_baseline_budget_hours = Number(summary.summary_baseline_budget_hours.toFixed(2));
  summary.summary_baseline_budget_cost = Number(summary.summary_baseline_budget_cost.toFixed(2));
  summary.summary_ev_amount = Number(summary.summary_ev_amount.toFixed(2));

  return summary;
}

function buildSnapshotRecord(financialPeriod, snapshotDate, actorId, summary, closeNotes) {
  const nowIso = new Date().toISOString();

  return {
    project_id: financialPeriod.project_id,
    financial_period_id: financialPeriod.id,
    period_code: financialPeriod.period_code,
    name: financialPeriod.name,
    start_date: financialPeriod.start_date,
    end_date: financialPeriod.end_date,
    snapshot_date: snapshotDate,
    status_code: 'closed',
    is_active: true,
    opened_at: nowIso,
    closed_at: nowIso,
    reopened_at: null,
    close_notes: closeNotes,
    created_by: actorId || null,
    updated_by: actorId || null,
    ...summary,
  };
}

function buildFinancialPeriodPayload(projectId, payload, existing = null, nextSortOrder = 0, actorId = null) {
  const sortOrder = Object.prototype.hasOwnProperty.call(payload || {}, 'sort_order')
    ? normalizeNumber(payload.sort_order, existing?.sort_order || 0)
    : normalizeNumber(existing?.sort_order, nextSortOrder);

  const startDate = Object.prototype.hasOwnProperty.call(payload || {}, 'start_date')
    ? normalizeRequiredDate(payload?.start_date, 'Financial period start date')
    : existing?.start_date;

  const cutoffDate = Object.prototype.hasOwnProperty.call(payload || {}, 'cutoff_date')
    ? normalizeRequiredDate(payload?.cutoff_date, 'Financial period cutoff date')
    : existing?.cutoff_date;

  const endDate = Object.prototype.hasOwnProperty.call(payload || {}, 'end_date')
    ? normalizeRequiredDate(payload?.end_date, 'Financial period end date')
    : existing?.end_date;

  ensureOrderedDates(startDate, cutoffDate, endDate);

  return {
    project_id: projectId,
    period_code: normalizeText(payload?.period_code) || existing?.period_code || `PF-${String(sortOrder).padStart(2, '0')}`,
    name: normalizeText(payload?.name) || existing?.name || buildDefaultFinancialPeriodName(normalizeText(payload?.period_code) || existing?.period_code || `PF-${String(sortOrder).padStart(2, '0')}`),
    start_date: startDate,
    cutoff_date: cutoffDate,
    end_date: endDate,
    sort_order: sortOrder,
    is_active: true,
    created_by: existing?.created_by || actorId,
    updated_by: actorId,
  };
}

async function ensureNoFinancialPeriodConflicts(projectId, patch, existingId, executor) {
  const duplicate = await controlPeriodsRepository.findFinancialPeriodByProjectAndCode(projectId, patch.period_code, existingId, executor);
  if (duplicate) {
    throw new AppError(`Financial period code ${patch.period_code} already exists for this project`, 409);
  }

  const overlap = await controlPeriodsRepository.findOverlappingFinancialPeriod(projectId, patch.start_date, patch.end_date, existingId, executor);
  if (overlap) {
    throw new AppError(`Financial period overlaps with ${overlap.period_code}`, 409);
  }
}

async function createAuditEntry(entry, executor) {
  await auditRepository.create(entry, executor);
}

async function prepareSnapshotArtifacts(projectId, executor) {
  const sourceActivities = await activitiesRepository.listByProject(projectId, executor);
  const { baselineHeader, activities } = await enrichActivitiesWithBaselineAndEv(projectId, sourceActivities, executor);
  const snapshots = buildSnapshotsFromActivities(activities);
  const summary = summarizeSnapshots(snapshots);

  return { baselineHeader, snapshots, summary };
}

async function captureSnapshotForFinancialPeriod(financialPeriod, actorId, requestContext, client, payload = {}) {
  if (financialPeriod.has_snapshot) {
    throw new AppError(`Financial period ${financialPeriod.period_code} already has a captured snapshot`, 409);
  }

  const snapshotDate = normalizeSnapshotDate(payload?.snapshot_date, financialPeriod);
  const closeNotes = normalizeOptionalText(payload?.close_notes);
  const { baselineHeader, snapshots, summary } = await prepareSnapshotArtifacts(financialPeriod.project_id, client);
  const record = buildSnapshotRecord(financialPeriod, snapshotDate, actorId, summary, closeNotes);
  const created = await controlPeriodsRepository.createSnapshot(record, client);

  await controlPeriodsRepository.replaceSnapshots(created.id, created.project_id, snapshots, client);

  await createAuditEntry(
    {
      actor_user_id: actorId,
      entity_type: 'control_period',
      entity_id: created.id,
      project_id: created.project_id,
      action: 'capture',
      summary: `Financial period snapshot captured: ${created.period_code}`,
      before_data: null,
      after_data: periodAuditSnapshot(created),
      metadata: {
        financial_period_id: financialPeriod.id,
        snapshot_date: snapshotDate,
        baseline_id: baselineHeader?.id || null,
        baseline_name: baselineHeader?.name || null,
        snapshots_count: snapshots.length,
      },
      ...requestContext,
    },
    client,
  );

  return {
    period: created,
    snapshots: await controlPeriodsRepository.listSnapshots(created.id, client),
  };
}

async function closeExistingSnapshot(period, payload, actorId, requestContext, client) {
  if (period.status_code === 'closed') {
    throw new AppError('Financial period snapshot is already closed', 409);
  }

  const linkedFinancialPeriod = period.financial_period_id
    ? await ensureFinancialPeriodExists(period.financial_period_id, client)
    : {
        project_id: period.project_id,
        start_date: period.start_date,
        cutoff_date: period.snapshot_date || period.end_date,
        end_date: period.end_date,
      };

  const snapshotDate = normalizeSnapshotDate(payload?.snapshot_date || period.snapshot_date, linkedFinancialPeriod);
  const { baselineHeader, snapshots, summary } = await prepareSnapshotArtifacts(period.project_id, client);

  await controlPeriodsRepository.replaceSnapshots(period.id, period.project_id, snapshots, client);

  const updated = await controlPeriodsRepository.updateSnapshotStatus(
    period.id,
    {
      snapshot_date: snapshotDate,
      status_code: 'closed',
      closed_at: new Date().toISOString(),
      reopened_at: null,
      close_notes: normalizeOptionalText(payload?.close_notes || period.close_notes),
      updated_by: actorId,
      ...summary,
    },
    client,
  );

  await createAuditEntry(
    {
      actor_user_id: actorId,
      entity_type: 'control_period',
      entity_id: updated.id,
      project_id: updated.project_id,
      action: 'close',
      summary: `Financial period snapshot closed: ${updated.period_code}`,
      before_data: periodAuditSnapshot(period),
      after_data: periodAuditSnapshot(updated),
      metadata: {
        snapshot_date: snapshotDate,
        baseline_id: baselineHeader?.id || null,
        baseline_name: baselineHeader?.name || null,
        snapshots_count: snapshots.length,
        close_notes: updated.close_notes || '',
      },
      ...requestContext,
    },
    client,
  );

  return {
    period: updated,
    snapshots: await controlPeriodsRepository.listSnapshots(updated.id, client),
  };
}

export const controlPeriodsService = {
  async listFinancialPeriods(projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }
    return controlPeriodsRepository.listFinancialPeriodsByProject(normalizedProjectId);
  },

  async createFinancialPeriod(payload, actor, requestContext = {}) {
    const projectId = normalizeText(payload?.project_id);
    const actorId = extractActorId(actor);

    if (!projectId) {
      throw new AppError('project_id is required', 400);
    }

    return withTransaction(async (client) => {
      const nextSortOrder = await controlPeriodsRepository.getNextFinancialPeriodSortOrder(projectId, client);
      const patch = buildFinancialPeriodPayload(projectId, payload, null, nextSortOrder, actorId);

      await ensureNoFinancialPeriodConflicts(projectId, patch, null, client);

      const created = await controlPeriodsRepository.createFinancialPeriod(patch, client);

      await createAuditEntry(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period',
          entity_id: created.id,
          project_id: projectId,
          action: 'create',
          summary: `Financial period defined: ${created.period_code}`,
          before_data: null,
          after_data: financialPeriodAuditSnapshot(created),
          ...requestContext,
        },
        client,
      );

      return created;
    });
  },

  async updateFinancialPeriod(financialPeriodId, payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureFinancialPeriodExists(financialPeriodId, client);

      if (existing.has_snapshot) {
        throw new AppError(`Financial period ${existing.period_code} already has a captured snapshot and cannot be edited`, 409);
      }

      const patch = buildFinancialPeriodPayload(existing.project_id, payload, existing, existing.sort_order || 0, actorId);

      await ensureNoFinancialPeriodConflicts(existing.project_id, patch, existing.id, client);

      const updated = await controlPeriodsRepository.updateFinancialPeriod(existing.id, patch, client);

      await createAuditEntry(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'update',
          summary: `Financial period updated: ${updated.period_code}`,
          before_data: financialPeriodAuditSnapshot(existing),
          after_data: financialPeriodAuditSnapshot(updated),
          ...requestContext,
        },
        client,
      );

      return updated;
    });
  },

  async deleteFinancialPeriod(financialPeriodId, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const existing = await ensureFinancialPeriodExists(financialPeriodId, client);

      if (existing.has_snapshot) {
        throw new AppError(`Financial period ${existing.period_code} already has a captured snapshot and cannot be deleted`, 409);
      }

      await controlPeriodsRepository.deactivateFinancialPeriod(existing.id, actorId, client);

      await createAuditEntry(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period',
          entity_id: existing.id,
          project_id: existing.project_id,
          action: 'delete',
          summary: `Financial period deleted: ${existing.period_code}`,
          before_data: financialPeriodAuditSnapshot(existing),
          after_data: null,
          ...requestContext,
        },
        client,
      );

      return { id: existing.id };
    });
  },

  async listPeriods(projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }
    return controlPeriodsRepository.listByProject(normalizedProjectId);
  },

  async getPeriodDetail(periodId) {
    const normalizedId = normalizeText(periodId);
    if (!normalizedId) {
      throw new AppError('periodId is required', 400);
    }

    const period = await ensureSnapshotExists(normalizedId);
    return {
      period,
      snapshots: await controlPeriodsRepository.listSnapshots(period.id),
    };
  },

  async capturePeriod(payload, actor, requestContext = {}) {
    const financialPeriodId = normalizeText(payload?.financial_period_id);
    const actorId = extractActorId(actor);

    if (!financialPeriodId) {
      throw new AppError('financial_period_id is required', 400);
    }

    return withTransaction(async (client) => {
      const financialPeriod = await ensureFinancialPeriodExists(financialPeriodId, client);
      return captureSnapshotForFinancialPeriod(financialPeriod, actorId, requestContext, client, payload);
    });
  },

  async closePeriod(periodId, payload, actor, requestContext = {}) {
    const normalizedId = normalizeText(periodId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const period = await ensureSnapshotExists(normalizedId, client);
      return closeExistingSnapshot(period, payload, actorId, requestContext, client);
    });
  },

  async reopenPeriod(periodId, payload, actor, requestContext = {}) {
    const normalizedId = normalizeText(periodId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const period = await ensureSnapshotExists(normalizedId, client);

      if (period.status_code !== 'closed') {
        throw new AppError('Only closed financial period snapshots can be reopened', 409);
      }

      const updated = await controlPeriodsRepository.updateSnapshotStatus(
        period.id,
        {
          status_code: 'reopened',
          reopened_at: new Date().toISOString(),
          close_notes: normalizeOptionalText(payload?.close_notes || period.close_notes),
          updated_by: actorId,
        },
        client,
      );

      await createAuditEntry(
        {
          actor_user_id: actorId,
          entity_type: 'control_period',
          entity_id: updated.id,
          project_id: updated.project_id,
          action: 'reopen',
          summary: `Financial period snapshot reopened: ${updated.period_code}`,
          before_data: periodAuditSnapshot(period),
          after_data: periodAuditSnapshot(updated),
          ...requestContext,
        },
        client,
      );

      return {
        period: updated,
        snapshots: await controlPeriodsRepository.listSnapshots(updated.id, client),
      };
    });
  },

  async deletePeriod(periodId, actor, requestContext = {}) {
    const normalizedId = normalizeText(periodId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const period = await ensureSnapshotExists(normalizedId, client);

      if (period.status_code === 'closed') {
        throw new AppError('Closed financial period snapshots cannot be deleted. Reopen the snapshot first if you need to recapture it.', 409);
      }

      await controlPeriodsRepository.deactivatePeriod(period.id, actorId, client);

      await createAuditEntry(
        {
          actor_user_id: actorId,
          entity_type: 'control_period',
          entity_id: period.id,
          project_id: period.project_id,
          action: 'delete',
          summary: `Financial period snapshot deleted: ${period.period_code}`,
          before_data: periodAuditSnapshot(period),
          after_data: null,
          ...requestContext,
        },
        client,
      );

      return { id: period.id };
    });
  },
};
