import { AppError } from '../../errors/AppError.js';
import { withTransaction } from '../../config/db.js';
import { normalizeOptionalDate, isValidDateRange } from '../../utils/date.js';
import { extractActorId } from '../../utils/audit.js';
import { auditRepository } from '../audit/audit.repository.js';
import { activitiesRepository } from '../activities/activities.repository.js';
import { controlPeriodsRepository } from './controlPeriods.repository.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePeriodCode(value, startDate, endDate) {
  const explicit = normalizeText(value);
  if (explicit) return explicit.toUpperCase();

  if (!startDate || !endDate) return '';
  return `${String(startDate).replaceAll('-', '')}_${String(endDate).replaceAll('-', '')}`;
}

function normalizePeriodName(value, periodCode) {
  const explicit = normalizeText(value);
  if (explicit) return explicit;
  return `Periodo Financiero ${periodCode}`;
}

function financialPeriodAuditSnapshot(period) {
  return {
    id: period.id,
    project_id: period.project_id,
    period_code: period.period_code,
    name: period.name,
    start_date: period.start_date,
    cutoff_date: period.cutoff_date,
    end_date: period.end_date,
    sort_order: period.sort_order || 0,
    has_snapshot: Boolean(period.has_snapshot),
    snapshot_id: period.snapshot_id || null,
  };
}

function periodAuditSnapshot(period) {
  return {
    id: period.id,
    project_id: period.project_id,
    financial_period_id: period.financial_period_id || null,
    period_code: period.period_code,
    name: period.name,
    start_date: period.start_date,
    end_date: period.end_date,
    snapshot_date: period.snapshot_date || null,
    status_code: period.status_code,
    closed_at: period.closed_at || null,
    reopened_at: period.reopened_at || null,
    summary_activity_count: period.summary_activity_count || 0,
    summary_budget_hours: period.summary_budget_hours || 0,
    summary_budget_cost: period.summary_budget_cost || 0,
    summary_baseline_budget_hours: period.summary_baseline_budget_hours || 0,
    summary_baseline_budget_cost: period.summary_baseline_budget_cost || 0,
    summary_ev_amount: period.summary_ev_amount || 0,
    summary_weighted_progress: period.summary_weighted_progress || 0,
    summary_completed_activities: period.summary_completed_activities || 0,
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
    duration_days: Number(activity.duration || 0),
    progress_percent: Number(activity.progress || 0),
    budget_hours: Number(activity.hours || 0),
    budget_cost: Number(activity.cost || 0),
    baseline_start_date: activity.baseline?.start_date || null,
    baseline_end_date: activity.baseline?.end_date || null,
    baseline_duration_days: Number(activity.baseline?.duration || 0),
    baseline_budget_hours: Number(activity.baseline?.hours || 0),
    baseline_budget_cost: Number(activity.baseline?.cost || 0),
    ev_amount: Number(activity.ev_amount || 0),
    status_code: activity.status_code || 'not_started',
    sort_order: Number(activity.sort_order || 0),
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
    const budgetHours = Number(snapshot.budget_hours || 0);
    const budgetCost = Number(snapshot.budget_cost || 0);
    const baselineHours = Number(snapshot.baseline_budget_hours || 0);
    const baselineCost = Number(snapshot.baseline_budget_cost || 0);
    const progress = Number(snapshot.progress_percent || 0);
    const evAmount = Number(snapshot.ev_amount || 0);
    const status = normalizeText(snapshot.status_code).toLowerCase();
    const weight = baselineCost > 0 ? baselineCost : budgetCost > 0 ? budgetCost : baselineHours > 0 ? baselineHours : budgetHours;

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

async function ensureFinancialPeriodExists(financialPeriodId, executor) {
  const period = await controlPeriodsRepository.findFinancialPeriodById(financialPeriodId, executor);
  if (!period || !period.is_active) {
    throw new AppError('Financial period definition not found', 404);
  }
  return period;
}

async function ensureSnapshotExists(periodId, executor) {
  const period = await controlPeriodsRepository.findById(periodId, executor);
  if (!period || !period.is_active) {
    throw new AppError('Financial period snapshot not found', 404);
  }
  return period;
}

function validateFinancialRange(startDate, cutoffDate, endDate) {
  if (!startDate || !cutoffDate || !endDate) {
    throw new AppError('Start date, cutoff date and end date are required', 400);
  }

  if (!isValidDateRange(startDate, endDate)) {
    throw new AppError('End date must be greater than or equal to start date', 400);
  }

  if (!isValidDateRange(startDate, cutoffDate)) {
    throw new AppError('Cutoff date must be greater than or equal to start date', 400);
  }

  if (!isValidDateRange(cutoffDate, endDate)) {
    throw new AppError('End date must be greater than or equal to cutoff date', 400);
  }
}

async function buildNormalizedFinancialPeriod(payload, actorId, executor, existing = null) {
  const projectId = normalizeText(payload?.project_id ?? existing?.project_id);
  const startDate = normalizeOptionalDate(payload?.start_date ?? existing?.start_date);
  const cutoffDate = normalizeOptionalDate(payload?.cutoff_date ?? payload?.end_date ?? existing?.cutoff_date ?? existing?.end_date);
  const endDate = normalizeOptionalDate(payload?.end_date ?? payload?.cutoff_date ?? existing?.end_date ?? existing?.cutoff_date);

  if (!projectId) {
    throw new AppError('Project is required', 400);
  }

  validateFinancialRange(startDate, cutoffDate, endDate);

  const periodCode = normalizePeriodCode(payload?.period_code ?? existing?.period_code, startDate, cutoffDate);
  if (!periodCode) {
    throw new AppError('Period code is required', 400);
  }

  const name = normalizePeriodName(payload?.name ?? existing?.name, periodCode);
  const duplicate = await controlPeriodsRepository.findFinancialPeriodByProjectAndCode(projectId, periodCode, existing?.id || null, executor);
  if (duplicate) {
    throw new AppError('Financial period code already exists for the selected project', 409);
  }

  const duplicateCutoff = await controlPeriodsRepository.findFinancialPeriodByProjectAndCutoffDate(projectId, cutoffDate, existing?.id || null, executor);
  if (duplicateCutoff) {
    throw new AppError('Cutoff date already exists for the selected project', 409);
  }

  const overlap = await controlPeriodsRepository.findFinancialPeriodOverlap(projectId, startDate, endDate, existing?.id || null, executor);
  if (overlap) {
    throw new AppError(`Financial period overlaps with existing period ${overlap.period_code}`, 409);
  }

  return {
    project_id: projectId,
    period_code: periodCode,
    name,
    start_date: startDate,
    cutoff_date: cutoffDate,
    end_date: endDate,
    sort_order: Number(payload?.sort_order ?? existing?.sort_order ?? await controlPeriodsRepository.getNextFinancialPeriodSortOrder(projectId, executor)),
    is_active: true,
    created_by: existing?.created_by || actorId || null,
    updated_by: actorId || existing?.updated_by || null,
  };
}

function normalizeSnapshotDate(inputValue, financialPeriod) {
  const normalized = normalizeOptionalDate(inputValue || financialPeriod.cutoff_date || financialPeriod.end_date);
  if (!normalized) {
    throw new AppError('Snapshot date is required', 400);
  }

  validateFinancialRange(financialPeriod.start_date, normalized, financialPeriod.end_date);
  return normalized;
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

export const controlPeriodsService = {
  async listFinancialPeriods(projectId) {
    const normalizedProjectId = normalizeText(projectId);
    if (!normalizedProjectId) {
      throw new AppError('projectId is required', 400);
    }

    return controlPeriodsRepository.listFinancialPeriodsByProject(normalizedProjectId);
  },

  async createFinancialPeriod(payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const normalized = await buildNormalizedFinancialPeriod(payload, actorId, client);
      const created = await controlPeriodsRepository.createFinancialPeriod(normalized, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period_definition',
          entity_id: created.id,
          project_id: created.project_id,
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
        throw new AppError('Financial periods with captured snapshots cannot be edited', 409);
      }

      const normalized = await buildNormalizedFinancialPeriod(payload, actorId, client, existing);
      const updated = await controlPeriodsRepository.updateFinancialPeriod(existing.id, normalized, client);

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period_definition',
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
        throw new AppError('Financial periods with captured snapshots cannot be deleted', 409);
      }

      await auditRepository.create(
        {
          actor_user_id: actorId,
          entity_type: 'financial_period_definition',
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

      await controlPeriodsRepository.deactivateFinancialPeriod(existing.id, actorId, client);
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

    const period = await controlPeriodsRepository.findById(normalizedId);
    if (!period || !period.is_active) {
      throw new AppError('Financial period snapshot not found', 404);
    }

    const snapshots = await controlPeriodsRepository.listSnapshots(normalizedId);
    return { period, snapshots };
  },

  async capturePeriod(payload, actor, requestContext = {}) {
    const actorId = extractActorId(actor);
    const financialPeriodId = normalizeText(payload?.financial_period_id);

    if (!financialPeriodId) {
      throw new AppError('financial_period_id is required', 400);
    }

    return withTransaction(async (client) => {
      const financialPeriod = await ensureFinancialPeriodExists(financialPeriodId, client);
      if (financialPeriod.has_snapshot) {
        throw new AppError(`Financial period ${financialPeriod.period_code} already has a captured snapshot`, 409);
      }

      const snapshotDate = normalizeSnapshotDate(payload?.snapshot_date, financialPeriod);
      const closeNotes = normalizeText(payload?.close_notes);
      const activities = await activitiesRepository.listByProject(financialPeriod.project_id, client);
      const snapshots = buildSnapshotsFromActivities(activities);
      const summary = summarizeSnapshots(snapshots);
      const record = buildSnapshotRecord(financialPeriod, snapshotDate, actorId, summary, closeNotes);
      const created = await controlPeriodsRepository.createSnapshot(record, client);
      await controlPeriodsRepository.replaceSnapshots(created.id, created.project_id, snapshots, client);

      await auditRepository.create(
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
    });
  },

  async closePeriod(periodId, payload, actor, requestContext = {}) {
    const normalizedId = normalizeText(periodId);
    const actorId = extractActorId(actor);

    return withTransaction(async (client) => {
      const period = await ensureSnapshotExists(normalizedId, client);
      if (period.status_code === 'closed') {
        throw new AppError('Financial period snapshot is already closed', 409);
      }

      const linkedFinancialPeriod = period.financial_period_id
        ? await ensureFinancialPeriodExists(period.financial_period_id, client)
        : {
            start_date: period.start_date,
            cutoff_date: period.snapshot_date || period.end_date,
            end_date: period.end_date,
          };

      const snapshotDate = normalizeSnapshotDate(payload?.snapshot_date || period.snapshot_date, linkedFinancialPeriod);
      const activities = await activitiesRepository.listByProject(period.project_id, client);
      const snapshots = buildSnapshotsFromActivities(activities);
      const summary = summarizeSnapshots(snapshots);

      await controlPeriodsRepository.replaceSnapshots(period.id, period.project_id, snapshots, client);

      const updated = await controlPeriodsRepository.updateSnapshotStatus(
        period.id,
        {
          snapshot_date: snapshotDate,
          status_code: 'closed',
          closed_at: new Date().toISOString(),
          reopened_at: null,
          close_notes: normalizeText(payload?.close_notes || period.close_notes),
          updated_by: actorId,
          ...summary,
        },
        client,
      );

      await auditRepository.create(
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
          snapshot_date: period.snapshot_date,
          status_code: 'reopened',
          closed_at: null,
          reopened_at: new Date().toISOString(),
          close_notes: normalizeText(payload?.close_notes || period.close_notes),
          updated_by: actorId,
          summary_activity_count: period.summary_activity_count,
          summary_budget_hours: period.summary_budget_hours,
          summary_budget_cost: period.summary_budget_cost,
          summary_baseline_budget_hours: period.summary_baseline_budget_hours,
          summary_baseline_budget_cost: period.summary_baseline_budget_cost,
          summary_ev_amount: period.summary_ev_amount,
          summary_weighted_progress: period.summary_weighted_progress,
          summary_completed_activities: period.summary_completed_activities,
        },
        client,
      );

      await auditRepository.create(
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
        throw new AppError('Closed financial period snapshots cannot be deleted', 409);
      }

      await auditRepository.create(
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

      await controlPeriodsRepository.deactivateSnapshot(period.id, actorId, client);
      return { id: period.id };
    });
  },
};
