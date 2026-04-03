async function createStandardCatalogTable(knex, tableName) {
  const exists = await knex.schema.hasTable(tableName);
  if (exists) return;

  await knex.schema.createTable(tableName, (table) => {
    table.string('code', 50).primary();
    table.string('name', 120).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

async function seedCatalog(knex, table, rows, actorId) {
  for (const row of rows) {
    await knex(table)
      .insert({
        ...row,
        created_by: actorId,
        updated_by: actorId,
      })
      .onConflict('code')
      .merge({
        name: row.name,
        description: row.description,
        is_active: row.is_active,
        sort_order: row.sort_order,
        updated_by: actorId,
        updated_at: knex.fn.now(),
      });
  }
}

export async function up(knex) {
  await createStandardCatalogTable(knex, 'deliverable_types');
  await createStandardCatalogTable(knex, 'deliverable_statuses');
  await createStandardCatalogTable(knex, 'document_response_codes');
  await createStandardCatalogTable(knex, 'revision_purposes');

  const adminUser = await knex('users').select('id').whereRaw('LOWER(username) = LOWER(?)', ['admin']).first();
  const actorId = adminUser?.id || null;

  await seedCatalog(
    knex,
    'deliverable_types',
    [
      { code: 'drawing', name: 'Drawing', description: 'Plano o dibujo técnico', is_active: true, sort_order: 10 },
      { code: 'report', name: 'Report', description: 'Reporte técnico', is_active: true, sort_order: 20 },
      { code: 'calculation', name: 'Calculation', description: 'Memoria o cálculo', is_active: true, sort_order: 30 },
      { code: 'datasheet', name: 'Datasheet', description: 'Hoja de datos', is_active: true, sort_order: 40 },
      { code: 'procedure', name: 'Procedure', description: 'Procedimiento', is_active: true, sort_order: 50 },
      { code: 'specification', name: 'Specification', description: 'Especificación', is_active: true, sort_order: 60 },
      { code: 'vendor_document', name: 'Vendor Document', description: 'Documento de proveedor', is_active: true, sort_order: 70 },
      { code: 'model', name: 'Model', description: 'Modelo o archivo 3D/BIM', is_active: true, sort_order: 80 },
    ],
    actorId,
  );

  await seedCatalog(
    knex,
    'deliverable_statuses',
    [
      { code: 'draft', name: 'Draft', description: 'Documento en preparación interna', is_active: true, sort_order: 10 },
      { code: 'issued', name: 'Issued', description: 'Documento emitido', is_active: true, sort_order: 20 },
      { code: 'under_review', name: 'Under Review', description: 'En revisión por receptor', is_active: true, sort_order: 30 },
      { code: 'responded', name: 'Responded', description: 'Respuesta recibida', is_active: true, sort_order: 40 },
      { code: 'returned_for_update', name: 'Returned for Update', description: 'Devuelto para corrección', is_active: true, sort_order: 50 },
      { code: 'closed', name: 'Closed', description: 'Ciclo documentario cerrado', is_active: true, sort_order: 60 },
    ],
    actorId,
  );

  await seedCatalog(
    knex,
    'document_response_codes',
    [
      { code: 'approved', name: 'Approved', description: 'Aprobado sin observaciones', is_active: true, sort_order: 10 },
      { code: 'approved_with_comments', name: 'Approved with Comments', description: 'Aprobado con comentarios', is_active: true, sort_order: 20 },
      { code: 'revise_and_resubmit', name: 'Revise and Resubmit', description: 'Corregir y reenviar', is_active: true, sort_order: 30 },
      { code: 'rejected', name: 'Rejected', description: 'Rechazado', is_active: true, sort_order: 40 },
      { code: 'for_information', name: 'For Information', description: 'Solo para información', is_active: true, sort_order: 50 },
      { code: 'no_response_required', name: 'No Response Required', description: 'No requiere respuesta formal', is_active: true, sort_order: 60 },
    ],
    actorId,
  );

  await seedCatalog(
    knex,
    'revision_purposes',
    [
      { code: 'ifr', name: 'IFR', description: 'Issued for Review', is_active: true, sort_order: 10 },
      { code: 'ifa', name: 'IFA', description: 'Issued for Approval', is_active: true, sort_order: 20 },
      { code: 'ifc', name: 'IFC', description: 'Issued for Construction', is_active: true, sort_order: 30 },
      { code: 'ifi', name: 'IFI', description: 'Issued for Information', is_active: true, sort_order: 40 },
      { code: 'as_built', name: 'As Built', description: 'Plano conforme a obra', is_active: true, sort_order: 50 },
    ],
    actorId,
  );

  const hasDeliverables = await knex.schema.hasTable('deliverables');
  if (!hasDeliverables) {
    await knex.schema.createTable('deliverables', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('wbs_id').nullable().references('id').inTable('wbs_nodes').onDelete('SET NULL');
      table.uuid('activity_id').nullable().references('id').inTable('activities').onDelete('SET NULL');
      table.string('document_code', 120).notNullable().unique();
      table.string('title', 255).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.string('deliverable_type_code', 50).notNullable().references('code').inTable('deliverable_types');
      table.string('discipline_code', 50).notNullable().references('code').inTable('disciplines');
      table.string('priority_code', 50).notNullable().defaultTo('medium').references('code').inTable('project_priorities');
      table.string('status_code', 50).notNullable().defaultTo('draft').references('code').inTable('deliverable_statuses');
      table.string('originator', 120).notNullable().defaultTo('');
      table.string('responsible_person', 120).notNullable().defaultTo('');
      table.string('spec_section', 80).notNullable().defaultTo('');
      table.string('package_no', 80).notNullable().defaultTo('');
      table.date('planned_issue_date').nullable();
      table.date('forecast_issue_date').nullable();
      table.date('actual_issue_date').nullable();
      table.date('planned_response_date').nullable();
      table.date('forecast_response_date').nullable();
      table.date('actual_response_date').nullable();
      table.string('current_revision_code', 30).nullable();
      table.string('current_response_code', 50).nullable().references('code').inTable('document_response_codes');
      table.string('current_issue_transmittal_no', 80).notNullable().defaultTo('');
      table.string('current_response_transmittal_no', 80).notNullable().defaultTo('');
      table.text('remarks').notNullable().defaultTo('');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasRevisions = await knex.schema.hasTable('deliverable_revisions');
  if (!hasRevisions) {
    await knex.schema.createTable('deliverable_revisions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('deliverable_id').notNullable().references('id').inTable('deliverables').onDelete('CASCADE');
      table.integer('revision_sequence').notNullable();
      table.string('revision_code', 30).notNullable();
      table.string('issue_purpose_code', 50).notNullable().references('code').inTable('revision_purposes');
      table.date('issue_date').nullable();
      table.string('issue_transmittal_no', 80).notNullable().defaultTo('');
      table.date('planned_response_date').nullable();
      table.date('response_date').nullable();
      table.string('response_code', 50).nullable().references('code').inTable('document_response_codes');
      table.string('response_transmittal_no', 80).notNullable().defaultTo('');
      table.string('response_by', 120).notNullable().defaultTo('');
      table.text('remarks').notNullable().defaultTo('');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.unique(['deliverable_id', 'revision_code']);
      table.unique(['deliverable_id', 'revision_sequence']);
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverables_status_code ON deliverables(status_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverables_discipline_code ON deliverables(discipline_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverables_activity_id ON deliverables(activity_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverable_revisions_deliverable_id ON deliverable_revisions(deliverable_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_deliverable_revisions_response_code ON deliverable_revisions(response_code)');
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_deliverable_revisions_response_code');
  await knex.raw('DROP INDEX IF EXISTS idx_deliverable_revisions_deliverable_id');
  await knex.raw('DROP INDEX IF EXISTS idx_deliverables_activity_id');
  await knex.raw('DROP INDEX IF EXISTS idx_deliverables_discipline_code');
  await knex.raw('DROP INDEX IF EXISTS idx_deliverables_status_code');
  await knex.raw('DROP INDEX IF EXISTS idx_deliverables_project_id');

  await knex.schema.dropTableIfExists('deliverable_revisions');
  await knex.schema.dropTableIfExists('deliverables');

  await knex.schema.dropTableIfExists('revision_purposes');
  await knex.schema.dropTableIfExists('document_response_codes');
  await knex.schema.dropTableIfExists('deliverable_statuses');
  await knex.schema.dropTableIfExists('deliverable_types');
}
