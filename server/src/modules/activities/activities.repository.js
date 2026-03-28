import { pool } from '../../config/db.js';

function mapActivity(row) {
  if (!row) return null;

  return {
    id: row.id,
    project_id: row.resolved_project_id || row.project_id,
    wbs_id: row.wbs_id,
    activity_id: row.activity_id,
    name: row.name,
    start_date: row.start_date || null,
    end_date: row.end_date || row.finish_date || null,
    duration: Number(row.duration ?? row.duration_days ?? 0),
    progress: Number(row.progress ?? row.progress_percent ?? 0),
    hours: Number(row.hours ?? row.budget_hours ?? 0),
    cost: Number(row.cost ?? row.budget_cost ?? 0),
    status_code: row.status_code || row.status || 'not_started',
    status_name: row.status_name || null,
    status: row.status_name || row.status || 'Not Started',
    activity_type_code: row.activity_type_code || 'task',
    activity_type_name: row.activity_type_name || null,
    priority_code: row.priority_code || 'medium',
    priority_name: row.priority_name || null,
    sort_order: Number(row.sort_order || 0),
    notes: row.notes || '',
    wbs_name: row.wbs_name || null,
    wbs_code: row.wbs_code || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
  a.sort_order,
  a.notes,
  a.created_by,
  a.updated_by,
  a.created_at,
  a.updated_at
`;

const ACTIVITY_BASE_JOINS = `
  FROM activities a
  LEFT JOIN wbs_nodes w ON w.id = a.wbs_id
  LEFT JOIN activity_statuses s ON s.code = a.status
  LEFT JOIN activity_types t ON t.code = a.activity_type_code
  LEFT JOIN activity_priorities p ON p.code = a.priority_code
`;

export const activitiesRepository = {
  async findWbsById(wbsId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_at, updated_at
        FROM wbs_nodes
        WHERE id = $1
      `,
      [wbsId]
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
      [projectId]
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
      [id]
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
      params
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
      [wbsId]
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
      [projectId]
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
      [wbsId]
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
          sort_order,
          notes,
          created_by,
          updated_by
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17
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
        activity.sort_order,
        activity.notes || '',
        activity.created_by || null,
        activity.updated_by || null,
      ]
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
          sort_order = $15,
          notes = $16,
          updated_by = $17,
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
        activity.sort_order,
        activity.notes || '',
        activity.updated_by || null,
      ]
    );

    return this.findById(result.rows[0]?.id || id, executor);
  },

  async updateSortOrder(id, sortOrder, actorId, executor = pool) {
    await executor.query(
      `
        UPDATE activities
        SET
          sort_order = $2,
          updated_by = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [id, sortOrder, actorId || null]
    );
  },

  async remove(id, executor = pool) {
    await executor.query(
      `
        DELETE FROM activities
        WHERE id = $1
      `,
      [id]
    );
  },
};
