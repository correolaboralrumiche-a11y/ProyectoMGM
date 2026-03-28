export async function up(knex) {
  const permissions = [
    ['projects.create', 'Projects create', 'Create projects'],
    ['projects.update', 'Projects update', 'Update project headers and status'],
    ['projects.delete', 'Projects delete', 'Delete projects'],
    ['wbs.create', 'WBS create', 'Create WBS nodes'],
    ['wbs.update', 'WBS update', 'Rename and edit WBS nodes'],
    ['wbs.reorder', 'WBS reorder', 'Move, indent and outdent WBS nodes'],
    ['wbs.delete', 'WBS delete', 'Delete WBS nodes'],
    ['activities.create', 'Activities create', 'Create activities'],
    ['activities.update', 'Activities update', 'Update activities'],
    ['activities.reorder', 'Activities reorder', 'Move activities within a WBS'],
    ['activities.delete', 'Activities delete', 'Delete activities'],
    ['baselines.create', 'Baselines create', 'Create baselines'],
    ['baselines.delete', 'Baselines delete', 'Delete baselines'],
    ['catalogs.manage', 'Catalogs manage', 'Create and update master catalogs'],
  ];

  for (const [code, name, description] of permissions) {
    await knex('permissions').insert({ code, name, description }).onConflict('code').ignore();
  }

  const permissionRows = await knex('permissions').select('id', 'code');
  const roleRows = await knex('roles').select('id', 'code');
  const permissionByCode = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleByCode = new Map(roleRows.map((row) => [row.code, row.id]));

  const rolePermissionMap = {
    admin: [
      'projects.read',
      'projects.create',
      'projects.update',
      'projects.delete',
      'wbs.read',
      'wbs.create',
      'wbs.update',
      'wbs.reorder',
      'wbs.delete',
      'activities.read',
      'activities.create',
      'activities.update',
      'activities.reorder',
      'activities.delete',
      'baselines.read',
      'baselines.create',
      'baselines.delete',
      'catalogs.read',
      'catalogs.manage',
      'audit.read',
    ],
    planner: [
      'projects.read',
      'projects.create',
      'projects.update',
      'wbs.read',
      'wbs.create',
      'wbs.update',
      'wbs.reorder',
      'wbs.delete',
      'activities.read',
      'activities.create',
      'activities.update',
      'activities.reorder',
      'activities.delete',
      'baselines.read',
      'baselines.create',
      'baselines.delete',
      'catalogs.read',
      'audit.read',
    ],
    viewer: [
      'projects.read',
      'wbs.read',
      'activities.read',
      'baselines.read',
      'catalogs.read',
    ],
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

  const adminUser = await knex('users')
    .select('id')
    .whereRaw('LOWER(username) = LOWER(?)', ['admin'])
    .first();

  if (adminUser?.id) {
    await knex('audit_logs').insert({
      actor_user_id: adminUser.id,
      entity_type: 'system.migration',
      entity_id: '20260328060000_fine_grained_permissions_operational_control',
      action: 'migration',
      summary: 'Sprint 6 fine-grained permissions and operational control migration applied',
      metadata: {
        sprint: 'Sprint 6 - Permisos finos y control operativo',
        added_permissions: permissions.map(([code]) => code),
      },
    });
  }
}

export async function down(knex) {
  const codes = [
    'projects.create',
    'projects.update',
    'projects.delete',
    'wbs.create',
    'wbs.update',
    'wbs.reorder',
    'wbs.delete',
    'activities.create',
    'activities.update',
    'activities.reorder',
    'activities.delete',
    'baselines.create',
    'baselines.delete',
    'catalogs.manage',
  ];

  const permissionRows = await knex('permissions').select('id', 'code').whereIn('code', codes);
  const permissionIds = permissionRows.map((row) => row.id);

  if (permissionIds.length) {
    await knex('role_permissions').whereIn('permission_id', permissionIds).del();
    await knex('permissions').whereIn('id', permissionIds).del();
  }
}
