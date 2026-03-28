import crypto from 'crypto';

const PASSWORD_PREFIX = 'pbkdf2_sha512';
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto
    .pbkdf2Sync(String(password || ''), salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, 'sha512')
    .toString('hex');

  return `${PASSWORD_PREFIX}$${PASSWORD_ITERATIONS}$${salt}$${digest}`;
}

export async function up(knex) {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('username', 100).notNullable();
      table.string('email', 255).nullable();
      table.string('full_name', 255).notNullable();
      table.text('password_hash').notNullable();
      table.string('status', 50).notNullable().defaultTo('active');
      table.timestamp('last_login_at', { useTz: true }).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasRoles = await knex.schema.hasTable('roles');
  if (!hasRoles) {
    await knex.schema.createTable('roles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('code', 100).notNullable().unique();
      table.string('name', 255).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasPermissions = await knex.schema.hasTable('permissions');
  if (!hasPermissions) {
    await knex.schema.createTable('permissions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('code', 150).notNullable().unique();
      table.string('name', 255).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasRolePermissions = await knex.schema.hasTable('role_permissions');
  if (!hasRolePermissions) {
    await knex.schema.createTable('role_permissions', (table) => {
      table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
      table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
      table.primary(['role_id', 'permission_id']);
    });
  }

  const hasUserRoles = await knex.schema.hasTable('user_roles');
  if (!hasUserRoles) {
    await knex.schema.createTable('user_roles', (table) => {
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.primary(['user_id', 'role_id']);
    });
  }

  const hasUserSessions = await knex.schema.hasTable('user_sessions');
  if (!hasUserSessions) {
    await knex.schema.createTable('user_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('token_hash', 64).notNullable().unique();
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.timestamp('last_seen_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('revoked_at', { useTz: true }).nullable();
      table.text('user_agent').nullable();
      table.string('ip_address', 100).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.index(['user_id']);
      table.index(['expires_at']);
    });
  }

  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_lower ON users (LOWER(username))`);
  await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL`);

  const permissions = [
    ['projects.read', 'Projects read', 'View projects'],
    ['projects.write', 'Projects write', 'Create and update projects'],
    ['projects.delete', 'Projects delete', 'Delete projects'],
    ['wbs.read', 'WBS read', 'View WBS nodes'],
    ['wbs.write', 'WBS write', 'Create and update WBS nodes'],
    ['wbs.delete', 'WBS delete', 'Delete WBS nodes'],
    ['activities.read', 'Activities read', 'View activities'],
    ['activities.write', 'Activities write', 'Create and update activities'],
    ['activities.delete', 'Activities delete', 'Delete activities'],
    ['baselines.read', 'Baselines read', 'View baselines'],
    ['baselines.write', 'Baselines write', 'Create baselines'],
    ['baselines.delete', 'Baselines delete', 'Delete baselines'],
  ];

  for (const [code, name, description] of permissions) {
    await knex('permissions')
      .insert({ code, name, description })
      .onConflict('code')
      .ignore();
  }

  const roles = [
    ['admin', 'Administrator', 'Full system access'],
    ['planner', 'Planner', 'Planning and control access'],
    ['viewer', 'Viewer', 'Read-only access'],
  ];

  for (const [code, name, description] of roles) {
    await knex('roles')
      .insert({ code, name, description })
      .onConflict('code')
      .ignore();
  }

  const permissionRows = await knex('permissions').select('id', 'code');
  const roleRows = await knex('roles').select('id', 'code');
  const permissionByCode = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleByCode = new Map(roleRows.map((row) => [row.code, row.id]));

  const allPermissionCodes = permissions.map(([code]) => code);
  const readOnlyCodes = permissions.map(([code]) => code).filter((code) => code.endsWith('.read'));
  const plannerCodes = allPermissionCodes.filter((code) => code !== 'projects.delete');

  const rolePermissionMap = {
    admin: allPermissionCodes,
    planner: plannerCodes,
    viewer: readOnlyCodes,
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) continue;

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) continue;

      await knex('role_permissions')
        .insert({ role_id: roleId, permission_id: permissionId })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }

  const adminUsername = 'admin';
  const adminPasswordHash = hashPassword('Admin123!');

  const existingAdmin = await knex('users')
    .select('id')
    .whereRaw('LOWER(username) = LOWER(?)', [adminUsername])
    .first();

  if (!existingAdmin) {
    await knex('users').insert({
      username: adminUsername,
      full_name: 'System Administrator',
      email: 'admin@local.erp',
      password_hash: adminPasswordHash,
      status: 'active',
    });
  }

  const adminUser = await knex('users')
    .select('id')
    .whereRaw('LOWER(username) = LOWER(?)', [adminUsername])
    .first();

  const adminRoleId = roleByCode.get('admin');

  if (adminUser?.id && adminRoleId) {
    await knex('user_roles')
      .insert({ user_id: adminUser.id, role_id: adminRoleId })
      .onConflict(['user_id', 'role_id'])
      .ignore();
  }
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS ux_users_email_lower');
  await knex.raw('DROP INDEX IF EXISTS ux_users_username_lower');
  await knex.schema.dropTableIfExists('user_sessions');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('users');
}
