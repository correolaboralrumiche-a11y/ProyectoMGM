import db from '../../config/db.js';

export const baselinesRepository = {
  findProjectById(projectId) {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) || null;
  },

  findBaselineById(baselineId) {
    return (
      db
        .prepare(`
          SELECT
            pb.*,
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
          WHERE pb.id = ?
        `)
        .get(baselineId) || null
    );
  },

  findBaselineByProjectAndName(projectId, name) {
    return (
      db
        .prepare('SELECT * FROM project_baselines WHERE project_id = ? AND name = ?')
        .get(projectId, name) || null
    );
  },

  listByProject(projectId) {
    return db
      .prepare(`
        SELECT
          pb.*,
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
        WHERE pb.project_id = ?
        ORDER BY datetime(pb.created_at) DESC, pb.name COLLATE NOCASE ASC
      `)
      .all(projectId);
  },

  listProjectWbs(projectId) {
    return db
      .prepare(`
        SELECT *
        FROM wbs
        WHERE project_id = ?
        ORDER BY code ASC, sort_order ASC, name COLLATE NOCASE ASC
      `)
      .all(projectId);
  },

  listProjectActivities(projectId) {
    return db
      .prepare(`
        SELECT *
        FROM activities
        WHERE project_id = ?
        ORDER BY sort_order ASC, activity_id COLLATE NOCASE ASC, name COLLATE NOCASE ASC
      `)
      .all(projectId);
  },

  createSnapshot(payload) {
    const tx = db.transaction((snapshot) => {
      db.prepare(`
        INSERT INTO project_baselines (
          id,
          project_id,
          name,
          description,
          project_name_snapshot,
          project_description_snapshot,
          source_project_created_at,
          created_at,
          baseline_type
        ) VALUES (
          @id,
          @project_id,
          @name,
          @description,
          @project_name_snapshot,
          @project_description_snapshot,
          @source_project_created_at,
          @created_at,
          @baseline_type
        )
      `).run(snapshot.baseline);

      const insertBaselineWbs = db.prepare(`
        INSERT INTO baseline_wbs (
          id,
          baseline_id,
          source_wbs_id,
          parent_id,
          name,
          code,
          sort_order
        ) VALUES (
          @id,
          @baseline_id,
          @source_wbs_id,
          @parent_id,
          @name,
          @code,
          @sort_order
        )
      `);

      for (const row of snapshot.baselineWbs) {
        insertBaselineWbs.run(row);
      }

      const insertBaselineActivity = db.prepare(`
        INSERT INTO baseline_activities (
          id,
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
        ) VALUES (
          @id,
          @baseline_id,
          @baseline_wbs_id,
          @source_activity_id,
          @project_id,
          @activity_id,
          @name,
          @start_date,
          @end_date,
          @duration,
          @progress,
          @hours,
          @cost,
          @status,
          @sort_order,
          @source_created_at,
          @source_updated_at,
          @created_at
        )
      `);

      for (const row of snapshot.baselineActivities) {
        insertBaselineActivity.run(row);
      }
    });

    tx(payload);
    return this.findBaselineById(payload.baseline.id);
  },

  getBaselineHeader(baselineId) {
    return db
      .prepare('SELECT * FROM project_baselines WHERE id = ?')
      .get(baselineId) || null;
  },

  getBaselineWbs(baselineId) {
    return db
      .prepare(`
        SELECT *
        FROM baseline_wbs
        WHERE baseline_id = ?
        ORDER BY code ASC, sort_order ASC, name COLLATE NOCASE ASC
      `)
      .all(baselineId);
  },

  getBaselineActivities(baselineId) {
    return db
      .prepare(`
        SELECT
          ba.*,
          bw.name AS wbs_name,
          bw.code AS wbs_code
        FROM baseline_activities ba
        INNER JOIN baseline_wbs bw ON bw.id = ba.baseline_wbs_id
        WHERE ba.baseline_id = ?
        ORDER BY bw.code ASC, ba.sort_order ASC, ba.activity_id COLLATE NOCASE ASC
      `)
      .all(baselineId);
  },

  removeBaseline(baselineId) {
    db.prepare('DELETE FROM project_baselines WHERE id = ?').run(baselineId);
  },
};
