import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.resolve(dataDir, 'app.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function tableExists(tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return !!row;
}

function columnExists(tableName, columnName) {
  if (!tableExists(tableName)) return false;
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function indexExists(indexName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName);
  return !!row;
}

function initializeSchemaIfNeeded() {
  const hasCoreTables =
    tableExists('projects') && tableExists('wbs') && tableExists('activities');

  if (!hasCoreTables) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }
}

function buildUniqueActivityId(baseValue, usedValues) {
  const normalizedBase = String(baseValue || '').trim() || 'ACT-001';

  if (!usedValues.has(normalizedBase)) {
    usedValues.add(normalizedBase);
    return normalizedBase;
  }

  let suffix = 2;
  let candidate = `${normalizedBase}-${String(suffix).padStart(2, '0')}`;

  while (usedValues.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${String(suffix).padStart(2, '0')}`;
  }

  usedValues.add(candidate);
  return candidate;
}

function rebuildActivitiesTable() {
  if (!tableExists('activities')) return;

  const rows = db
    .prepare(`
      SELECT a.*, w.project_id AS resolved_project_id
      FROM activities a
      INNER JOIN wbs w ON w.id = a.wbs_id
      ORDER BY datetime(a.created_at) ASC, a.id ASC
    `)
    .all();

  const usedByProject = new Map();

  const normalizedRows = rows.map((row) => {
    const projectId = row.resolved_project_id;
    const usedValues = usedByProject.get(projectId) || new Set();
    usedByProject.set(projectId, usedValues);

    const startDate = row.start_date || null;
    let endDate = row.end_date || null;

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end < start
      ) {
        endDate = startDate;
      }
    }

    const duration = startDate && endDate
      ? Math.max(
          0,
          Math.round(
            (new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) /
              (1000 * 60 * 60 * 24)
          )
        )
      : Math.max(0, Number(row.duration || 0));

    return {
      id: row.id,
      project_id: projectId,
      wbs_id: row.wbs_id,
      activity_id: buildUniqueActivityId(row.activity_id, usedValues),
      name: row.name,
      start_date: startDate,
      end_date: endDate,
      duration,
      progress: Number(row.progress || 0),
      hours: Number(row.hours || 0),
      cost: Number(row.cost || 0),
      status: row.status || 'Not Started',
      sort_order: Number(row.sort_order || 0),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    };
  });

  const tx = db.transaction(() => {
    db.exec(`
      DROP TRIGGER IF EXISTS trg_activities_updated_at;

      CREATE TABLE activities_new (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        wbs_id TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NULL,
        end_date TEXT NULL,
        duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
        progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        hours REAL NOT NULL DEFAULT 0 CHECK (hours >= 0),
        cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
        status TEXT NOT NULL DEFAULT 'Not Started',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (wbs_id) REFERENCES wbs(id) ON DELETE CASCADE,
        CHECK (
          start_date IS NULL
          OR end_date IS NULL
          OR julianday(end_date) >= julianday(start_date)
        )
      );
    `);

    const insertStmt = db.prepare(`
      INSERT INTO activities_new (
        id, project_id, wbs_id, activity_id, name,
        start_date, end_date, duration, progress,
        hours, cost, status, sort_order, created_at, updated_at
      )
      VALUES (
        @id, @project_id, @wbs_id, @activity_id, @name,
        @start_date, @end_date, @duration, @progress,
        @hours, @cost, @status, @sort_order, @created_at, @updated_at
      )
    `);

    for (const row of normalizedRows) {
      insertStmt.run(row);
    }

    db.exec(`
      DROP TABLE activities;
      ALTER TABLE activities_new RENAME TO activities;
      CREATE INDEX idx_activities_project_id ON activities(project_id);
      CREATE INDEX idx_activities_wbs_id ON activities(wbs_id);
      CREATE INDEX idx_activities_wbs_sort ON activities(wbs_id, sort_order);
      CREATE INDEX idx_activities_project_activity_id ON activities(project_id, activity_id);
      CREATE INDEX idx_activities_status ON activities(status);
      CREATE UNIQUE INDEX uq_activities_project_activity_id ON activities(project_id, activity_id);
      CREATE TRIGGER trg_activities_updated_at
      AFTER UPDATE ON activities
      FOR EACH ROW
      BEGIN
        UPDATE activities SET updated_at = datetime('now') WHERE id = OLD.id;
      END;
    `);
  });

  tx();
}

function ensureActivitiesSchema() {
  const mustRebuild =
    !columnExists('activities', 'project_id') ||
    !indexExists('uq_activities_project_activity_id');

  if (mustRebuild) {
    rebuildActivitiesTable();
  }
}

function ensureBaselineSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_baselines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      project_name_snapshot TEXT NOT NULL,
      project_description_snapshot TEXT DEFAULT '',
      source_project_created_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      baseline_type TEXT NOT NULL DEFAULT 'MANUAL',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_project_baselines_project_name
      ON project_baselines(project_id, name);
    CREATE INDEX IF NOT EXISTS idx_project_baselines_project_id
      ON project_baselines(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_baselines_created_at
      ON project_baselines(created_at);

    CREATE TABLE IF NOT EXISTS baseline_wbs (
      id TEXT PRIMARY KEY,
      baseline_id TEXT NOT NULL,
      source_wbs_id TEXT NULL,
      parent_id TEXT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (baseline_id) REFERENCES project_baselines(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES baseline_wbs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_baseline_wbs_baseline_id
      ON baseline_wbs(baseline_id);
    CREATE INDEX IF NOT EXISTS idx_baseline_wbs_parent_id
      ON baseline_wbs(parent_id);
    CREATE INDEX IF NOT EXISTS idx_baseline_wbs_baseline_parent_sort
      ON baseline_wbs(baseline_id, parent_id, sort_order);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_wbs_baseline_code
      ON baseline_wbs(baseline_id, code);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_wbs_baseline_source
      ON baseline_wbs(baseline_id, source_wbs_id);

    CREATE TABLE IF NOT EXISTS baseline_activities (
      id TEXT PRIMARY KEY,
      baseline_id TEXT NOT NULL,
      baseline_wbs_id TEXT NOT NULL,
      source_activity_id TEXT NULL,
      project_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NULL,
      end_date TEXT NULL,
      duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
      progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      hours REAL NOT NULL DEFAULT 0 CHECK (hours >= 0),
      cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
      status TEXT NOT NULL DEFAULT 'Not Started',
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_created_at TEXT NULL,
      source_updated_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (baseline_id) REFERENCES project_baselines(id) ON DELETE CASCADE,
      FOREIGN KEY (baseline_wbs_id) REFERENCES baseline_wbs(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CHECK (
        start_date IS NULL
        OR end_date IS NULL
        OR julianday(end_date) >= julianday(start_date)
      )
    );

    CREATE INDEX IF NOT EXISTS idx_baseline_activities_baseline_id
      ON baseline_activities(baseline_id);
    CREATE INDEX IF NOT EXISTS idx_baseline_activities_baseline_wbs_id
      ON baseline_activities(baseline_wbs_id);
    CREATE INDEX IF NOT EXISTS idx_baseline_activities_project_id
      ON baseline_activities(project_id);
    CREATE INDEX IF NOT EXISTS idx_baseline_activities_activity_id
      ON baseline_activities(activity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_activities_baseline_activity_id
      ON baseline_activities(baseline_id, activity_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_baseline_activities_baseline_source
      ON baseline_activities(baseline_id, source_activity_id);
  `);
}

initializeSchemaIfNeeded();
ensureActivitiesSchema();
ensureBaselineSchema();

export default db;
