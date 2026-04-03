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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapActivity(row) {
  if (!row) return null;

  const progress = toNumber(row.progress ?? row.progress_percent ?? 0);
  const budgetHours = toNumber(row.hours ?? row.budget_hours ?? 0);
  const budgetCost = toNumber(row.cost ?? row.budget_cost ?? 0);
  const actualHours = toNumber(row.actual_hours ?? 0);
  const actualCost = toNumber(row.actual_cost ?? 0);
  const baselineHours = toNumber(row.baseline_hours ?? row.baseline_budget_hours ?? 0);
  const baselineCost = toNumber(row.baseline_cost ?? row.baseline_budget_cost ?? 0);
  const baselineDuration = toNumber(row.baseline_duration ?? row.baseline_duration_days ?? 0);
  const evAmount = baselineCost > 0 ? Number(((progress * baselineCost) / 100).toFixed(2)) : 0;

  return {
    id: row.id,
    project_id: row.resolved_project_id || row.project_id,
    wbs_id: row.wbs_id,
    activity_id: row.activity_id,
    name: row.name,
    start_date: normalizeDateValue(row.start_date),
    end_date: normalizeDateValue(row.end_date || row.finish_date),
    duration: toNumber(row.duration ?? row.duration_days ?? 0),
    progress,
    hours: budgetHours,
    cost: budgetCost,
    status_code: row.status_code || row.status || 'not_started',
    status_name: row.status_name || null,
    status: row.status_name || row.status || 'Not Started',
    activity_type_code: row.activity_type_code || 'task',
    activity_type_name: row.activity_type_name || null,
    priority_code: row.priority_code || 'medium',
    priority_name: row.priority_name || null,
    discipline_code: row.discipline_code || 'general',
    discipline_name: row.discipline_name || null,
    sort_order: Number(row.sort_order || 0),
    notes: row.notes || '',
    wbs_name: row.wbs_name || null,
    wbs_code: row.wbs_code || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    progress_update_count: Number(row.progress_update_count || 0),
    latest_progress_date: normalizeDateValue(row.latest_progress_date),
    actual_entry_count: Number(row.actual_entry_count || 0),
    actual_hours: actualHours,
    actual_cost: actualCost,
    latest_actual_date: normalizeDateValue(row.latest_actual_date),
    remaining_hours: Number(Math.max(budgetHours - actualHours, 0).toFixed(2)),
    remaining_cost: Number(Math.max(budgetCost - actualCost, 0).toFixed(2)),
    baseline_id: row.baseline_id || null,
    baseline_name: row.baseline_name || null,
    baseline: row.baseline_id || row.baseline_name || baselineCost > 0 || baselineHours > 0
      ? {
          id: row.baseline_id || null,
          name: row.baseline_name || null,
          start_date: normalizeDateValue(row.baseline_start_date),
          end_date: normalizeDateValue(row.baseline_end_date),
          duration: baselineDuration,
          progress: toNumber(row.baseline_progress ?? 0),
          hours: baselineHours,
          cost: baselineCost,
          status_code: row.baseline_status_code || null,
          status: row.baseline_status_code || null,
        }
      : null,
    ev_amount: evAmount,
    baseline_budget_hours: baselineHours,
    baseline_budget_cost: baselineCost,
  };
}

const ACTIVITY_SELECT_COLUMNS = `
  a.id,
  a.project_id,
  a.wbs_id,
  a.activity_id,
  a.name,
  a.start_date,
  a.finish_date AS end_date,
  a.duration_days AS duration,
  a.progress_percent AS progress,
  a.budget_hours AS hours,
  a.budget_cost AS cost,
  a.status AS status_code,
  s.name AS status_name,
  a.activity_type_code,
  t.name AS activity_type_name,
  a.priority_code,
  p.name AS priority_name,
  a.discipline_code,
  d.name AS discipline_name,
  a.sort_order,
  a.notes,
  a.created_by,
  a.updated_by,
  a.created_at,
  a.updated_at,
  COALESCE(pu.progress_update_count, 0) AS progress_update_count,
  pu.latest_progress_date,
  COALESCE(ac.actual_entry_count, 0) AS actual_entry_count,
  COALESCE(ac.actual_hours, 0) AS actual_hours,
  COALESCE(ac.actual_cost, 0) AS actual_cost,
  ac.latest_actual_date,
  lb.baseline_id,
  lb.baseline_name,
  lb.baseline_start_date,
  lb.baseline_end_date,
  lb.baseline_duration,
  lb.baseline_progress,
  lb.baseline_hours,
  lb.baseline_cost,
  lb.baseline_status_code
`;

const ACTIVITY_BASE_JOINS = `
  FROM activities a
  LEFT JOIN wbs_nodes w ON w.id = a.wbs_id
  LEFT JOIN activity_statuses s ON s.code = a.status
  LEFT JOIN activity_types t ON t.code = a.activity_type_code
  LEFT JOIN activity_priorities p ON p.code = a.priority_code
  LEFT JOIN disciplines d ON d.code = a.discipline_code
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS progress_update_count,
      MAX(update_date) AS latest_progress_date
    FROM activity_progress_updates apu
    WHERE apu.activity_id = a.id
  ) pu ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS actual_entry_count,
      COALESCE(SUM(actual_hours), 0) AS actual_hours,
      COALESCE(SUM(actual_cost), 0) AS actual_cost,
      MAX(actual_date) AS latest_actual_date
    FROM activity_actuals aa
    WHERE aa.activity_id = a.id
  ) ac ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      pb.id AS baseline_id,
      pb.name AS baseline_name,
      ba.start_date AS baseline_start_date,
      ba.end_date AS baseline_end_date,
      ba.duration AS baseline_duration,
      ba.progress AS baseline_progress,
      ba.hours AS baseline_hours,
      ba.cost AS baseline_cost,
      ba.status AS baseline_status_code
    FROM project_baselines pb
    INNER JOIN baseline_activities ba ON ba.baseline_id = pb.id
    WHERE pb.project_id = COALESCE(w.project_id, a.project_id)
      AND (ba.source_activity_id = a.id OR LOWER(ba.activity_id) = LOWER(a.activity_id))
    ORDER BY pb.created_at DESC, LOWER(pb.name) ASC
    LIMIT 1
  ) lb ON TRUE
`;

export const activitiesRepository = {
  async findWbsById(wbsId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_at, updated_at
        FROM wbs_nodes
        WHERE id = $1
      `,
      [wbsId],
    );

    return result.rows[0] || null;
  },

  async listByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT DISTINCT ON (a.id)
          ${ACTIVITY_SELECT_COLUMNS},
          w.name AS wbs_name,
          w.code AS wbs_code,
          COALESCE(w.project_id, a.project_id) AS resolved_project_id
        ${ACTIVITY_BASE_JOINS}
        WHERE COALESCE(w.project_id, a.project_id) = $1
        ORDER BY a.id, w.code ASC NULLS LAST, a.sort_order ASC, LOWER(a.activity_id) ASC, LOWER(a.name) ASC
      `,
      [projectId],
    );

    return result.rows.map(mapActivity);
  },

  async findById(id, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${ACTIVITY_SELECT_COLUMNS},
          w.name AS wbs_name,
          w.code AS wbs_code,
          COALESCE(w.project_id, a.project_id) AS resolved_project_id
        ${ACTIVITY_BASE_JOINS}
        WHERE a.id = $1
      `,
      [id],
    );

    return mapActivity(result.rows[0]);
  },

  async findByProjectAndActivityId(projectId, activityId, excludedId = null, executor = pool) {
    const params = excludedId ? [projectId, activityId, excludedId] : [projectId, activityId];
    const clause = excludedId ? 'AND a.id <> $3' : '';
    const result = await executor.query(
      `
        SELECT ${ACTIVITY_SELECT_COLUMNS},
          w.name AS wbs_name,
          w.code AS wbs_code,
          COALESCE(w.project_id, a.project_id) AS resolved_project_id
        ${ACTIVITY_BASE_JOINS}
        WHERE COALESCE(w.project_id, a.project_id) = $1
          AND a.activity_id = $2
          ${clause}
      `,
      params,
    );

    return mapActivity(result.rows[0]);
  },

  async getMaxSortOrder(wbsId, executor = pool) {
    const result = await executor.query(
      `
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM activities
        WHERE wbs_id = $1
      `,
      [wbsId],
    );

    return Number(result.rows[0]?.value || 0);
  },

  async listActivityIdsByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT a.activity_id
        FROM activities a
        LEFT JOIN wbs_nodes w ON w.id = a.wbs_id
        WHERE COALESCE(w.project_id, a.project_id) = $1
      `,
      [projectId],
    );

    return result.rows;
  },

  async listSiblings(wbsId, executor = pool) {
    const result = await executor.query(
      `
        SELECT ${ACTIVITY_SELECT_COLUMNS},
          w.name AS wbs_name,
          w.code AS wbs_code,
          COALESCE(w.project_id, a.project_id) AS resolved_project_id
        ${ACTIVITY_BASE_JOINS}
        WHERE a.wbs_id = $1
        ORDER BY a.sort_order ASC, LOWER(a.activity_id) ASC, LOWER(a.name) ASC, a.id ASC
      `,
      [wbsId],
    );

    return result.rows.map(mapActivity);
  },

  async create(activity, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO activities (
          project_id,
          wbs_id,
          activity_id,
          name,
          start_date,
          finish_date,
          duration_days,
          progress_percent,
          budget_hours,
          budget_cost,
          status,
          activity_type_code,
          priority_code,
          discipline_code,
          sort_order,
          notes,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
        )
        RETURNING id
      `,
      [
        activity.project_id,
        activity.wbs_id,
        activity.activity_id,
        activity.name,
        activity.start_date,
        activity.end_date,
        activity.duration,
        activity.progress,
        activity.hours,
        activity.cost,
        activity.status_code,
        activity.activity_type_code,
        activity.priority_code,
        activity.discipline_code,
        activity.sort_order,
        activity.notes || '',
        activity.created_by || null,
        activity.updated_by || null,
      ],
    );

    return this.findById(result.rows[0].id, executor);
  },

  async update(id, activity, executor = pool) {
    const result = await executor.query(
      `
        UPDATE activities
        SET
          project_id = $2,
          wbs_id = $3,
          activity_id = $4,
          name = $5,
          start_date = $6,
          finish_date = $7,
          duration_days = $8,
          progress_percent = $9,
          budget_hours = $10,
          budget_cost = $11,
          status = $12,
          activity_type_code = $13,
          priority_code = $14,
          discipline_code = $15,
          sort_order = $16,
          notes = $17,
          updated_by = $18,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [
        id,
        activity.project_id,
        activity.wbs_id,
        activity.activity_id,
        activity.name,
        activity.start_date,
        activity.end_date,
        activity.duration,
        activity.progress,
        activity.hours,
        activity.cost,
        activity.status_code,
        activity.activity_type_code,
        activity.priority_code,
        activity.discipline_code,
        activity.sort_order,
        activity.notes || '',
        activity.updated_by || null,
      ],
    );

    return this.findById(result.rows[0]?.id || id, executor);
  },

  async updateSortOrder(id, sortOrder, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE activities
        SET sort_order = $2,
            updated_by = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [id, sortOrder, actorId || null],
    );
  },

  async listProgressUpdates(activityId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          apu.id,
          apu.activity_id,
          apu.project_id,
          apu.update_date,
          apu.progress_percent,
          apu.status_code,
          s.name AS status_name,
          apu.notes,
          apu.source_type,
          apu.created_by,
          apu.created_at
        FROM activity_progress_updates apu
        LEFT JOIN activity_statuses s ON s.code = apu.status_code
        WHERE apu.activity_id = $1
        ORDER BY apu.update_date DESC, apu.created_at DESC
      `,
      [activityId],
    );

    return result.rows.map((row) => ({
      ...row,
      update_date: normalizeDateValue(row.update_date),
      progress_percent: toNumber(row.progress_percent, 0),
    }));
  },

  async insertProgressUpdate(entry, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO activity_progress_updates (
          activity_id,
          project_id,
          update_date,
          progress_percent,
          status_code,
          notes,
          source_type,
          created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id, activity_id, project_id, update_date, progress_percent, status_code, notes, source_type, created_by, created_at
      `,
      [
        entry.activity_id,
        entry.project_id,
        entry.update_date,
        entry.progress_percent,
        entry.status_code,
        entry.notes || '',
        entry.source_type || 'manual',
        entry.created_by || null,
      ],
    );

    const row = result.rows[0];
    return {
      ...row,
      update_date: normalizeDateValue(row.update_date),
      progress_percent: toNumber(row.progress_percent, 0),
    };
  },

  async updateProgressSummary(activityId, patch, executor = pool) {
    await executor.query(
      `
        UPDATE activities
        SET progress_percent = $2,
            status = $3,
            updated_by = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [activityId, patch.progress, patch.status_code, patch.updated_by || null],
    );
  },

  async listActualEntries(activityId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          id,
          activity_id,
          project_id,
          actual_date,
          actual_hours,
          actual_cost,
          notes,
          source_type,
          created_by,
          created_at
        FROM activity_actuals
        WHERE activity_id = $1
        ORDER BY actual_date DESC, created_at DESC
      `,
      [activityId],
    );

    return result.rows.map((row) => ({
      ...row,
      actual_date: normalizeDateValue(row.actual_date),
      actual_hours: toNumber(row.actual_hours, 0),
      actual_cost: toNumber(row.actual_cost, 0),
    }));
  },

  async insertActualEntry(entry, executor = pool) {
    const result = await executor.query(
      `
        INSERT INTO activity_actuals (
          activity_id,
          project_id,
          actual_date,
          actual_hours,
          actual_cost,
          notes,
          source_type,
          created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id, activity_id, project_id, actual_date, actual_hours, actual_cost, notes, source_type, created_by, created_at
      `,
      [
        entry.activity_id,
        entry.project_id,
        entry.actual_date,
        entry.actual_hours,
        entry.actual_cost,
        entry.notes || '',
        entry.source_type || 'manual',
        entry.created_by || null,
      ],
    );

    const row = result.rows[0];
    return {
      ...row,
      actual_date: normalizeDateValue(row.actual_date),
      actual_hours: toNumber(row.actual_hours, 0),
      actual_cost: toNumber(row.actual_cost, 0),
    };
  },

  async touchActivity(activityId, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE activities
        SET updated_by = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [activityId, actorId || null],
    );
  },

  async remove(id, executor = pool) {
    await executor.query(
      `
        DELETE FROM activities
        WHERE id = $1
      `,
      [id],
    );
  },
};
