import { closePool, withTransaction } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';

const ROLE_DEFINITIONS = [
  ['admin', 'Administrator', 'Full system access'],
  ['planner', 'Planner', 'Planning and control access'],
  ['viewer', 'Viewer', 'Read-only access'],
];

const PERMISSION_DEFINITIONS = [
  ['projects.read', 'Projects read', 'View projects'],
  ['projects.write', 'Projects write', 'Create and update projects'],
  ['projects.create', 'Projects create', 'Create projects'],
  ['projects.update', 'Projects update', 'Update projects'],
  ['projects.delete', 'Projects delete', 'Delete projects'],

  ['wbs.read', 'WBS read', 'View WBS nodes'],
  ['wbs.write', 'WBS write', 'Create and update WBS nodes'],
  ['wbs.create', 'WBS create', 'Create WBS nodes'],
  ['wbs.update', 'WBS update', 'Update WBS nodes'],
  ['wbs.delete', 'WBS delete', 'Delete WBS nodes'],
  ['wbs.reorder', 'WBS reorder', 'Reorder WBS nodes'],

  ['activities.read', 'Activities read', 'View activities'],
  ['activities.write', 'Activities write', 'Create and update activities'],
  ['activities.create', 'Activities create', 'Create activities'],
  ['activities.update', 'Activities update', 'Update activities'],
  ['activities.delete', 'Activities delete', 'Delete activities'],
  ['activities.reorder', 'Activities reorder', 'Reorder activities'],

  ['deliverables.read', 'Deliverables read', 'View document control register'],
  ['deliverables.write', 'Deliverables write', 'Create and update deliverables'],
  ['deliverables.create', 'Deliverables create', 'Create deliverables'],
  ['deliverables.update', 'Deliverables update', 'Update deliverables'],
  ['deliverables.delete', 'Deliverables delete', 'Delete deliverables'],
  ['deliverables.manage_revisions', 'Deliverables manage revisions', 'Create and update revisions and responses'],

  ['control_periods.read', 'Financial periods read', 'View financial period definitions and captured snapshots'],
  ['control_periods.write', 'Financial periods write', 'Create definitions and manage snapshots'],
  ['control_periods.create', 'Financial periods create', 'Create and update financial period definitions'],
  ['control_periods.close', 'Financial periods capture/close', 'Capture or close financial period snapshots'],
  ['control_periods.reopen', 'Financial periods reopen', 'Reopen captured financial period snapshots'],
  ['control_periods.delete', 'Financial periods delete', 'Delete financial period definitions without data or editable snapshots'],

  ['baselines.read', 'Baselines read', 'View baselines'],
  ['baselines.write', 'Baselines write', 'Create baselines'],
  ['baselines.create', 'Baselines create', 'Create baselines'],
  ['baselines.delete', 'Baselines delete', 'Delete baselines'],

  ['catalogs.read', 'Catalogs read', 'View catalogs'],
  ['catalogs.write', 'Catalogs write', 'Create and update catalogs'],
  ['catalogs.manage', 'Catalogs manage', 'Manage catalogs'],

  ['audit.read', 'Audit read', 'View audit logs'],

  ['layout_templates.read', 'Layout templates read', 'View project layout templates'],
  ['layout_templates.write', 'Layout templates write', 'Create and update project layout templates'],
  ['layout_templates.create', 'Layout templates create', 'Create project layout templates'],
  ['layout_templates.update', 'Layout templates update', 'Update project layout templates'],
  ['layout_templates.delete', 'Layout templates delete', 'Delete project layout templates'],
];

const USER_DEFINITIONS = [
  {
    username: 'admin',
    full_name: 'System Administrator',
    email: 'admin@local.erp',
    password: env.seedAdminPassword,
    role: 'admin',
  },
  {
    username: 'planner',
    full_name: 'Project Planner',
    email: 'planner@local.erp',
    password: env.seedPlannerPassword,
    role: 'planner',
  },
  {
    username: 'viewer',
    full_name: 'Read Only User',
    email: 'viewer@local.erp',
    password: env.seedViewerPassword,
    role: 'viewer',
  },
];

function buildRolePermissionMap(allPermissionCodes) {
  const readPermissions = allPermissionCodes.filter((code) => code.endsWith('.read'));
  const plannerPermissions = allPermissionCodes.filter((code) => !code.endsWith('.delete'));

  return {
    admin: allPermissionCodes,
    planner: plannerPermissions,
    viewer: readPermissions,
  };
}

async function ensureRole(client, [code, name, description]) {
  await client.query(
    `
    INSERT INTO roles (code, name, description)
    VALUES ($1, $2, $3)
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW()
    `,
    [code, name, description],
  );

  const result = await client.query(`SELECT id, code FROM roles WHERE code = $1`, [code]);
  return result.rows[0];
}

async function ensurePermission(client, [code, name, description]) {
  await client.query(
    `
    INSERT INTO permissions (code, name, description)
    VALUES ($1, $2, $3)
    ON CONFLICT (code)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = NOW()
    `,
    [code, name, description],
  );

  const result = await client.query(`SELECT id, code FROM permissions WHERE code = $1`, [code]);
  return result.rows[0];
}

async function ensureUser(client, user) {
  const existing = await client.query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [user.username],
  );

  if (!existing.rows[0]) {
    const passwordHash = hashPassword(user.password);
    await client.query(
      `
      INSERT INTO users (username, email, full_name, password_hash, status)
      VALUES ($1, $2, $3, $4, 'active')
      `,
      [user.username, user.email, user.full_name, passwordHash],
    );
  } else {
    await client.query(
      `
      UPDATE users
      SET email = $2,
          full_name = $3,
          status = 'active',
          updated_at = NOW()
      WHERE LOWER(username) = LOWER($1)
      `,
      [user.username, user.email, user.full_name],
    );
  }

  const result = await client.query(
    `SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [user.username],
  );

  return result.rows[0];
}

async function ensureUserRole(client, userId, roleId) {
  await client.query(
    `
    INSERT INTO user_roles (user_id, role_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [userId, roleId],
  );
}

async function ensureRolePermission(client, roleId, permissionId) {
  await client.query(
    `
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES ($1, $2)
    ON CONFLICT (role_id, permission_id) DO NOTHING
    `,
    [roleId, permissionId],
  );
}

async function main() {
  const permissionCodes = PERMISSION_DEFINITIONS.map(([code]) => code);
  const rolePermissionMap = buildRolePermissionMap(permissionCodes);

  await withTransaction(async (client) => {
    const roles = new Map();
    for (const definition of ROLE_DEFINITIONS) {
      const role = await ensureRole(client, definition);
      roles.set(role.code, role);
    }

    const permissions = new Map();
    for (const definition of PERMISSION_DEFINITIONS) {
      const permission = await ensurePermission(client, definition);
      permissions.set(permission.code, permission);
    }

    for (const [roleCode, codes] of Object.entries(rolePermissionMap)) {
      const role = roles.get(roleCode);
      if (!role) continue;

      for (const permissionCode of codes) {
        const permission = permissions.get(permissionCode);
        if (!permission) continue;
        await ensureRolePermission(client, role.id, permission.id);
      }
    }

    for (const userDefinition of USER_DEFINITIONS) {
      const user = await ensureUser(client, userDefinition);
      const role = roles.get(userDefinition.role);

      if (user?.id && role?.id) {
        await ensureUserRole(client, user.id, role.id);
      }
    }
  });

  console.log('Platform seed completed.');
  console.log('Seed users ready:');
  console.log(`- admin / ${env.seedAdminPassword}`);
  console.log(`- planner / ${env.seedPlannerPassword}`);
  console.log(`- viewer / ${env.seedViewerPassword}`);
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Platform seed failed:', error);
    await closePool();
    process.exit(1);
  });
