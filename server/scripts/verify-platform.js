import { closePool, query, healthcheckDatabase } from '../src/config/db.js';

const REQUIRED_TABLES = [
  'projects',
  'wbs_nodes',
  'activities',
  'activity_progress_updates',
  'activity_actuals',
  'project_baselines',
  'users',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'user_sessions',
  'audit_logs',
];

const REQUIRED_ROLES = ['admin', 'planner', 'viewer'];
const REQUIRED_PERMISSIONS = [
  'projects.read',
  'wbs.read',
  'activities.read',
  'baselines.read',
  'audit.read',
  'catalogs.read',
];

async function fetchExistingTables() {
  const result = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  return new Set(result.rows.map((row) => row.table_name));
}

async function fetchExistingValues(table, column) {
  const result = await query(`SELECT ${column} FROM ${table}`);
  return new Set(result.rows.map((row) => row[column]));
}

async function fetchSeedUsers() {
  const result = await query(`
    SELECT username, status
    FROM users
    WHERE LOWER(username) IN ('admin', 'planner', 'viewer')
    ORDER BY username
  `);

  return result.rows;
}

async function main() {
  const database = await healthcheckDatabase();
  const existingTables = await fetchExistingTables();
  const existingRoles = await fetchExistingValues('roles', 'code');
  const existingPermissions = await fetchExistingValues('permissions', 'code');
  const seedUsers = await fetchSeedUsers();

  const missingTables = REQUIRED_TABLES.filter((name) => !existingTables.has(name));
  const missingRoles = REQUIRED_ROLES.filter((code) => !existingRoles.has(code));
  const missingPermissions = REQUIRED_PERMISSIONS.filter((code) => !existingPermissions.has(code));

  const report = {
    database,
    checks: {
      missing_tables: missingTables,
      missing_roles: missingRoles,
      missing_permissions: missingPermissions,
      seed_users: seedUsers,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  const hasCriticalFailure =
    missingTables.length > 0 ||
    missingRoles.length > 0 ||
    missingPermissions.length > 0;

  process.exitCode = hasCriticalFailure ? 1 : 0;
}

main()
  .catch((error) => {
    console.error('Platform verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
