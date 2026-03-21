import { Router } from 'express';
import db from '../../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { ok, fail } from '../../utils/http.js';
import { computeDuration } from '../../utils/date.js';

const router = Router();

function buildDefaultActivityId(wbsId) {
  const rows = db.prepare(`
    SELECT activity_id
    FROM activities
    WHERE wbs_id = ?
  `).all(wbsId);

  const maxNumericSuffix = rows.reduce((maxValue, row) => {
    const value = String(row.activity_id || '').trim();
    const match = value.match(/(\d+)$/);
    if (!match) return maxValue;

    const numericValue = Number(match[1]);
    return Number.isFinite(numericValue) ? Math.max(maxValue, numericValue) : maxValue;
  }, 0);

  return `ACT-${String(maxNumericSuffix + 1).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) return fail(res, 'projectId is required');

    const rows = db.prepare(`
      SELECT
        a.*,
        w.project_id,
        w.name AS wbs_name,
        w.code AS wbs_code
      FROM activities a
      INNER JOIN wbs w ON w.id = a.wbs_id
      WHERE w.project_id = ?
      ORDER BY w.code ASC, a.activity_id COLLATE NOCASE ASC, a.name ASC
    `).all(projectId);

    return ok(res, rows);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.post('/', (req, res) => {
  try {
    const wbsId = String(req.body?.wbs_id || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!wbsId) return fail(res, 'wbs_id is required');
    if (!name) return fail(res, 'Activity name is required');

    const wbs = db.prepare('SELECT * FROM wbs WHERE id = ?').get(wbsId);
    if (!wbs) return fail(res, 'WBS not found', 404);

    const sortRow = db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS value
      FROM activities
      WHERE wbs_id = ?
    `).get(wbsId);

    const startDate = req.body?.start_date || null;
    const endDate = req.body?.end_date || null;
    const duration = (startDate && endDate)
      ? computeDuration(startDate, endDate)
      : Number(req.body?.duration || 0);

    const activity = {
      id: uuidv4(),
      wbs_id: wbsId,
      activity_id: String(req.body?.activity_id || '').trim() || buildDefaultActivityId(wbsId),
      name,
      start_date: startDate,
      end_date: endDate,
      duration,
      progress: Number(req.body?.progress ?? 0),
      hours: Number(req.body?.hours ?? 0),
      cost: Number(req.body?.cost ?? 0),
      status: String(req.body?.status || 'Not Started'),
      sort_order: (sortRow?.value || 0) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO activities (
        id, wbs_id, activity_id, name, start_date, end_date, duration, progress,
        hours, cost, status, sort_order, created_at, updated_at
      ) VALUES (
        @id, @wbs_id, @activity_id, @name, @start_date, @end_date, @duration, @progress,
        @hours, @cost, @status, @sort_order, @created_at, @updated_at
      )
    `).run(activity);

    const created = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity.id);
    return ok(res, created, 201);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Activity not found', 404);

    const payload = {
      activity_id: String(req.body?.activity_id ?? existing.activity_id).trim(),
      name: String(req.body?.name ?? existing.name).trim(),
      start_date: Object.prototype.hasOwnProperty.call(req.body || {}, 'start_date') ? (req.body.start_date || null) : existing.start_date,
      end_date: Object.prototype.hasOwnProperty.call(req.body || {}, 'end_date') ? (req.body.end_date || null) : existing.end_date,
      progress: Number(req.body?.progress ?? existing.progress),
      hours: Number(req.body?.hours ?? existing.hours),
      cost: Number(req.body?.cost ?? existing.cost),
      status: String(req.body?.status ?? existing.status),
    };

    if (!payload.activity_id) return fail(res, 'Activity ID is required');
    if (!payload.name) return fail(res, 'Activity name is required');
    if (payload.progress < 0 || payload.progress > 100) return fail(res, 'Progress must be between 0 and 100');
    if (payload.hours < 0 || payload.cost < 0) return fail(res, 'Hours and cost must be >= 0');

    const duration = (payload.start_date && payload.end_date)
      ? computeDuration(payload.start_date, payload.end_date)
      : 0;

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
          updated_at = ?
      WHERE id = ?
    `).run(
      payload.activity_id,
      payload.name,
      payload.start_date,
      payload.end_date,
      duration,
      payload.progress,
      payload.hours,
      payload.cost,
      payload.status,
      new Date().toISOString(),
      existing.id
    );

    const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(existing.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Activity not found', 404);

    db.prepare('DELETE FROM activities WHERE id = ?').run(existing.id);
    return ok(res, { id: existing.id });
  } catch (error) {
    return fail(res, error, 500);
  }
});

export default router;
