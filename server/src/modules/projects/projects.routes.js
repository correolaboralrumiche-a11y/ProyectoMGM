import { Router } from 'express';
import db from '../../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { ok, fail } from '../../utils/http.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY datetime(created_at) DESC, name ASC')
    .all();
  return ok(res, rows);
});

router.post('/', (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!name) return fail(res, 'Project name is required');

    const project = {
      id: uuidv4(),
      name,
      description,
      created_at: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO projects (id, name, description, created_at)
      VALUES (@id, @name, @description, @created_at)
    `).run(project);

    return ok(res, project, 201);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Project not found', 404);

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!name) return fail(res, 'Project name is required');

    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?
      WHERE id = ?
    `).run(name, description, req.params.id);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    return ok(res, updated);
  } catch (error) {
    return fail(res, error, 500);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return fail(res, 'Project not found', 404);

    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    return ok(res, { id: req.params.id });
  } catch (error) {
    return fail(res, error, 500);
  }
});

export default router;
