PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON projects(created_at);

CREATE TABLE IF NOT EXISTS wbs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES wbs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wbs_project_id
  ON wbs(project_id);

CREATE INDEX IF NOT EXISTS idx_wbs_parent_id
  ON wbs(parent_id);

CREATE INDEX IF NOT EXISTS idx_wbs_project_parent_sort
  ON wbs(project_id, parent_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wbs_project_code
  ON wbs(project_id, code);

CREATE TABLE IF NOT EXISTS activities (
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

CREATE INDEX IF NOT EXISTS idx_activities_project_id
  ON activities(project_id);

CREATE INDEX IF NOT EXISTS idx_activities_wbs_id
  ON activities(wbs_id);

CREATE INDEX IF NOT EXISTS idx_activities_wbs_sort
  ON activities(wbs_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_activities_project_activity_id
  ON activities(project_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_activities_status
  ON activities(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activities_project_activity_id
  ON activities(project_id, activity_id);

CREATE TRIGGER IF NOT EXISTS trg_activities_updated_at
AFTER UPDATE ON activities
FOR EACH ROW
BEGIN
  UPDATE activities
  SET updated_at = datetime('now')
  WHERE id = OLD.id;
END;