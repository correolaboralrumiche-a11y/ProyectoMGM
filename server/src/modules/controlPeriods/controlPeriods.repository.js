import { pool } from '../../config/db.js';

function normalizeDateValue(value) {
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

function mapFinancialPeriod(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_id: row.project_id,
    period_code: row.period_code,
    name: row.name,
    start_date: normalizeDateValue(row.start_date),
    cutoff_date: normalizeDateValue(row.cutoff_date),
    end_date: normalizeDateValue(row.end_date),
    sort_order: Number(row.sort_order || 0),
    is_active: Boolean(row.is_active),
    snapshot_id: row.snapshot_id || null,
    snapshot_status_code: row.snapshot_status_code || null,
    snapshot_date: normalizeDateValue(row.snapshot_date),
    snapshot_closed_at: row.snapshot_closed_at || null,
    has_snapshot: Boolean(row.snapshot_id),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPeriod(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_id: row.project_id,
    financial_period_id: row.financial_period_id || null,
    period_code: row.period_code,
    name: row.name,
    start_date: normalizeDateValue(row.start_date),
    end_date: normalizeDateValue(row.end_date),
    snapshot_date: normalizeDateValue(row.snapshot_date),
    status_code: row.status_code,
    is_active: Boolean(row.is_active),
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    reopened_at: row.reopened_at,
    close_notes: row.close_notes || '',
    summary_activity_count: Number(row.summary_activity_count || 0),
    summary_budget_hours: Number(row.summary_budget_hours || 0),
    summary_budget_cost: Number(row.summary_budget_cost || 0),
    summary_baseline_budget_hours: Number(row.summary_baseline_budget_hours || 0),
    summary_baseline_budget_cost: Number(row.summary_baseline_budget_cost || 0),
    summary_ev_amount: Number(row.summary_ev_amount || 0),
    summary_weighted_progress: Number(row.summary_weighted_progress || 0),
    summary_completed_activities: Number(row.summary_completed_activities || 0),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    financial_period: row.fp_id
      ? {
          id: row.fp_id,
          period_code: row.fp_period_code,
          name: row.fp_name,
          start_date: normalizeDateValue(row.fp_start_date),
          cutoff_date: normalizeDateValue(row.fp_cutoff_date),
          end_date: normalizeDateValue(row.fp_end_date),
        }
      : null,
  };
}

function mapSnapshot(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_control_period_id: row.project_control_period_id,
    project_id: row.project_id,
    activity_id: row.activity_id,
    wbs_id: row.wbs_id,
    wbs_code: row.wbs_code || '',
    wbs_name: row.wbs_name || '',
    activity_code: row.activity_code || '',
    activity_name: row.activity_name || '',
    start_date: normalizeDateValue(row.start_date),
    end_date: normalizeDateValue(row.end_date),
    duration_days: Number(row.duration_days || 0),
    progress_percent: Number(row.progress_percent || 0),
    budget_hours: Number(row.budget_hours || 0),
    budget_cost: Number(row.budget_cost || 0),
    baseline_start_date: normalizeDateValue(row.baseline_start_date),
    baseline_end_date: normalizeDateValue(row.baseline_end_date),
    baseline_duration_days: Number(row.baseline_duration_days || 0),
    baseline_budget_hours: Number(row.baseline_budget_hours || 0),
    baseline_budget_cost: Number(row.baseline_budget_cost || 0),
    ev_amount: Number(row.ev_amount || 0),
    status_code: row.status_code || 'not_started',
    sort_order: Number(row.sort_order || 0),
    captured_at: row.captured_at,
  };
}

const FINANCIAL_PERIOD_SELECT = `
  fp.id,
  fp.project_id,
  fp.period_code,
  fp.name,
  fp.start_date,
  fp.cutoff_date,
  fp.end_date,
  fp.sort_order,
  fp.is_active,
  fp.created_by,
  fp.updated_by,
  fp.created_at,
  fp.updated_at,
  sp.id AS snapshot_id,
  sp.status_code AS snapshot_status_code,
  sp.snapshot_date AS snapshot_date,
  sp.closed_at AS snapshot_closed_at
`;

const PERIOD_SELECT = `
  p.id,
  p.project_id,
  p.financial_period_id,
  p.period_code,
  p.name,
  p.start_date,
  p.end_date,
  p.snapshot_date,
  p.status_code,
  p.is_active,
  p.opened_at,
  p.closed_at,
  p.reopened_at,
  p.close_notes,
  p.summary_activity_count,
  p.summary_budget_hours,
  p.summary_budget_cost,
  p.summary_baseline_budget_hours,
  p.summary_baseline_budget_cost,
  p.summary_ev_amount,
  p.summary_weighted_progress,
  p.summary_completed_activities,
  p.created_by,
  p.updated_by,
  p.created_at,
  p.updated_at,
  fp.id AS fp_id,
  fp.period_code AS fp_period_code,
  fp.name AS fp_name,
  fp.start_date AS fp_start_date,
  fp.cutoff_date AS fp_cutoff_date,
  fp.end_date AS fp_end_date
`;

export const controlPeriodsRepository = {
  async listFinancialPeriodsByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${FINANCIAL_PERIOD_SELECT}
        FROM project_financial_periods fp
        LEFT JOIN LATERAL (
          SELECT p.id, p.status_code, p.snapshot_date, p.closed_at
          FROM project_control_periods p
          WHERE p.financial_period_id = fp.id
            AND p.is_active = TRUE
          ORDER BY p.created_at DESC
          LIMIT 1
        ) sp ON TRUE
        WHERE fp.project_id = $1
          AND fp.is_active = TRUE
        ORDER BY fp.start_date ASC, fp.cutoff_date ASC, fp.sort_order ASC, fp.created_at ASC
      `,
      [projectId],
    );

    return result.rows.map(mapFinancialPeriod);
  },

  async findFinancialPeriodById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${FINANCIAL_PERIOD_SELECT}
        FROM project_financial_periods fp
        LEFT JOIN LATERAL (
          SELECT p.id, p.status_code, p.snapshot_date, p.closed_at
          FROM project_control_periods p
          WHERE p.financial_period_id = fp.id
            AND p.is_active = TRUE
          ORDER BY p.created_at DESC
          LIMIT 1
        ) sp ON TRUE
        WHERE fp.id = $1
      `,
      [id],
    );

    return mapFinancialPeriod(result.rows[0]);
  },

  async findFinancialPeriodByProjectAndCode(projectId, periodCode, excludedId = null, executor = pool) {
    const params = excludedId ? [projectId, periodCode, excludedId] : [projectId, periodCode];
    const excludedClause = excludedId ? 'AND id <> $3' : '';
    const result = await executor.query(
      `
        SELECT id
        FROM project_financial_periods
        WHERE project_id = $1
          AND LOWER(period_code) = LOWER($2)
          AND is_active = TRUE
          ${excludedClause}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] || null;
  },

  async findFinancialPeriodByProjectAndCutoffDate(projectId, cutoffDate, excludedId = null, executor = pool) {
    const params = excludedId ? [projectId, cutoffDate, excludedId] : [projectId, cutoffDate];
    const excludedClause = excludedId ? 'AND id <> $3' : '';
    const result = await executor.query(
      `
        SELECT id
        FROM project_financial_periods
        WHERE project_id = $1
          AND cutoff_date = $2::date
          AND is_active = TRUE
          ${excludedClause}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] || null;
  },

  async findFinancialPeriodOverlap(projectId, startDate, endDate, excludedId = null, executor = pool) {
    const params = excludedId ? [projectId, startDate, endDate, excludedId] : [projectId, startDate, endDate];
    const excludedClause = excludedId ? 'AND id <> $4' : '';
    const result = await executor.query(
      `
        SELECT ${FINANCIAL_PERIOD_SELECT}
        FROM project_financial_periods fp
        LEFT JOIN LATERAL (
          SELECT p.id, p.status_code, p.snapshot_date, p.closed_at
          FROM project_control_periods p
          WHERE p.financial_period_id = fp.id
            AND p.is_active = TRUE
          ORDER BY p.created_at DESC
          LIMIT 1
        ) sp ON TRUE
        WHERE fp.project_id = $1
          AND fp.is_active = TRUE
          AND fp.start_date <= $3::date
          AND fp.end_date >= $2::date
          ${excludedClause}
        ORDER BY fp.start_date ASC
        LIMIT 1
      `,
      params,
    );

    return mapFinancialPeriod(result.rows[0]);
  },

  async getNextFinancialPeriodSortOrder(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM project_financial_periods
        WHERE project_id = $1
          AND is_active = TRUE
      `,
      [projectId],
    );

    return Number(result.rows[0]?.value || 0) + 1;
  },

  async createFinancialPeriod(financialPeriod, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO project_financial_periods (
          project_id,
          period_code,
          name,
          start_date,
          cutoff_date,
          end_date,
          sort_order,
          is_active,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        RETURNING id
      `,
      [
        financialPeriod.project_id,
        financialPeriod.period_code,
        financialPeriod.name,
        financialPeriod.start_date,
        financialPeriod.cutoff_date,
        financialPeriod.end_date,
        financialPeriod.sort_order || 0,
        financialPeriod.is_active !== false,
        financialPeriod.created_by || null,
        financialPeriod.updated_by || null,
      ],
    );

    return this.findFinancialPeriodById(result.rows[0].id, executor);
  },

  async updateFinancialPeriod(id, patch, executor = pool) {
    await executor.query(
      `
        UPDATE project_financial_periods
        SET period_code = $2,
            name = $3,
            start_date = $4,
            cutoff_date = $5,
            end_date = $6,
            sort_order = $7,
            updated_by = $8,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        patch.period_code,
        patch.name,
        patch.start_date,
        patch.cutoff_date,
        patch.end_date,
        patch.sort_order || 0,
        patch.updated_by || null,
      ],
    );

    return this.findFinancialPeriodById(id, executor);
  },

  async deactivateFinancialPeriod(id, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE project_financial_periods
        SET is_active = FALSE,
            updated_by = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, actorId || null],
    );

    return this.findFinancialPeriodById(id, executor);
  },

  async listByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${PERIOD_SELECT}
        FROM project_control_periods p
        LEFT JOIN project_financial_periods fp ON fp.id = p.financial_period_id
        WHERE p.project_id = $1
          AND p.is_active = TRUE
        ORDER BY p.snapshot_date DESC NULLS LAST, p.end_date DESC, p.created_at DESC
      `,
      [projectId],
    );

    return result.rows.map(mapPeriod);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${PERIOD_SELECT}
        FROM project_control_periods p
        LEFT JOIN project_financial_periods fp ON fp.id = p.financial_period_id
        WHERE p.id = $1
      `,
      [id],
    );

    return mapPeriod(result.rows[0]);
  },

  async findActiveByFinancialPeriodId(financialPeriodId, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${PERIOD_SELECT}
        FROM project_control_periods p
        LEFT JOIN project_financial_periods fp ON fp.id = p.financial_period_id
        WHERE p.financial_period_id = $1
          AND p.is_active = TRUE
        ORDER BY p.created_at DESC
        LIMIT 1
      `,
      [financialPeriodId],
    );

    return mapPeriod(result.rows[0]);
  },

  async createSnapshot(period, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO project_control_periods (
          project_id,
          financial_period_id,
          period_code,
          name,
          start_date,
          end_date,
          snapshot_date,
          status_code,
          is_active,
          opened_at,
          closed_at,
          reopened_at,
          close_notes,
          summary_activity_count,
          summary_budget_hours,
          summary_budget_cost,
          summary_baseline_budget_hours,
          summary_baseline_budget_cost,
          summary_ev_amount,
          summary_weighted_progress,
          summary_completed_activities,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
        )
        RETURNING id
      `,
      [
        period.project_id,
        period.financial_period_id || null,
        period.period_code,
        period.name,
        period.start_date,
        period.end_date,
        period.snapshot_date || null,
        period.status_code,
        period.is_active !== false,
        period.opened_at,
        period.closed_at || null,
        period.reopened_at || null,
        period.close_notes || '',
        period.summary_activity_count || 0,
        period.summary_budget_hours || 0,
        period.summary_budget_cost || 0,
        period.summary_baseline_budget_hours || 0,
        period.summary_baseline_budget_cost || 0,
        period.summary_ev_amount || 0,
        period.summary_weighted_progress || 0,
        period.summary_completed_activities || 0,
        period.created_by || null,
        period.updated_by || null,
      ],
    );

    return this.findById(result.rows[0].id, executor);
  },

  async updateSnapshotStatus(id, patch, executor = pool) {
    await executor.query(
      `
        UPDATE project_control_periods
        SET
          snapshot_date = $2,
          status_code = $3,
          closed_at = $4,
          reopened_at = $5,
          close_notes = $6,
          summary_activity_count = $7,
          summary_budget_hours = $8,
          summary_budget_cost = $9,
          summary_baseline_budget_hours = $10,
          summary_baseline_budget_cost = $11,
          summary_ev_amount = $12,
          summary_weighted_progress = $13,
          summary_completed_activities = $14,
          updated_by = $15,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        patch.snapshot_date || null,
        patch.status_code,
        patch.closed_at || null,
        patch.reopened_at || null,
        patch.close_notes || '',
        patch.summary_activity_count || 0,
        patch.summary_budget_hours || 0,
        patch.summary_budget_cost || 0,
        patch.summary_baseline_budget_hours || 0,
        patch.summary_baseline_budget_cost || 0,
        patch.summary_ev_amount || 0,
        patch.summary_weighted_progress || 0,
        patch.summary_completed_activities || 0,
        patch.updated_by || null,
      ],
    );

    return this.findById(id, executor);
  },

  async deactivateSnapshot(id, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE project_control_periods
        SET is_active = FALSE,
            updated_by = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, actorId || null],
    );

    return this.findById(id, executor);
  },

  async replaceSnapshots(periodId, projectId, snapshots = [], executor = pool) {
    await executor.query(
      `
        DELETE FROM project_control_period_activity_snapshots
        WHERE project_control_period_id = $1
      `,
      [periodId],
    );

    for (const snapshot of snapshots) {
      await executor.query(
        `
          INSERT INTO project_control_period_activity_snapshots (
            project_control_period_id,
            project_id,
            activity_id,
            wbs_id,
            wbs_code,
            wbs_name,
            activity_code,
            activity_name,
            start_date,
            end_date,
            duration_days,
            progress_percent,
            budget_hours,
            budget_cost,
            baseline_start_date,
            baseline_end_date,
            baseline_duration_days,
            baseline_budget_hours,
            baseline_budget_cost,
            ev_amount,
            status_code,
            sort_order
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
          )
        `,
        [
          periodId,
          projectId,
          snapshot.activity_id || null,
          snapshot.wbs_id || null,
          snapshot.wbs_code || '',
          snapshot.wbs_name || '',
          snapshot.activity_code || '',
          snapshot.activity_name || '',
          snapshot.start_date || null,
          snapshot.end_date || null,
          snapshot.duration_days || 0,
          snapshot.progress_percent || 0,
          snapshot.budget_hours || 0,
          snapshot.budget_cost || 0,
          snapshot.baseline_start_date || null,
          snapshot.baseline_end_date || null,
          snapshot.baseline_duration_days || 0,
          snapshot.baseline_budget_hours || 0,
          snapshot.baseline_budget_cost || 0,
          snapshot.ev_amount || 0,
          snapshot.status_code || 'not_started',
          snapshot.sort_order || 0,
        ],
      );
    }
  },

  async listSnapshots(periodId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          id,
          project_control_period_id,
          project_id,
          activity_id,
          wbs_id,
          wbs_code,
          wbs_name,
          activity_code,
          activity_name,
          start_date,
          end_date,
          duration_days,
          progress_percent,
          budget_hours,
          budget_cost,
          baseline_start_date,
          baseline_end_date,
          baseline_duration_days,
          baseline_budget_hours,
          baseline_budget_cost,
          ev_amount,
          status_code,
          sort_order,
          captured_at
        FROM project_control_period_activity_snapshots
        WHERE project_control_period_id = $1
        ORDER BY sort_order ASC, LOWER(activity_code) ASC, LOWER(activity_name) ASC, id ASC
      `,
      [periodId],
    );

    return result.rows.map(mapSnapshot);
  },
};
