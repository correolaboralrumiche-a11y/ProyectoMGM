import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base real del proyecto
const dbPath = path.resolve(__dirname, '../../data/app.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function tableExists(tableName) {
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
    )
    .get(tableName);

  return !!row;
}

function columnExists(tableName, columnName) {
  if (!tableExists(tableName)) return false;
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((col) => col.name === columnName);
}

function initializeSchemaIfNeeded() {
  const hasCoreTables =
    tableExists('projects') &&
    tableExists('wbs') &&
    tableExists('activities');

  // Solo ejecutar schema.sql si la base está vacía o aún no tiene las tablas base.
  // En una base existente, ejecutar todo el schema puede fallar si el archivo ya fue
  // evolucionando con migraciones puntuales (por ejemplo activity_id).
  if (!hasCoreTables) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }
}

function ensureActivitiesActivityIdColumn() {
  if (!columnExists('activities', 'activity_id')) {
    db.exec(`ALTER TABLE activities ADD COLUMN activity_id TEXT`);
  }

  const rows = db
    .prepare(`
      SELECT id, activity_id
      FROM activities
      ORDER BY created_at, id
    `)
    .all();

  const updateStmt = db.prepare(`
    UPDATE activities
    SET activity_id = ?
    WHERE id = ?
  `);

  let counter = 1;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const current =
        typeof row.activity_id === 'string' ? row.activity_id.trim() : '';

      if (!current) {
        const nextActivityId = `ACT-${String(counter).padStart(3, '0')}`;
        updateStmt.run(nextActivityId, row.id);
        counter += 1;
      }
    }
  });

  tx();

  // Índice opcional para mejorar búsquedas/ordenamiento por activity_id
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activities_activity_id
    ON activities(activity_id)
  `);
}

initializeSchemaIfNeeded();
ensureActivitiesActivityIdColumn();

export default db;
