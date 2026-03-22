import db from '../../config/db.js';

export const activitiesRepository = {
  findWbsById(wbsId) {
    return db.prepare('SELECT * FROM wbs WHERE id = ?').get(wbsId) || null;
  },

  listByProject(projectId) {
    return db
      .prepare(`
        SELECT
          a.*,
          w.project_id,
          w.name AS wbs_name,
          w.code AS wbs_code
        FROM activities a
        INNER JOIN wbs w ON w.id = a.wbs_id
        WHERE a.project_id = ?
        ORDER BY w.code ASC, a.activity_id COLLATE NOCASE ASC, a.name ASC
      `)
      .all(projectId);
  },

  findById(id) {
    return db.prepare('SELECT * FROM activities WHERE id = ?').get(id) || null;
  },

  findByProjectAndActivityId(projectId, activityId, excludedId = null) {
    if (excludedId) {
      return (
        db
          .prepare(`
            SELECT *
            FROM activities
            WHERE project_id = ?
              AND activity_id = ?
              AND id <> ?
          `)
          .get(projectId, activityId, excludedId) || null
      );
    }

    return (
      db
        .prepare(`
          SELECT *
          FROM activities
          WHERE project_id = ?
            AND activity_id = ?
        `)
        .get(projectId, activityId) || null
    );
  },

  getMaxSortOrder(wbsId) {
    const row = db
      .prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS value
        FROM activities
        WHERE wbs_id = ?
      `)
      .get(wbsId);

    return Number(row?.value || 0);
  },

  listActivityIdsByProject(projectId) {
    return db
      .prepare('SELECT activity_id FROM activities WHERE project_id = ?')
      .all(projectId);
  },

  create(activity) {
    db.prepare(`
      INSERT INTO activities (
        id,
        project_id,
        wbs_id,
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
        created_at,
        updated_at
      ) VALUES (
        @id,
        @project_id,
        @wbs_id,
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
        @created_at,
        @updated_at
      )
    `).run(activity);

    return this.findById(activity.id);
  },

  update(id, activity) {
    db.prepare(`
      UPDATE activities
      SET activity_id = ?,
          name = ?,
          start_date = ?,
          end_date = ?,
          duration = ?,
          progress = ?,
          hours = ?,
          cost = ?,
          status = ?,
          updated_at = ?,
          wbs_id = ?,
          project_id = ?
      WHERE id = ?
    `).run(
      activity.activity_id,
      activity.name,
      activity.start_date,
      activity.end_date,
      activity.duration,
      activity.progress,
      activity.hours,
      activity.cost,
      activity.status,
      activity.updated_at,
      activity.wbs_id,
      activity.project_id,
      id
    );

    return this.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  },
};