import db from '../../config/db.js';

function mapProject(row) {
  return row || null;
}

export const projectsRepository = {
  list() {
    return db
      .prepare('SELECT * FROM projects ORDER BY datetime(created_at) DESC, name ASC')
      .all()
      .map(mapProject);
  },

  findById(id) {
    return mapProject(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  },

  create(project) {
    db.prepare(`
      INSERT INTO projects (id, name, description, created_at)
      VALUES (@id, @name, @description, @created_at)
    `).run(project);

    return this.findById(project.id);
  },

  update(id, changes) {
    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?
      WHERE id = ?
    `).run(changes.name, changes.description, id);

    return this.findById(id);
  },

  remove(id) {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};