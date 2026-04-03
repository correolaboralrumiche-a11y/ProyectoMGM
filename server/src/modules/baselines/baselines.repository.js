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

function mapBaseline(row) {
  if (!row) return null;
  return {
    ...row,
    source_project_created_at: row.source_project_created_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    wbs_count: Number(row.wbs_count || 0),
    activities_count: Number(row.activities_count || 0),
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
  };
}

function mapBaselineActivity(row) {
  if (!row) return null;
  return {
    ...row,
    start_date: normalizeDateValue(row.start_date),
    end_date: normalizeDateValue(row.end_date),
    duration: Number(row.duration || 0),
    progress: Number(row.progress || 0),
    hours: Number(row.hours || 0),
    cost: Number(row.cost || 0),
    sort_order: Number(row.sort_order || 0),
  };
}

export const baselinesRepository = {
  async findProjectById(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, code, name, description, status, created_at, updated_at
        FROM projects
        WHERE id = $1
      `,
      [projectId],
    );
    return result.rows[0] || null;
  },

  async findBaselineById(baselineId, executor = pool) {
    const result = await executor.query(
      `
        SELECT pb.*,
          (
            SELECT COUNT(*)
            FROM baseline_wbs bw
            WHERE bw.baseline_id = pb.id
          ) AS wbs_count,
          (
            SELECT COUNT(*)
            FROM baseline_activities ba
            WHERE ba.baseline_id = pb.id
          ) AS activities_count
        FROM project_baselines pb
        WHERE pb.id = $1
      `,
      [baselineId],
    );
    return mapBaseline(result.rows[0]);
  },

  async findLatestByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT pb.*,
          (
            SELECT COUNT(*)
            FROM baseline_wbs bw
            WHERE bw.baseline_id = pb.id
          ) AS wbs_count,
          (
            SELECT COUNT(*)
            FROM baseline_activities ba
            WHERE ba.baseline_id = pb.id
          ) AS activities_count
        FROM project_baselines pb
        WHERE pb.project_id = $1
        ORDER BY pb.created_at DESC, LOWER(pb.name) ASC
        LIMIT 1
      `,
      [projectId],
    );
    return mapBaseline(result.rows[0]);
  },

  async findBaselineByProjectAndName(projectId, name, executor = pool) {
    const result = await executor.query(
      `
        SELECT *
        FROM project_baselines
        WHERE project_id = $1
          AND name = $2
      `,
      [projectId, name],
    );
    return result.rows[0] || null;
  },

  async listByProject(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT pb.*,
          (
            SELECT COUNT(*)
            FROM baseline_wbs bw
            WHERE bw.baseline_id = pb.id
          ) AS wbs_count,
          (
            SELECT COUNT(*)
            FROM baseline_activities ba
            WHERE ba.baseline_id = pb.id
          ) AS activities_count
        FROM project_baselines pb
        WHERE pb.project_id = $1
        ORDER BY pb.created_at DESC, LOWER(pb.name) ASC
      `,
      [projectId],
    );
    return result.rows.map(mapBaseline);
  },

  async listProjectWbs(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, parent_id, name, code, sort_order, created_at, updated_at
        FROM wbs_nodes
        WHERE project_id = $1
        ORDER BY code ASC, sort_order ASC, name ASC
      `,
      [projectId],
    );
    return result.rows;
  },

  async listProjectActivities(projectId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
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
          COALESCE(s.name, a.status) AS status,
          a.sort_order,
          a.created_at,
          a.updated_at,
          w.code AS wbs_code
        FROM activities a
        LEFT JOIN activity_statuses s ON s.code = a.status
        INNER JOIN wbs_nodes w ON w.id = a.wbs_id
        WHERE a.project_id = $1
        ORDER BY w.code ASC, a.sort_order ASC, LOWER(a.activity_id) ASC, LOWER(a.name) ASC, a.id ASC
      `,
      [projectId],
    );
    return result.rows.map(mapBaselineActivity);
  },

  async createSnapshot(payload, executor = pool) {
    const baselineInsert = await executor.query(
      `
        INSERT INTO project_baselines (
          project_id,
          name,
          description,
          project_name_snapshot,
          project_description_snapshot,
          source_project_created_at,
          created_at,
          baseline_type,
          created_by,
          updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `,
      [
        payload.baseline.project_id,
        payload.baseline.name,
        payload.baseline.description,
        payload.baseline.project_name_snapshot,
        payload.baseline.project_description_snapshot,
        payload.baseline.source_project_created_at,
        payload.baseline.created_at,
        payload.baseline.baseline_type,
        payload.baseline.created_by || null,
        payload.baseline.updated_by || null,
      ],
    );

    const baselineId = baselineInsert.rows[0].id;
    const baselineWbsIdBySourceId = new Map();

    for (const row of payload.baselineWbs) {
      const inserted = await executor.query(
        `
          INSERT INTO baseline_wbs (
            baseline_id,
            source_wbs_id,
            parent_id,
            name,
            code,
            sort_order
          ) VALUES ($1,$2,NULL,$3,$4,$5)
          RETURNING id
        `,
        [baselineId, row.source_wbs_id, row.name, row.code, row.sort_order],
      );
      baselineWbsIdBySourceId.set(row.source_wbs_id, inserted.rows[0].id);
    }

    for (const row of payload.baselineWbs) {
      const baselineWbsId = baselineWbsIdBySourceId.get(row.source_wbs_id);
      const baselineParentId = row.parent_source_wbs_id
        ? baselineWbsIdBySourceId.get(row.parent_source_wbs_id) || null
        : null;

      await executor.query(
        `
          UPDATE baseline_wbs
          SET parent_id = $2
          WHERE id = $1
        `,
        [baselineWbsId, baselineParentId],
      );
    }

    for (const row of payload.baselineActivities) {
      const baselineWbsId = baselineWbsIdBySourceId.get(row.source_wbs_id);
      await executor.query(
        `
          INSERT INTO baseline_activities (
            baseline_id,
            baseline_wbs_id,
            source_activity_id,
            project_id,
            activity_id,
            name,
            start_date,
            end_date,
            duration,
            progress,
            hours,
            cost,
            status,
            sort_order,
            source_created_at,
            source_updated_at,
            created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `,
        [
          baselineId,
          baselineWbsId,
          row.source_activity_id,
          row.project_id,
          row.activity_id,
          row.name,
          row.start_date,
          row.end_date,
          row.duration,
          row.progress,
          row.hours,
          row.cost,
          row.status,
          row.sort_order,
          row.source_created_at,
          row.source_updated_at,
          row.created_at,
        ],
      );
    }

    return this.findBaselineById(baselineId, executor);
  },

  async getBaselineHeader(baselineId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, project_id, name, description, baseline_type, created_at, created_by, updated_by
        FROM project_baselines
        WHERE id = $1
      `,
      [baselineId],
    );
    return result.rows[0] || null;
  },

  async getBaselineWbs(baselineId, executor = pool) {
    const result = await executor.query(
      `
        SELECT id, baseline_id, source_wbs_id, parent_id, name, code, sort_order
        FROM baseline_wbs
        WHERE baseline_id = $1
        ORDER BY code ASC, sort_order ASC, name ASC
      `,
      [baselineId],
    );
    return result.rows.map((row) => ({ ...row, sort_order: Number(row.sort_order || 0) }));
  },

  async getBaselineActivities(baselineId, executor = pool) {
    const result = await executor.query(
      `
        SELECT
          ba.id,
          ba.baseline_id,
          ba.baseline_wbs_id,
          ba.source_activity_id AS original_activity_id,
          ba.project_id,
          ba.activity_id,
          ba.name,
          ba.start_date,
          ba.end_date,
          ba.duration,
          ba.progress,
          ba.hours,
          ba.cost,
          ba.status,
          ba.sort_order,
          ba.source_created_at,
          ba.source_updated_at,
          bw.code AS wbs_code,
          bw.name AS wbs_name
        FROM baseline_activities ba
        INNER JOIN baseline_wbs bw ON bw.id = ba.baseline_wbs_id
        WHERE ba.baseline_id = $1
        ORDER BY bw.code ASC, ba.sort_order ASC, LOWER(ba.activity_id) ASC, LOWER(ba.name) ASC, ba.id ASC
      `,
      [baselineId],
    );
    return result.rows.map(mapBaselineActivity);
  },

  async removeBaseline(baselineId, executor = pool) {
    await executor.query(
      `
        DELETE FROM project_baselines
        WHERE id = $1
      `,
      [baselineId],
    );
  },
};
